"""Deviation candidate generation: omission / repetition / substitution.

Method: (1) run an unconstrained greedy CTC decode of the SAME audio
(independent of the forced alignment against the known target — this is
"what the model thinks was said"), (2) word-tokenize that free decode by
splitting on the '|' word-boundary symbol, (3) diff the target word
sequence against the freely-decoded word sequence with a standard
sequence-alignment algorithm (difflib.SequenceMatcher, a Ratcliff/Obershelp
diff — the same family of algorithm used for text diffing generally), and
(4) turn the diff's delete/replace/insert opcodes into
omission/substitution/repetition candidates. This is the
"alignment-gap + edit-distance logic" the milestone calls for, applied at
word granularity; nothing here treats the free decode as ground truth —
it is only ever compared against the known target, never surfaced to a
user directly.
"""

from dataclasses import dataclass
from difflib import SequenceMatcher

import torch

from app.word_alignment import WordAlignment

BLANK_ID = 0
WORD_BOUNDARY_CHAR = "|"

# Provisional cut-point (Milestone C allows a calibration placeholder;
# Milestone H replaces this with a value derived from the golden corpus,
# per CLAUDE.md §4). A word whose forced-alignment avg log-prob is below
# this is inherently suspect regardless of what the diff says.
LOW_CONFIDENCE_LOG_PROB = -3.0


@dataclass
class IssueCandidate:
    word_index: int
    kind: str  # 'omission' | 'repetition' | 'substitution'
    model_confidence: float  # derived from alignment avg_log_prob, in (0, 1]


def greedy_ctc_decode(log_probs: torch.Tensor, id_to_char: dict[int, str]) -> list[str]:
    """Standard CTC greedy decode: argmax per frame, collapse consecutive
    repeats, drop blanks, then split on the '|' word-boundary symbol."""
    frame_ids = torch.argmax(log_probs, dim=-1).tolist()

    collapsed: list[int] = []
    previous = None
    for frame_id in frame_ids:
        if frame_id != previous:
            collapsed.append(frame_id)
        previous = frame_id
    chars = [id_to_char[i] for i in collapsed if i != BLANK_ID and i in id_to_char]

    text = "".join(chars)
    return [w for w in text.split(WORD_BOUNDARY_CHAR) if w]


def _log_prob_to_confidence(avg_log_prob: float) -> float:
    """Maps an average CTC log-probability to a (0, 1] confidence score
    via exp — log-probabilities are additive-log space, so exp() is the
    natural (if provisional/uncalibrated) mapping back to a probability-like
    scale. NOT a calibrated probability; Milestone H calibrates this
    against the golden corpus per CLAUDE.md §4."""
    import math

    return math.exp(max(avg_log_prob, -50.0))


def generate_issue_candidates(
    word_alignments: list[WordAlignment],
    log_probs: torch.Tensor,
    id_to_char: dict[int, str],
) -> list[IssueCandidate]:
    target_words = [w.display_text for w in word_alignments]
    decoded_words = greedy_ctc_decode(log_probs, id_to_char)

    matcher = SequenceMatcher(a=target_words, b=decoded_words, autojunk=False)
    candidates: list[IssueCandidate] = []

    for tag, a_start, a_end, b_start, b_end in matcher.get_opcodes():
        if tag == "equal":
            continue
        if tag == "delete":
            # Target word(s) with no counterpart in the free decode.
            for i in range(a_start, a_end):
                candidates.append(
                    IssueCandidate(
                        word_index=word_alignments[i].word_index,
                        kind="omission",
                        model_confidence=_log_prob_to_confidence(word_alignments[i].avg_log_prob),
                    )
                )
        elif tag == "replace":
            for i in range(a_start, a_end):
                candidates.append(
                    IssueCandidate(
                        word_index=word_alignments[i].word_index,
                        kind="substitution",
                        model_confidence=_log_prob_to_confidence(word_alignments[i].avg_log_prob),
                    )
                )
        elif tag == "insert":
            # The reciter said extra word(s) not present in the target at
            # this position. Attribute the candidate to the nearest
            # target word (the one immediately preceding the insertion
            # point, or the first word if the insertion is at the start)
            # since repetition candidates are reported per target word,
            # not per free-standing decoded word.
            anchor_index = word_alignments[a_start - 1].word_index if a_start > 0 else (
                word_alignments[0].word_index if word_alignments else 0
            )
            anchor_conf = (
                word_alignments[a_start - 1].avg_log_prob if a_start > 0 else (
                    word_alignments[0].avg_log_prob if word_alignments else float("-inf")
                )
            )
            candidates.append(
                IssueCandidate(
                    word_index=anchor_index,
                    kind="repetition",
                    model_confidence=_log_prob_to_confidence(anchor_conf),
                )
            )

    # Independently, ANY word below the low-confidence floor is flagged
    # even if the free-decode diff called it "equal" — a correct-looking
    # transcript can still coincide with a barely-audible/mumbled word.
    diffed_indices = {c.word_index for c in candidates}
    for w in word_alignments:
        if w.word_index not in diffed_indices and w.avg_log_prob < LOW_CONFIDENCE_LOG_PROB:
            candidates.append(
                IssueCandidate(
                    word_index=w.word_index,
                    kind="omission",
                    model_confidence=_log_prob_to_confidence(w.avg_log_prob),
                )
            )

    return sorted(candidates, key=lambda c: c.word_index)

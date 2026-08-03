"""Deviation candidate generation: omission / repetition / substitution.

Method: (1) run an unconstrained greedy CTC decode of the SAME audio
(independent of the forced alignment against the known target — this is
"what the model thinks was said"), (2) diff that free-decoded character
stream against the target's character stream (difflib.SequenceMatcher, a
Ratcliff/Obershelp diff), attributing each mismatched target character back
to its owning target word, and (3) turn a word's aggregate mismatch ratio
plus the diff opcode kinds into omission/substitution/repetition
candidates. Nothing here treats the free decode as ground truth — it is
only ever compared against the known target, never surfaced to a user
directly.

Earlier versions of this module diffed at WORD granularity, splitting the
free decode on the model's '|' word-boundary symbol. That assumes the
model reliably predicts an explicit boundary between words, which in
practice it rarely does for continuous, pause-free recitation: real-device
verification audio produced a free decode with zero boundary symbols for a
correctly recited passage, collapsing the whole utterance into one "word"
and causing every target word to be diffed as a substitution. Diffing at
the character level and mapping ownership from the KNOWN target (not the
free decode) removes that dependency entirely — the free decode no longer
needs to segment itself into words at all.
"""

import math
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

# Provisional cut-point, same status as LOW_CONFIDENCE_LOG_PROB above: the
# fraction of a target word's characters that must fall inside a
# non-"equal" diff opcode before the word itself is flagged. Below this, a
# handful of misaligned characters at a word's edge (a normal artifact of
# character-level diffing near a substitution/insertion elsewhere) isn't
# treated as a deviation of that word.
MISMATCH_RATIO_FLOOR = 0.5


@dataclass
class IssueCandidate:
    word_index: int
    kind: str  # 'omission' | 'repetition' | 'substitution'
    model_confidence: float  # derived from alignment avg_log_prob, in (0, 1]


def greedy_ctc_decode_chars(log_probs: torch.Tensor, id_to_char: dict[int, str]) -> list[str]:
    """Standard CTC greedy decode: argmax per frame, collapse consecutive
    repeats, drop blanks. Returns the raw character stream. Deliberately
    does NOT split on the word-boundary symbol — see module docstring for
    why relying on that split is unsafe."""
    frame_ids = torch.argmax(log_probs, dim=-1).tolist()

    collapsed: list[int] = []
    previous = None
    for frame_id in frame_ids:
        if frame_id != previous:
            collapsed.append(frame_id)
        previous = frame_id
    return [id_to_char[i] for i in collapsed if i != BLANK_ID and i in id_to_char]


def _log_prob_to_confidence(avg_log_prob: float) -> float:
    """Maps an average CTC log-probability to a (0, 1] confidence score
    via exp — log-probabilities are additive-log space, so exp() is the
    natural (if provisional/uncalibrated) mapping back to a probability-like
    scale. NOT a calibrated probability; Milestone H calibrates this
    against the golden corpus per CLAUDE.md §4."""
    return math.exp(max(avg_log_prob, -50.0))


def _flatten_target_chars(
    word_alignments: list[WordAlignment], valid_chars: set[str]
) -> tuple[list[str], list[int | None]]:
    """Flattens target words into one char stream (with boundary markers
    between words, owner=None) plus a parallel list mapping each character
    position back to the target word_index it belongs to. Word boundaries
    on this axis come from the KNOWN target only — the reference side of
    the diff, never the free decode."""
    flat_chars: list[str] = []
    owners: list[int | None] = []
    for i, w in enumerate(word_alignments):
        if i > 0:
            flat_chars.append(WORD_BOUNDARY_CHAR)
            owners.append(None)
        for ch in w.display_text:
            if ch in valid_chars:
                flat_chars.append(ch)
                owners.append(w.word_index)
    return flat_chars, owners


def generate_issue_candidates(
    word_alignments: list[WordAlignment],
    log_probs: torch.Tensor,
    id_to_char: dict[int, str],
) -> list[IssueCandidate]:
    valid_chars = set(id_to_char.values())
    target_chars, char_owners = _flatten_target_chars(word_alignments, valid_chars)
    decoded_chars = greedy_ctc_decode_chars(log_probs, id_to_char)
    log_prob_by_index = {w.word_index: w.avg_log_prob for w in word_alignments}

    matcher = SequenceMatcher(a=target_chars, b=decoded_chars, autojunk=False)

    total_chars: dict[int, int] = {w.word_index: 0 for w in word_alignments}
    for owner in char_owners:
        if owner is not None:
            total_chars[owner] += 1

    mismatched_chars: dict[int, int] = {}
    replaced_chars: dict[int, int] = {}
    insert_anchor_confidence: dict[int, float] = {}

    for tag, a_start, a_end, _b_start, _b_end in matcher.get_opcodes():
        if tag == "equal":
            continue
        if tag == "insert":
            # The reciter said extra content not present in the target at
            # this position. Attribute it to the nearest preceding target
            # word (or the first word if the insertion is at the very
            # start) since repetition candidates are reported per target
            # word, not per free-standing decoded content.
            anchor_index = next(
                (char_owners[i] for i in range(a_start - 1, -1, -1) if char_owners[i] is not None),
                None,
            )
            if anchor_index is None:
                anchor_index = next((o for o in char_owners if o is not None), None)
            if anchor_index is not None:
                insert_anchor_confidence[anchor_index] = log_prob_by_index.get(anchor_index, float("-inf"))
            continue
        for i in range(a_start, a_end):
            owner = char_owners[i]
            if owner is None:
                continue
            mismatched_chars[owner] = mismatched_chars.get(owner, 0) + 1
            if tag == "replace":
                replaced_chars[owner] = replaced_chars.get(owner, 0) + 1

    candidates: list[IssueCandidate] = []
    flagged: set[int] = set()
    for word_index, char_count in total_chars.items():
        if char_count == 0:
            continue
        ratio = mismatched_chars.get(word_index, 0) / char_count
        if ratio < MISMATCH_RATIO_FLOOR:
            continue
        flagged.add(word_index)
        kind = "substitution" if replaced_chars.get(word_index, 0) > 0 else "omission"
        candidates.append(
            IssueCandidate(
                word_index=word_index,
                kind=kind,
                model_confidence=_log_prob_to_confidence(log_prob_by_index[word_index]),
            )
        )

    for word_index, anchor_log_prob in insert_anchor_confidence.items():
        if word_index in flagged:
            continue
        flagged.add(word_index)
        candidates.append(
            IssueCandidate(word_index=word_index, kind="repetition", model_confidence=_log_prob_to_confidence(anchor_log_prob))
        )

    # Independently, ANY word below the low-confidence floor is flagged
    # even if the diff called it clean — a correct-looking transcript can
    # still coincide with a barely-audible/mumbled word.
    for w in word_alignments:
        if w.word_index not in flagged and w.avg_log_prob < LOW_CONFIDENCE_LOG_PROB:
            flagged.add(w.word_index)
            candidates.append(
                IssueCandidate(word_index=w.word_index, kind="omission", model_confidence=_log_prob_to_confidence(w.avg_log_prob))
            )

    return sorted(candidates, key=lambda c: c.word_index)

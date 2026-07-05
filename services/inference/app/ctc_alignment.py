"""CTC forced alignment: given per-frame CTC log-probabilities (emission)
and a KNOWN target label sequence, find the maximum-likelihood monotonic
alignment of frames to labels — this is standard CTC forced alignment
(the same recursion used by Viterbi-style CTC segmentation tools), not
open-vocabulary decoding. The target sequence comes from the known passage
text (packages/content-schema tokenization via Milestone B's imported
words); nothing here ever decodes free text.

Algorithm (classic CTC forced alignment):
  Extend the N-length target label sequence with blanks: L' = [blank, l1,
  blank, l2, blank, ..., lN, blank], length 2N+1. For each time frame t and
  extended-sequence position s, alpha[t][s] is the max log-probability of
  any monotonic alignment of frames 0..t to extended-sequence positions
  0..s that ends exactly at position s at frame t. Valid transitions into
  s at frame t: stay at s, advance from s-1, or skip a blank from s-2 (only
  when s is a real-label position and its label differs from the label two
  positions back, since CTC requires an explicit blank between two
  identical adjacent labels).
"""

from dataclasses import dataclass

import torch


@dataclass
class CharAlignment:
    char: str
    start_frame: int
    end_frame: int  # exclusive


BLANK_ID = 0


def build_extended_sequence(label_ids: list[int]) -> list[int]:
    extended = [BLANK_ID]
    for label_id in label_ids:
        extended.append(label_id)
        extended.append(BLANK_ID)
    return extended


def forced_align(log_probs: torch.Tensor, label_ids: list[int]) -> list[int]:
    """
    log_probs: (num_frames, vocab_size) log-softmax emissions for ONE utterance.
    label_ids: target label ids (no blanks), length N.
    Returns: for each frame, the extended-sequence index (0..2N) it was
    aligned to. Caller maps this back to per-character frame spans.
    """
    if len(label_ids) == 0:
        return []

    extended = build_extended_sequence(label_ids)
    num_frames = log_probs.shape[0]
    num_states = len(extended)

    neg_inf = float("-inf")
    trellis = torch.full((num_frames, num_states), neg_inf)
    backpointer = torch.zeros((num_frames, num_states), dtype=torch.long)

    trellis[0, 0] = log_probs[0, extended[0]]
    if num_states > 1:
        trellis[0, 1] = log_probs[0, extended[1]]

    for t in range(1, num_frames):
        for s in range(num_states):
            candidates = [(trellis[t - 1, s], s)]
            if s >= 1:
                candidates.append((trellis[t - 1, s - 1], s - 1))
            if s >= 2 and extended[s] != BLANK_ID and extended[s] != extended[s - 2]:
                candidates.append((trellis[t - 1, s - 2], s - 2))

            best_prev_score, best_prev_state = max(candidates, key=lambda c: c[0])
            trellis[t, s] = best_prev_score + log_probs[t, extended[s]]
            backpointer[t, s] = best_prev_state

    # Alignment must end at the final label or the trailing blank after it.
    final_candidates = [(trellis[num_frames - 1, num_states - 1], num_states - 1)]
    if num_states >= 2:
        final_candidates.append((trellis[num_frames - 1, num_states - 2], num_states - 2))
    _, state = max(final_candidates, key=lambda c: c[0])

    path = [0] * num_frames
    path[num_frames - 1] = state
    for t in range(num_frames - 1, 0, -1):
        state = int(backpointer[t, state])
        path[t - 1] = state

    return path


def path_to_char_alignments(path: list[int], label_ids: list[int], chars: list[str]) -> list[CharAlignment]:
    """Converts the frame->extended-state path into one span per target
    character (real-label positions in the extended sequence are the odd
    indices: 1, 3, 5, ...)."""
    alignments: list[CharAlignment] = []

    for label_index, char in enumerate(chars):
        state = 2 * label_index + 1  # position of this label in the extended sequence
        frames = [t for t, s in enumerate(path) if s == state]
        if not frames:
            # No frame was assigned to this label at all — treat as a
            # zero-width span immediately after the previous character
            # (can legitimately happen for a very short/skipped sound).
            start = alignments[-1].end_frame if alignments else 0
            alignments.append(CharAlignment(char=char, start_frame=start, end_frame=start))
            continue
        alignments.append(CharAlignment(char=char, start_frame=min(frames), end_frame=max(frames) + 1))

    assert len(alignments) == len(label_ids) == len(chars)
    return alignments

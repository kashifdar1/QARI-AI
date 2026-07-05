"""Correctness tests for the CTC forced-alignment DP, using hand-constructed
synthetic logits (NOT audio, NOT a real model) — this verifies the
algorithm itself is correct, independent of the ASR checkpoint.
"""

import torch

from app.ctc_alignment import build_extended_sequence, forced_align, path_to_char_alignments

BLANK, A, B = 0, 1, 2


def make_log_probs(preferred_per_frame: list[int], vocab_size: int = 3, confidence: float = 20.0) -> torch.Tensor:
    """Builds a (num_frames, vocab_size) log-softmax tensor where frame t
    overwhelmingly favors label preferred_per_frame[t]."""
    logits = torch.full((len(preferred_per_frame), vocab_size), -confidence)
    for t, label in enumerate(preferred_per_frame):
        logits[t, label] = confidence
    return torch.log_softmax(logits, dim=-1)


def test_build_extended_sequence_interleaves_blanks():
    assert build_extended_sequence([A, B]) == [BLANK, A, BLANK, B, BLANK]


def test_aligns_a_then_b_to_the_correct_frames():
    # frame: 0=blank, 1=A, 2=blank, 3=B, 4=blank
    log_probs = make_log_probs([BLANK, A, BLANK, B, BLANK])
    path = forced_align(log_probs, [A, B])

    alignments = path_to_char_alignments(path, [A, B], ["a", "b"])
    assert alignments[0].char == "a"
    assert alignments[0].start_frame <= 1 < alignments[0].end_frame
    assert alignments[1].char == "b"
    assert alignments[1].start_frame <= 3 < alignments[1].end_frame
    # 'a' must be fully before 'b'.
    assert alignments[0].end_frame <= alignments[1].start_frame


def test_aligns_a_held_across_multiple_frames():
    # A is spoken for 3 frames in a row before B.
    log_probs = make_log_probs([A, A, A, B, B])
    path = forced_align(log_probs, [A, B])
    alignments = path_to_char_alignments(path, [A, B], ["a", "b"])

    assert alignments[0].start_frame == 0
    assert alignments[0].end_frame == 3
    assert alignments[1].start_frame == 3
    assert alignments[1].end_frame == 5


def test_repeated_identical_labels_require_an_intervening_blank():
    # Target "aa" (two A's in a row) — CTC topology requires the path to
    # pass through a blank between the two occurrences, or they'd collapse
    # into one. Audio: A, A, blank, A, A.
    log_probs = make_log_probs([A, A, BLANK, A, A])
    path = forced_align(log_probs, [A, A])
    alignments = path_to_char_alignments(path, [A, A], ["a", "a"])

    # The two 'a' spans must not overlap — the blank at frame 2 is what
    # separates them.
    assert alignments[0].end_frame <= alignments[1].start_frame


def test_single_character_target():
    log_probs = make_log_probs([A, A, A])
    path = forced_align(log_probs, [A])
    alignments = path_to_char_alignments(path, [A], ["a"])
    assert alignments[0].start_frame == 0
    assert alignments[0].end_frame == 3


def test_empty_target_returns_empty_path():
    log_probs = make_log_probs([BLANK, BLANK])
    assert forced_align(log_probs, []) == []

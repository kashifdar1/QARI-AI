import torch

from app.word_alignment import align_words

BLANK, PIPE, A, B = 0, 1, 2, 3
CHAR_TO_ID = {"|": PIPE, "a": A, "b": B}


def make_log_probs(preferred_per_frame: list[int], vocab_size: int = 4, confidence: float = 20.0) -> torch.Tensor:
    logits = torch.full((len(preferred_per_frame), vocab_size), -confidence)
    for t, label in enumerate(preferred_per_frame):
        logits[t, label] = confidence
    return torch.log_softmax(logits, dim=-1)


def test_aligns_two_words_with_a_word_boundary_between_them():
    # "a" then "b" as two separate one-letter words, separated by '|'.
    # frames: a, a, |, b, b
    log_probs = make_log_probs([A, A, PIPE, B, B])
    words = align_words(log_probs, ["a", "b"], CHAR_TO_ID, audio_duration_ms=1000)

    assert len(words) == 2
    assert words[0].word_index == 0
    assert words[0].display_text == "a"
    assert words[1].word_index == 1
    assert words[1].display_text == "b"
    # First word ends before or at the same point the second word starts.
    assert words[0].end_ms <= words[1].start_ms
    # Timings scale into the requested duration.
    assert 0 <= words[0].start_ms < words[1].end_ms <= 1000


def test_higher_confidence_word_has_a_less_negative_avg_log_prob():
    # "a" is spoken clearly (frames strongly prefer A); "b" is spoken
    # ambiguously (logits roughly split between B and blank).
    log_probs = torch.log_softmax(
        torch.tensor(
            [
                [-20.0, -20.0, 20.0, -20.0],  # a: confident
                [-20.0, -20.0, 20.0, -20.0],  # a: confident
                [20.0, -20.0, -20.0, -20.0],  # |: confident
                [0.0, -20.0, -20.0, 0.5],  # b: ambiguous
            ]
        ),
        dim=-1,
    )
    words = align_words(log_probs, ["a", "b"], CHAR_TO_ID, audio_duration_ms=1000)
    assert words[0].avg_log_prob > words[1].avg_log_prob


def test_drops_out_of_vocabulary_characters_without_crashing():
    # 'x' is not in CHAR_TO_ID — the word still gets an alignment entry.
    log_probs = make_log_probs([A, A])
    words = align_words(log_probs, ["ax"], CHAR_TO_ID, audio_duration_ms=500)
    assert len(words) == 1
    assert words[0].display_text == "ax"

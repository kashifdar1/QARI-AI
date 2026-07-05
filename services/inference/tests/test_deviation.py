import torch

from app.deviation import generate_issue_candidates, greedy_ctc_decode
from app.word_alignment import WordAlignment

BLANK, PIPE, A, B, C, X = 0, 1, 2, 3, 4, 5
ID_TO_CHAR = {PIPE: "|", A: "a", B: "b", C: "c", X: "x"}


def logits_for_ids(id_sequence: list[int], vocab_size: int = 6, confidence: float = 20.0) -> torch.Tensor:
    logits = torch.full((len(id_sequence), vocab_size), -confidence)
    for t, label in enumerate(id_sequence):
        logits[t, label] = confidence
    return torch.log_softmax(logits, dim=-1)


def word(index: int, text: str, avg_log_prob: float = -0.1) -> WordAlignment:
    return WordAlignment(word_index=index, display_text=text, start_ms=index * 100, end_ms=index * 100 + 90, avg_log_prob=avg_log_prob)


def test_greedy_ctc_decode_collapses_repeats_and_splits_on_word_boundary():
    log_probs = logits_for_ids([A, A, PIPE, B])
    assert greedy_ctc_decode(log_probs, ID_TO_CHAR) == ["a", "b"]


def test_greedy_ctc_decode_drops_blanks():
    log_probs = logits_for_ids([BLANK, A, BLANK, PIPE, BLANK, B, BLANK])
    assert greedy_ctc_decode(log_probs, ID_TO_CHAR) == ["a", "b"]


def test_clean_match_yields_no_candidates():
    words = [word(0, "a"), word(1, "b")]
    log_probs = logits_for_ids([A, PIPE, B])
    candidates = generate_issue_candidates(words, log_probs, ID_TO_CHAR)
    assert candidates == []


def test_omitted_word_yields_an_omission_candidate():
    # Target is a, b, c but the decode only contains a, c — b was omitted.
    words = [word(0, "a"), word(1, "b"), word(2, "c")]
    log_probs = logits_for_ids([A, PIPE, C])
    candidates = generate_issue_candidates(words, log_probs, ID_TO_CHAR)
    assert len(candidates) == 1
    assert candidates[0].kind == "omission"
    assert candidates[0].word_index == 1


def test_substituted_word_yields_a_substitution_candidate():
    words = [word(0, "a"), word(1, "b")]
    log_probs = logits_for_ids([A, PIPE, X])  # 'b' replaced by 'x'
    candidates = generate_issue_candidates(words, log_probs, ID_TO_CHAR)
    assert len(candidates) == 1
    assert candidates[0].kind == "substitution"
    assert candidates[0].word_index == 1


def test_repeated_word_yields_a_repetition_candidate():
    words = [word(0, "a"), word(1, "b")]
    log_probs = logits_for_ids([A, PIPE, A, PIPE, B])  # 'a' said twice
    candidates = generate_issue_candidates(words, log_probs, ID_TO_CHAR)
    assert any(c.kind == "repetition" for c in candidates)


def test_low_confidence_word_flagged_even_if_the_decode_matched():
    words = [word(0, "a"), word(1, "b", avg_log_prob=-10.0)]
    log_probs = logits_for_ids([A, PIPE, B])  # decode matches exactly
    candidates = generate_issue_candidates(words, log_probs, ID_TO_CHAR)
    assert len(candidates) == 1
    assert candidates[0].word_index == 1
    assert candidates[0].kind == "omission"


def test_model_confidence_is_between_0_and_1():
    words = [word(0, "a"), word(1, "b")]
    log_probs = logits_for_ids([A, PIPE, X])
    candidates = generate_issue_candidates(words, log_probs, ID_TO_CHAR)
    for c in candidates:
        assert 0.0 < c.model_confidence <= 1.0

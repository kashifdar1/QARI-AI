"""Maps character-level CTC forced alignment (app/ctc_alignment.py) to
word-level timings + per-word confidence, against the KNOWN target word
sequence (from Milestone B's imported/tokenized ayah words — see
packages/content-schema/src/tokenize.ts). Never against open-decoded text.
"""

from dataclasses import dataclass

import torch

from app.ctc_alignment import CharAlignment, forced_align, path_to_char_alignments

WORD_BOUNDARY_CHAR = "|"


@dataclass
class WordAlignment:
    word_index: int
    display_text: str
    start_ms: int
    end_ms: int
    # Average CTC log-probability across this word's frames — the raw
    # alignment confidence signal deviation.py and the feedback policy
    # consume; NOT a calibrated probability.
    avg_log_prob: float


def _frame_to_ms(frame_index: int, num_frames: int, audio_duration_ms: int) -> int:
    if num_frames == 0:
        return 0
    return round(frame_index / num_frames * audio_duration_ms)


def align_words(
    log_probs: torch.Tensor,
    target_words: list[str],
    char_to_id: dict[str, int],
    audio_duration_ms: int,
) -> list[WordAlignment]:
    """
    log_probs: (num_frames, vocab_size) log-softmax emissions.
    target_words: ordered list of each word's verbatim displayText
      (diacritics intact — see docs/content-tokenization.md). Out-of-vocab
      characters (marks the acoustic model has no symbol for) are dropped
      from the alignment target but do not affect word boundaries.
    """
    flat_chars: list[str] = []
    for i, word in enumerate(target_words):
        if i > 0:
            flat_chars.append(WORD_BOUNDARY_CHAR)
        flat_chars.extend(ch for ch in word if ch in char_to_id)

    label_ids = [char_to_id[ch] for ch in flat_chars]
    path = forced_align(log_probs, label_ids)
    char_alignments = path_to_char_alignments(path, label_ids, flat_chars)

    num_frames = log_probs.shape[0]
    word_alignments: list[WordAlignment] = []
    cursor = 0
    for word_index, word in enumerate(target_words):
        if word_index > 0:
            cursor += 1  # skip the '|' boundary char alignment
        word_char_count = sum(1 for ch in word if ch in char_to_id)
        word_chars: list[CharAlignment] = char_alignments[cursor : cursor + word_char_count]
        cursor += word_char_count

        if not word_chars:
            # Every character in this word was out-of-vocabulary (e.g. a
            # word consisting only of a mark the model has no symbol for).
            prev_end = word_alignments[-1].end_ms if word_alignments else 0
            word_alignments.append(
                WordAlignment(word_index, word, start_ms=prev_end, end_ms=prev_end, avg_log_prob=float("-inf"))
            )
            continue

        start_frame = min(c.start_frame for c in word_chars)
        end_frame = max(c.end_frame for c in word_chars)
        avg_log_prob = sum(
            log_probs[f, label_ids[cursor - word_char_count + i]].item()
            for i, c in enumerate(word_chars)
            for f in range(c.start_frame, max(c.end_frame, c.start_frame + 1))
        ) / max(1, sum(max(1, c.end_frame - c.start_frame) for c in word_chars))

        word_alignments.append(
            WordAlignment(
                word_index=word_index,
                display_text=word,
                start_ms=_frame_to_ms(start_frame, num_frames, audio_duration_ms),
                end_ms=_frame_to_ms(end_frame, num_frames, audio_duration_ms),
                avg_log_prob=avg_log_prob,
            )
        )

    return word_alignments

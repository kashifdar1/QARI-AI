"""Model loading (ADR-001: forced alignment against known text, not open
transcription).

Checkpoint: HamzaSidhu786/wav2vec2-base-word-by-word-quran-asr
  - Wav2Vec2ForCTC fine-tuned specifically on word-level Quran recitation.
  - Apache-2.0 licensed.
  - Character-level vocab covering Uthmani harakat/waqf marks (matches
    packages/content-schema's tokenization, docs/content-tokenization.md).
  - Selected 2026-07-03; see docs/adr/001-architecture-baseline.md and the
    milestone conversation for the model-selection rationale (a CTC model
    was required, not Whisper, because forced alignment needs frame-level
    CTC emissions — Whisper's encoder-decoder architecture doesn't expose
    the same alignment primitive).
"""

from functools import lru_cache

from transformers import Wav2Vec2ForCTC, Wav2Vec2Processor

MODEL_ID = "HamzaSidhu786/wav2vec2-base-word-by-word-quran-asr"
MODEL_BUNDLE_VERSION = "hamzasidhu786-wav2vec2-base-word-by-word-quran-asr-1"
EXPECTED_SAMPLE_RATE = 16_000


@lru_cache(maxsize=1)
def get_processor() -> Wav2Vec2Processor:
    return Wav2Vec2Processor.from_pretrained(MODEL_ID)


@lru_cache(maxsize=1)
def get_model() -> Wav2Vec2ForCTC:
    model = Wav2Vec2ForCTC.from_pretrained(MODEL_ID)
    model.eval()
    return model


def warm_up() -> None:
    """Forces the (slow, network-bound) model download/load to happen once
    at service startup rather than on the first request."""
    get_processor()
    get_model()

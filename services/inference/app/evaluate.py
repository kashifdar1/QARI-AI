"""Real evaluation orchestration: audio quality gate -> CTC forced
alignment against the known passage words -> deviation candidates. This
replaces the Milestone A `evaluate_stub.py` entirely; nothing in this
module is a stub (per CLAUDE.md §7, a stub is only for the still-deferred
pronunciation/tajweed signal — see docs/STUBS.md).
"""

import base64
import io
from dataclasses import dataclass

import numpy as np
import soundfile as sf
import torch

from app.audio_quality import FloatArray, QualityGateResult, run_quality_gate
from app.deviation import IssueCandidate, generate_issue_candidates
from app.model import EXPECTED_SAMPLE_RATE, MODEL_BUNDLE_VERSION, get_model, get_processor
from app.word_alignment import WordAlignment, align_words


class AudioDecodeError(Exception):
    pass


@dataclass
class EvaluationOutcome:
    attempt_id: str
    model_bundle_version: str
    status: str  # 'completed' | 'needs_rerecord'
    audio_quality: QualityGateResult
    word_segments: list[WordAlignment]
    issue_candidates: list[IssueCandidate]


def decode_wav_base64(audio_base64: str) -> tuple[FloatArray, int]:
    try:
        raw_bytes = base64.b64decode(audio_base64, validate=True)
        samples, sample_rate = sf.read(io.BytesIO(raw_bytes), dtype="float32", always_2d=False)
    except Exception as exc:  # noqa: BLE001 - re-raised as a typed, caller-facing error
        raise AudioDecodeError(f"Could not decode audio: {exc}") from exc

    if samples.ndim > 1:
        samples = samples.mean(axis=1).astype(np.float32)  # downmix to mono if somehow stereo
    return samples, sample_rate


def evaluate_attempt(attempt_id: str, target_words: list[str], audio_base64: str) -> EvaluationOutcome:
    samples, sample_rate = decode_wav_base64(audio_base64)

    if sample_rate != EXPECTED_SAMPLE_RATE:
        raise AudioDecodeError(
            f"Expected {EXPECTED_SAMPLE_RATE}Hz audio (CLAUDE.md §3 capture format), got {sample_rate}Hz"
        )

    quality = run_quality_gate(samples, sample_rate)
    if not quality.passed:
        return EvaluationOutcome(
            attempt_id=attempt_id,
            model_bundle_version=MODEL_BUNDLE_VERSION,
            status="needs_rerecord",
            audio_quality=quality,
            word_segments=[],
            issue_candidates=[],
        )

    processor = get_processor()
    model = get_model()
    vocab = processor.tokenizer.get_vocab()
    char_to_id = {ch: idx for ch, idx in vocab.items() if len(ch) == 1}
    id_to_char = {idx: ch for ch, idx in char_to_id.items()}

    inputs = processor(samples, sampling_rate=sample_rate, return_tensors="pt", padding=True)
    with torch.no_grad():
        logits = model(inputs.input_values).logits[0]  # (num_frames, vocab_size)
    log_probs = torch.log_softmax(logits, dim=-1)

    audio_duration_ms = round(len(samples) / sample_rate * 1000)
    word_segments = align_words(log_probs, target_words, char_to_id, audio_duration_ms)
    issue_candidates = generate_issue_candidates(word_segments, log_probs, id_to_char)

    return EvaluationOutcome(
        attempt_id=attempt_id,
        model_bundle_version=MODEL_BUNDLE_VERSION,
        status="completed",
        audio_quality=quality,
        word_segments=word_segments,
        issue_candidates=issue_candidates,
    )

"""Qari AI inference service entrypoint.

ML baseline (ADR-001): forced alignment against the KNOWN target text —
not open transcription. As of Milestone C, POST /v1/evaluate is a real
implementation (see app/evaluate.py): a Quran-fine-tuned Wav2Vec2ForCTC
checkpoint (app/model.py), CTC forced alignment (app/ctc_alignment.py,
app/word_alignment.py), and deviation candidate generation
(app/deviation.py). Nothing in this request path is a stub.
"""

import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

from app.evaluate import AudioDecodeError, EvaluationOutcome, evaluate_attempt
from app.model import warm_up

logger = logging.getLogger("qari.inference")


@asynccontextmanager
async def lifespan(_app: FastAPI) -> AsyncIterator[None]:
    logger.info("Loading ASR checkpoint...")
    warm_up()
    logger.info("ASR checkpoint loaded.")
    yield


app = FastAPI(title="qari-inference", lifespan=lifespan)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


class EvaluateRequest(BaseModel):
    attempt_id: str
    target_words: list[str]
    audio_base64: str


class WordSegmentDto(BaseModel):
    word_index: int
    start_ms: int
    end_ms: int


class IssueCandidateDto(BaseModel):
    word_index: int
    kind: str
    model_confidence: float


class AudioQualityDto(BaseModel):
    passed: bool
    duration_seconds: float
    silence_ratio: float
    clipped_sample_ratio: float
    estimated_snr_db: float
    failure_reasons: list[str]


class EvaluateResponse(BaseModel):
    attempt_id: str
    model_bundle_version: str
    status: str
    audio_quality: AudioQualityDto
    word_segments: list[WordSegmentDto]
    issue_candidates: list[IssueCandidateDto]


def _to_response(outcome: EvaluationOutcome) -> EvaluateResponse:
    return EvaluateResponse(
        attempt_id=outcome.attempt_id,
        model_bundle_version=outcome.model_bundle_version,
        status=outcome.status,
        audio_quality=AudioQualityDto(**vars(outcome.audio_quality)),
        word_segments=[
            WordSegmentDto(word_index=w.word_index, start_ms=w.start_ms, end_ms=w.end_ms)
            for w in outcome.word_segments
        ],
        issue_candidates=[
            IssueCandidateDto(word_index=c.word_index, kind=c.kind, model_confidence=c.model_confidence)
            for c in outcome.issue_candidates
        ],
    )


@app.post("/v1/evaluate", response_model=EvaluateResponse)
def evaluate(request: EvaluateRequest) -> EvaluateResponse:
    try:
        outcome = evaluate_attempt(request.attempt_id, request.target_words, request.audio_base64)
    except AudioDecodeError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return _to_response(outcome)

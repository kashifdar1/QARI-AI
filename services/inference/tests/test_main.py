import base64
import io
from pathlib import Path

import numpy as np
import soundfile as sf
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)

SOURCE_PATH = Path(__file__).resolve().parents[3] / "content-import" / "sources" / "tanzil-uthmani-v1.1.txt"


def load_ayah_words(sura: int, aya: int) -> list[str]:
    """Reads the real, checksum-tracked Tanzil source file at runtime
    rather than embedding Quranic Arabic as a literal in test code
    (Principle 1 applies to test fixtures too)."""
    prefix = f"{sura}|{aya}|"
    for line in SOURCE_PATH.read_text(encoding="utf-8").splitlines():
        if line.startswith(prefix):
            return line.split("|", 2)[2].strip().split()
    raise ValueError(f"Ayah {sura}:{aya} not found in source file")


def wav_base64(samples: np.ndarray, sample_rate: int = 16_000) -> str:
    buffer = io.BytesIO()
    sf.write(buffer, samples, sample_rate, format="WAV", subtype="PCM_16")
    return base64.b64encode(buffer.getvalue()).decode("ascii")


def test_health() -> None:
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_evaluate_rejects_silent_audio_as_needs_rerecord_via_the_real_quality_gate() -> None:
    """This exercises the REAL quality gate (no ML stub) — a genuinely
    silent clip must never reach the model."""
    samples = np.zeros(16_000 * 3, dtype=np.float32)
    response = client.post(
        "/v1/evaluate",
        json={
            "attempt_id": "attempt-1",
            "target_words": ["placeholder"],
            "audio_base64": wav_base64(samples),
        },
    )
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "needs_rerecord"
    assert body["audio_quality"]["passed"] is False
    assert any("mostly_silent" in r for r in body["audio_quality"]["failure_reasons"])
    # No alignment was attempted on a rejected clip.
    assert body["word_segments"] == []
    assert body["issue_candidates"] == []


def test_evaluate_runs_the_real_model_on_a_clip_that_passes_the_quality_gate() -> None:
    """Proves the REAL Wav2Vec2ForCTC checkpoint runs end-to-end (forward
    pass + forced alignment) on real (non-silent, non-recitation) audio —
    this is a tone, not speech, so no claim is made about recognition
    *accuracy* here, only that the real inference path executes without a
    stub anywhere in it."""
    duration_s = 2.0
    sample_rate = 16_000
    t = np.linspace(0, duration_s, int(sample_rate * duration_s), endpoint=False)
    envelope = (np.sin(2 * np.pi * 1.5 * t) > 0).astype(np.float32)
    samples = (0.3 * np.sin(2 * np.pi * 220 * t) * envelope).astype(np.float32)

    target_words = load_ayah_words(1, 1)  # Al-Fatihah 1:1, real imported text
    response = client.post(
        "/v1/evaluate",
        json={
            "attempt_id": "attempt-2",
            "target_words": target_words,
            "audio_base64": wav_base64(samples),
        },
    )
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "completed"
    assert body["model_bundle_version"] == "hamzasidhu786-wav2vec2-base-word-by-word-quran-asr-1"
    assert len(body["word_segments"]) == len(target_words)
    assert body["word_segments"][0]["start_ms"] >= 0
    assert body["word_segments"][-1]["end_ms"] <= round(duration_s * 1000)


def test_evaluate_rejects_the_wrong_sample_rate() -> None:
    samples = np.zeros(8_000 * 2, dtype=np.float32)
    response = client.post(
        "/v1/evaluate",
        json={
            "attempt_id": "attempt-3",
            "target_words": ["placeholder"],
            "audio_base64": wav_base64(samples, sample_rate=8_000),
        },
    )
    assert response.status_code == 400

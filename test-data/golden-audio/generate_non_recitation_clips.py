"""Generates the NON-RECITATION golden-corpus clips only (silence, white
noise, a too-short tone, and a clipped tone) — per CLAUDE.md Stub Policy and
the Milestone C instruction: "If you cannot legitimately obtain [recitation]
clips, generate ONLY the non-recitation cases ... and report the recitation
clips as a blocker for the human owner — never synthesize recitation
audio." No clip generated here is or resembles Quran recitation; see
README.md for the full corpus manifest and the blocker this leaves open.

Run with: services/inference/.venv/bin/python test-data/golden-audio/generate_non_recitation_clips.py
"""

import wave
from pathlib import Path

import numpy as np

SAMPLE_RATE = 16_000
OUTPUT_DIR = Path(__file__).parent


def write_wav(filename: str, samples: np.ndarray) -> None:
    path = OUTPUT_DIR / filename
    clipped = np.clip(samples, -1.0, 1.0)
    pcm16 = (clipped * 32767).astype(np.int16)
    with wave.open(str(path), "wb") as f:
        f.setnchannels(1)
        f.setsampwidth(2)
        f.setframerate(SAMPLE_RATE)
        f.writeframes(pcm16.tobytes())
    print(f"wrote {path} ({len(samples) / SAMPLE_RATE:.2f}s)")


def main() -> None:
    rng = np.random.default_rng(2026)

    # 1. Pure silence — should fail the quality gate's silence-ratio check.
    write_wav("silent.wav", np.zeros(SAMPLE_RATE * 3, dtype=np.float32))

    # 2. White noise — should fail the SNR check (no signal above the noise floor).
    write_wav("white_noise.wav", rng.normal(0, 0.3, SAMPLE_RATE * 3).astype(np.float32))

    # 3. A tone far too short to be a recitation attempt.
    t_short = np.linspace(0, 0.2, int(SAMPLE_RATE * 0.2), endpoint=False)
    write_wav("too_short_tone.wav", (0.3 * np.sin(2 * np.pi * 440 * t_short)).astype(np.float32))

    # 4. A heavily clipped tone — should fail the clipping check.
    t_clip = np.linspace(0, 2, SAMPLE_RATE * 2, endpoint=False)
    clipped_tone = 3.0 * np.sin(2 * np.pi * 440 * t_clip)  # amplitude > 1 -> clips hard
    write_wav("clipped_tone.wav", clipped_tone.astype(np.float32))


if __name__ == "__main__":
    main()

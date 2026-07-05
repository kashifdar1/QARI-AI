"""Audio quality gate — pure signal processing, no ML model involved.
Runs BEFORE forced alignment; a failing clip is routed to `needs_rerecord`
with specific guidance rather than being sent through (expensive, and
meaningless) alignment.
"""

from dataclasses import dataclass

import numpy as np
import numpy.typing as npt

FloatArray = npt.NDArray[np.float32]

MIN_DURATION_SECONDS = 0.5
MAX_DURATION_SECONDS = 90.0
MAX_SILENCE_RATIO = 0.97  # a clip that's >97% silence has no recitation in it
CLIPPING_AMPLITUDE_THRESHOLD = 0.99  # int16-normalized amplitude near full-scale
MAX_CLIPPED_SAMPLE_RATIO = 0.01
MIN_SNR_DB = 5.0
SILENCE_AMPLITUDE_THRESHOLD = 0.01


@dataclass
class QualityGateResult:
    passed: bool
    duration_seconds: float
    silence_ratio: float
    clipped_sample_ratio: float
    estimated_snr_db: float
    failure_reasons: list[str]


FRAME_SIZE_SAMPLES = 400  # 25ms at 16kHz


def _estimate_snr_db(samples: FloatArray, silence_mask: npt.NDArray[np.bool_]) -> float:
    """Frame-energy-percentile SNR estimate: split the clip into short
    frames, take each frame's RMS energy, and treat the quietest 10th
    percentile of frames as the noise floor and the loudest 90th
    percentile as signal-plus-noise. This is robust to loud broadband
    noise (a fixed instantaneous-amplitude silence threshold, tried first,
    breaks down exactly there — high-amplitude noise samples don't fall
    below any fixed "silence" cutoff, so there's no noise-only region to
    measure against). `silence_mask` is unused here but kept in the
    signature since a mostly-silent clip is caught by the silence-ratio
    check upstream, not this one.
    """
    del silence_mask
    num_frames = len(samples) // FRAME_SIZE_SAMPLES
    if num_frames < 2:
        return float("inf")

    frame_energies = np.array(
        [
            np.mean(samples[i * FRAME_SIZE_SAMPLES : (i + 1) * FRAME_SIZE_SAMPLES] ** 2)
            for i in range(num_frames)
        ]
    )
    noise_power = float(np.percentile(frame_energies, 10))
    signal_power = float(np.percentile(frame_energies, 90))

    if noise_power <= 1e-12:
        return float("inf") if signal_power > 0 else 0.0
    return float(10 * np.log10(max(signal_power, 1e-12) / noise_power))


def run_quality_gate(samples: FloatArray, sample_rate: int) -> QualityGateResult:
    """
    samples: float32 array normalized to [-1, 1], mono.
    """
    duration_seconds = len(samples) / sample_rate if sample_rate > 0 else 0.0
    silence_mask = np.abs(samples) < SILENCE_AMPLITUDE_THRESHOLD
    silence_ratio = float(np.mean(silence_mask)) if samples.size > 0 else 1.0
    clipped_ratio = (
        float(np.mean(np.abs(samples) >= CLIPPING_AMPLITUDE_THRESHOLD)) if samples.size > 0 else 0.0
    )
    snr_db = _estimate_snr_db(samples, silence_mask)

    reasons: list[str] = []
    if duration_seconds < MIN_DURATION_SECONDS:
        reasons.append(f"too_short: {duration_seconds:.2f}s < {MIN_DURATION_SECONDS}s minimum")
    if duration_seconds > MAX_DURATION_SECONDS:
        reasons.append(f"too_long: {duration_seconds:.2f}s > {MAX_DURATION_SECONDS}s maximum")
    if silence_ratio > MAX_SILENCE_RATIO:
        reasons.append(f"mostly_silent: {silence_ratio:.1%} of the clip is silence")
    if clipped_ratio > MAX_CLIPPED_SAMPLE_RATIO:
        reasons.append(f"clipping: {clipped_ratio:.1%} of samples are clipped")
    if snr_db < MIN_SNR_DB and silence_ratio < MAX_SILENCE_RATIO:
        reasons.append(f"noisy: estimated SNR {snr_db:.1f}dB < {MIN_SNR_DB}dB minimum")

    return QualityGateResult(
        passed=len(reasons) == 0,
        duration_seconds=duration_seconds,
        silence_ratio=silence_ratio,
        clipped_sample_ratio=clipped_ratio,
        estimated_snr_db=snr_db,
        failure_reasons=reasons,
    )

import numpy as np

from app.audio_quality import run_quality_gate

SAMPLE_RATE = 16_000


def sine(freq_hz: float, duration_s: float, amplitude: float = 0.3) -> np.ndarray:
    t = np.linspace(0, duration_s, int(SAMPLE_RATE * duration_s), endpoint=False)
    return (amplitude * np.sin(2 * np.pi * freq_hz * t)).astype(np.float32)


def speech_like(duration_s: float, amplitude: float = 0.3, noise_std: float = 0.001) -> np.ndarray:
    """A tone with intermittent pauses — a closer proxy for real speech's
    amplitude envelope (bursts separated by quiet gaps) than a continuous
    tone, which the frame-energy-percentile SNR estimate needs to have a
    measurable noise floor at all."""
    rng = np.random.default_rng(7)
    num_samples = int(SAMPLE_RATE * duration_s)
    t = np.linspace(0, duration_s, num_samples, endpoint=False)
    envelope = (np.sin(2 * np.pi * 1.5 * t) > 0).astype(np.float32)  # on/off bursts
    signal = amplitude * np.sin(2 * np.pi * 220 * t) * envelope
    noise = rng.normal(0, noise_std, size=num_samples)
    return (signal + noise).astype(np.float32)


def test_silence_fails_the_quality_gate():
    samples = np.zeros(SAMPLE_RATE * 3, dtype=np.float32)
    result = run_quality_gate(samples, SAMPLE_RATE)
    assert not result.passed
    assert any("mostly_silent" in r for r in result.failure_reasons)


def test_too_short_clip_fails():
    samples = sine(220, duration_s=0.1)
    result = run_quality_gate(samples, SAMPLE_RATE)
    assert not result.passed
    assert any("too_short" in r for r in result.failure_reasons)


def test_clipped_signal_fails():
    samples = np.clip(sine(220, duration_s=2, amplitude=3.0), -1.0, 1.0).astype(np.float32)
    result = run_quality_gate(samples, SAMPLE_RATE)
    assert not result.passed
    assert any("clipping" in r for r in result.failure_reasons)
    assert result.clipped_sample_ratio > 0


def test_clean_speech_like_signal_passes():
    samples = speech_like(duration_s=3, amplitude=0.4, noise_std=0.001)
    result = run_quality_gate(samples, SAMPLE_RATE)
    assert result.passed
    assert result.failure_reasons == []


def test_heavily_noisy_signal_fails_snr_check():
    samples = speech_like(duration_s=3, amplitude=0.05, noise_std=0.2)
    result = run_quality_gate(samples, SAMPLE_RATE)
    assert not result.passed
    assert any("noisy" in r for r in result.failure_reasons)


def test_duration_and_ratios_are_reported_even_when_passing():
    samples = speech_like(duration_s=2, amplitude=0.4, noise_std=0.001)
    result = run_quality_gate(samples, SAMPLE_RATE)
    assert result.duration_seconds == 2.0
    assert 0.0 <= result.silence_ratio <= 1.0
    assert 0.0 <= result.clipped_sample_ratio <= 1.0

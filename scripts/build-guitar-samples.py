"""Build six independent reference tones from Wavebase's public-domain samples.

Source: https://github.com/cluesurf/wave/tree/make/base/guitar/stratocaster
The six source files are real, clean electric-guitar recordings. Downloads are
cached in the system temp directory, not committed to this repository.
"""
import math
import struct
import tempfile
import wave
from pathlib import Path
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
AUDIO_DIR = ROOT / "public/audio"
SOURCE_ROOT = "https://github.com/cluesurf/wave/raw/make/base/guitar/stratocaster"
RATE = 32000
LENGTH = 3.0
# Target pitches use equal temperament with A4 = 440 Hz.
SOURCES = [
    ("e2", "string-6-E-as-E2.wav", 82.41),
    ("a2", "string-5-A-as-A2.wav", 110.00),
    ("d3", "string-4-D-as-D3.wav", 146.83),
    ("g3", "string-3-G-as-G3.wav", 196.00),
    ("b3", "string-2-B-as-B3.wav", 246.94),
    ("e4", "string-1-E-as-E4.wav", 329.63),
]


def download(filename):
    cache = Path(tempfile.gettempdir()) / "wavebase-guitar" / filename
    if not cache.exists():
        cache.parent.mkdir(parents=True, exist_ok=True)
        request = Request(f"{SOURCE_ROOT}/{filename}", headers={"User-Agent": "WorkBuddy-Guitar-Tuner/1.0"})
        with urlopen(request, timeout=60) as response:
            data = response.read()
        if not data.startswith(b"RIFF"):
            raise ValueError(f"Invalid WAV response for {filename}")
        cache.write_bytes(data)
    return cache


def read_wav(path):
    with wave.open(str(path), "rb") as source:
        rate, channels, width = source.getframerate(), source.getnchannels(), source.getsampwidth()
        raw = source.readframes(source.getnframes())
    if width != 4:
        raise ValueError(f"Expected 32-bit PCM, got {width * 8}-bit: {path.name}")
    values = struct.unpack("<" + "i" * (len(raw) // 4), raw)
    mono = [sum(values[i:i + channels]) / (channels * 2147483648.0)
            for i in range(0, len(values), channels)]
    return rate, mono


def rms(samples):
    return math.sqrt(sum(value * value for value in samples) / len(samples)) if samples else 0.0


def find_onset(samples, rate):
    size = int(rate * 0.005)
    envelopes = [rms(samples[i:i + size]) for i in range(0, len(samples) - size, size)]
    threshold = max(0.002, max(envelopes) * 0.025)
    return next(index * size / rate for index, level in enumerate(envelopes) if level > threshold)


def build_clip(samples, source_rate, pitch_ratio=1.0):
    onset = find_onset(samples, source_rate)
    start = max(0, int((onset - 0.015) * source_rate))
    source_length = math.ceil(LENGTH * source_rate * pitch_ratio) + 2
    clip = samples[start:start + source_length]
    if len(clip) < source_length:
        clip += [0.0] * (source_length - len(clip))

    output = []
    for index in range(int(RATE * LENGTH)):
        position = index * source_rate * pitch_ratio / RATE
        left = int(position)
        fraction = position - left
        output.append(clip[left] * (1 - fraction) + clip[min(left + 1, len(clip) - 1)] * fraction)

    fade_in = int(RATE * 0.008)
    fade_out = int(RATE * 0.18)
    for index in range(fade_in):
        output[index] *= index / fade_in
    for index in range(fade_out):
        output[-1 - index] *= index / fade_out
    peak = max(abs(value) for value in output) or 1.0
    gain = min(4.0, 0.88 / peak)
    return [round(value * gain * 32767) for value in output], onset, gain


def measure_frequency(samples, target):
    start, end = int(RATE * 0.15), int(RATE * 0.8)
    section = samples[start:end]
    mean = sum(section) / len(section)
    section = [value - mean for value in section]
    best_score, best_lag = -1.0, 0
    scores = []
    for lag in range(int(RATE / (target * 1.25)), int(RATE / (target * 0.75))):
        correlation = sum(section[i] * section[i + lag] for i in range(0, len(section) - lag, 2))
        scores.append((lag, correlation))
        if correlation > best_score:
            best_score, best_lag = correlation, lag
    index = best_lag - scores[0][0]
    if 0 < index < len(scores) - 1:
        left, center, right = scores[index - 1][1], scores[index][1], scores[index + 1][1]
        denominator = left - 2 * center + right
        if denominator:
            return RATE / (best_lag + 0.5 * (left - right) / denominator)
    return RATE / best_lag


def main():
    AUDIO_DIR.mkdir(parents=True, exist_ok=True)
    for note, filename, target_frequency in SOURCES:
        source_rate, samples = read_wav(download(filename))
        uncalibrated, _, _ = build_clip(samples, source_rate)
        source_frequency = measure_frequency([value / 32768 for value in uncalibrated], target_frequency)
        pcm, onset, gain = build_clip(samples, source_rate, target_frequency / source_frequency)
        output = AUDIO_DIR / f"guitar-{note}.wav"
        with wave.open(str(output), "wb") as target:
            target.setnchannels(1)
            target.setsampwidth(2)
            target.setframerate(RATE)
            target.writeframes(struct.pack("<" + "h" * len(pcm), *pcm))
        measured = measure_frequency([value / 32768 for value in pcm], target_frequency)
        print(f"{note.upper()}: {output.name} | {LENGTH:.1f}s | {measured:.2f}Hz -> {target_frequency:.2f}Hz | gain {gain:.2f}")


if __name__ == "__main__":
    main()

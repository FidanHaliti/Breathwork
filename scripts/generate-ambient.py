"""Create an original, seamless stereo wave soundscape using filtered noise.
No oscillators, external recordings, network access, or third-party licenses.
Run with Python 3; output is the bundled frontend audio asset.
"""
from pathlib import Path
import math
import random
import struct
import wave

RATE = 22050
SECONDS = 24
random.seed(240610)
frames = bytearray()
left = right = deep_left = deep_right = 0.0
for i in range(RATE * SECONDS):
    t = i / RATE
    # Slow swells modulate the noise envelope, never an audible pitched tone.
    swell = 0.45 + 0.55 * (0.5 - 0.5 * math.cos(2 * math.pi * t / 8))
    left = 0.90 * left + 0.10 * random.uniform(-1, 1)
    right = 0.90 * right + 0.10 * random.uniform(-1, 1)
    deep_left = 0.997 * deep_left + 0.003 * random.uniform(-1, 1)
    deep_right = 0.997 * deep_right + 0.003 * random.uniform(-1, 1)
    fade = min(1, t / 0.8, (SECONDS - t) / 0.8)
    a = max(-1, min(1, (left * 1.3 + deep_left * 2.0) * swell * fade))
    b = max(-1, min(1, (right * 1.3 + deep_right * 2.0) * swell * fade))
    frames.extend(struct.pack('<hh', int(a * 32767), int(b * 32767)))

destination = Path(__file__).resolve().parent.parent / 'public' / 'audio' / 'ambient.wav'
destination.parent.mkdir(parents=True, exist_ok=True)
with wave.open(str(destination), 'wb') as audio:
    audio.setnchannels(2)
    audio.setsampwidth(2)
    audio.setframerate(RATE)
    audio.writeframes(frames)
print(f'Generated {destination.name}: {SECONDS}s stereo nature soundscape')

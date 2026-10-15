"""Original noise-based ambient textures. No external recordings or licenses.
Circular crossfade joins each loop without a silent gap.
"""
from pathlib import Path
import math
import random
import struct
import wave

RATE = 22050
LENGTH = 24 * RATE
OVERLAP = 2 * RATE
destination = Path(__file__).resolve().parent.parent / 'public' / 'audio'
for kind, seed, smoothing in [('rain', 715, .45), ('stream', 716, .83), ('wind', 717, .98)]:
    rng = random.Random(seed)
    channels = []
    for channel in range(2):
        samples = []
        low = deep = 0
        for i in range(LENGTH + OVERLAP):
            t = i / RATE
            noise = rng.uniform(-1, 1)
            low = smoothing * low + (1 - smoothing) * noise
            deep = .996 * deep + .004 * noise
            if kind == 'rain':
                value = low * (.48 + .03 * math.sin(t * .7)) + deep * .3
            elif kind == 'stream':
                value = low * (.85 + .14 * math.sin(t * 2.7) * math.sin(t * 1.3)) + deep
            else:
                value = (low * 1.5 + deep * 2) * (.65 + .3 * math.sin(t * .6))
            samples.append(value)
        for i in range(OVERLAP):
            weight = .5 - .5 * math.cos(math.pi * i / (OVERLAP - 1))
            samples[i] = samples[LENGTH + i] * (1 - weight) + samples[i] * weight
        channels.append(samples[:LENGTH])
    frames = bytearray()
    for a, b in zip(*channels):
        frames.extend(struct.pack('<hh', int(max(-1, min(1, a)) * 32767), int(max(-1, min(1, b)) * 32767)))
    with wave.open(str(destination / f'{kind}.wav'), 'wb') as audio:
        audio.setnchannels(2)
        audio.setsampwidth(2)
        audio.setframerate(RATE)
        audio.writeframes(frames)
    print(f'Generated {kind}.wav')

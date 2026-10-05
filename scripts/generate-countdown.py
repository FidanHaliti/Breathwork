"""Generate the five bundled Albanian countdown clips (one-time asset tooling).

Requires edge-tts and imageio-ffmpeg. Normal app builds need neither Python nor
network TTS access. Voice: Microsoft's Albanian sq-AL-AnilaNeural.
"""
import asyncio
from array import array
import json
from pathlib import Path
import subprocess
import sys
import wave

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / '.audio-tools'))
import edge_tts
import imageio_ffmpeg

WORDS = {5: 'pesë', 4: 'katër', 3: 'tre', 2: 'dy', 1: 'një'}
VOICE = 'sq-AL-AnilaNeural'
RATE = 24000

async def main():
    work = ROOT / '.audio-work'
    output = ROOT / 'public' / 'audio' / 'countdown'
    work.mkdir(exist_ok=True)
    output.mkdir(parents=True, exist_ok=True)
    voices = await edge_tts.list_voices()
    selected = next((voice for voice in voices if voice['ShortName'] == VOICE and voice['Locale'] == 'sq-AL'), None)
    if not selected:
        raise RuntimeError('The requested Albanian voice is unavailable; do not substitute another language.')
    manifest = {'voice': VOICE, 'locale': 'sq-AL', 'kind': 'synthetic speech', 'clips': []}
    for number, word in WORDS.items():
        original = work / f'sq-{number}.mp3'
        await edge_tts.Communicate(word, voice=VOICE, rate='+5%').save(str(original))
        result = subprocess.run([imageio_ffmpeg.get_ffmpeg_exe(), '-v', 'error', '-i', str(original), '-f', 's16le', '-ac', '1', '-ar', str(RATE), '-'], check=True, capture_output=True)
        samples = array('h', result.stdout)
        # Preserve quiet consonants: trim only low-level outer silence, with padding.
        threshold = 90
        first = next((i for i, sample in enumerate(samples) if abs(sample) > threshold), None)
        last = next((i for i in range(len(samples) - 1, -1, -1) if abs(samples[i]) > threshold), None)
        if first is None or last is None:
            raise RuntimeError(f'Empty spoken audio for {word}')
        padding = int(RATE * 0.035)
        samples = samples[max(0, first-padding):min(len(samples), last+padding+1)]
        peak = max(abs(sample) for sample in samples)
        scale = 0.78 * 32767 / peak
        samples = array('h', (int(sample * scale) for sample in samples))
        duration = len(samples) / RATE
        if duration > 0.95:
            raise RuntimeError(f'{word} lasts {duration:.3f}s; shorten the voice rate rather than clipping speech.')
        destination = output / f'sq-{number}.wav'
        with wave.open(str(destination), 'wb') as audio:
            audio.setnchannels(1)
            audio.setsampwidth(2)
            audio.setframerate(RATE)
            audio.writeframes(samples.tobytes())
        manifest['clips'].append({'number': number, 'word': word, 'file': destination.name, 'durationSeconds': round(duration, 4)})
        print(f'{destination.name}: {duration:.3f}s', flush=True)
    (output / 'source.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')

if __name__ == '__main__':
    asyncio.run(main())

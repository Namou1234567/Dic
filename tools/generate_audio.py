#!/usr/bin/env python3
"""Generate recordings for vocabulary entries that do not have audio yet.

Uses the same voices as the existing recordings:
- Mandarin: Kokoro-82M-v1.1-zh, voice zf_001, speed 0.95 (synthesized locally)
- Lao: Microsoft lo-LA-ChanthavongNeural through edge-tts (online)

New clips are appended to newly numbered bank files so existing banks stay
unchanged. Run from the repository root:

    python3 tools/generate_audio.py

Requirements: Node.js, FFmpeg, numpy, edge-tts, kokoro and misaki[zh].
"""

import asyncio
import json
import re
import subprocess
import sys
import tempfile
from pathlib import Path

import numpy as np

SAMPLE_RATE = 24000
BANK_SIZE = 50
LANGUAGES = {
    'zh': {
        'manifest': Path('audio/manifest.js'),
        'variable': 'NAMOU_VOICE_CLIPS',
        'header': '// Kokoro v1.1-zh, zf_001, speed 0.95. Timings in seconds.\n',
        'bank': 'audio/mandarin-{:02d}.mp3',
        'pattern': re.compile(r'audio/mandarin-(\d+)\.mp3$'),
        'gap': 0.7,
        'bitrate': '48k',
    },
    'lao': {
        'manifest': Path('audio/lao/manifest.js'),
        'variable': 'NAMOU_LAO_CLIPS',
        'header': '',
        'bank': 'audio/lao/chanthavong-{:02d}.mp3',
        'pattern': re.compile(r'audio/lao/chanthavong-(\d+)\.mp3$'),
        'gap': 0.6,
        'bitrate': '40k',
    },
}


def read_manifest(path):
    text = path.read_text(encoding='utf-8')
    return json.loads(re.search(r'=\s*(\{.*\});', text, re.S).group(1))


def write_manifest(lang, clips):
    config = LANGUAGES[lang]
    body = json.dumps(clips, ensure_ascii=False, separators=(',', ':'))
    config['manifest'].write_text(
        f"{config['header']}window.{config['variable']} = {body};\n", encoding='utf-8')


def exported_words():
    output = subprocess.run(['node', 'tests/vocabulary.cjs', '--export'],
                            check=True, capture_output=True, text=True).stdout
    return json.loads(output)


def mandarin_input(text):
    """Turn slashes into pauses, drop parenthetical notes and end with a period."""
    text = re.sub(r'[（(][^）)]*[）)]', '', text)
    text = re.sub(r'\s*/\s*', '，', text).strip(' ，')
    if not re.search(r'[。！？.!?]$', text):
        text += '。'
    return text


def decode(path):
    raw = subprocess.run(
        ['ffmpeg', '-v', 'error', '-i', str(path), '-ac', '1', '-ar', str(SAMPLE_RATE),
         '-f', 's16le', '-'], check=True, capture_output=True).stdout
    return np.frombuffer(raw, dtype=np.int16)


def synthesize_mandarin(texts, workdir):
    from kokoro import KPipeline
    import soundfile as sf

    repo = 'hexgrad/Kokoro-82M-v1.1-zh'
    pipeline = KPipeline(lang_code='z', repo_id=repo)
    files = {}
    for index, text in enumerate(texts):
        chunks = [audio for _, _, audio in
                  pipeline(mandarin_input(text), voice='zf_001', speed=0.95)]
        if not chunks:
            raise RuntimeError(f'No Mandarin audio for {text}')
        path = workdir / f'zh-{index:04d}.wav'
        sf.write(path, np.concatenate([np.asarray(c) for c in chunks]), SAMPLE_RATE)
        files[text] = path
        print(f'zh {index + 1}/{len(texts)} {text}', flush=True)
    return files


async def synthesize_lao(texts, workdir):
    import edge_tts

    files = {}
    for index, text in enumerate(texts):
        path = workdir / f'lao-{index:04d}.mp3'
        for attempt in range(5):
            try:
                await edge_tts.Communicate(text, 'lo-LA-ChanthavongNeural').save(str(path))
                if path.stat().st_size > 0:
                    break
            except Exception as error:  # Network hiccups: retry with backoff.
                print(f'retry {attempt + 1} for {text}: {error}', flush=True)
            await asyncio.sleep(2 * (attempt + 1))
        else:
            raise RuntimeError(f'No Lao audio for {text}')
        files[text] = path
        print(f'lao {index + 1}/{len(texts)} {text}', flush=True)
    return files


def bundle(lang, files, clips):
    """Concatenate clips into new banks and record each clip's time range."""
    config = LANGUAGES[lang]
    numbers = [int(config['pattern'].search(c['src']).group(1)) for c in clips.values()]
    next_bank = max(numbers, default=0) + 1
    gap = np.zeros(int(round(config['gap'] * SAMPLE_RATE)), dtype=np.int16)
    items = list(files.items())
    for offset in range(0, len(items), BANK_SIZE):
        src = config['bank'].format(next_bank)
        parts, position = [], 0
        for i, (text, path) in enumerate(items[offset:offset + BANK_SIZE]):
            if i:
                parts.append(gap)
                position += len(gap)
            samples = decode(path)
            clips[text] = {'src': src,
                           'start': round(position / SAMPLE_RATE, 3),
                           'end': round((position + len(samples)) / SAMPLE_RATE, 3)}
            parts.append(samples)
            position += len(samples)
        subprocess.run(
            ['ffmpeg', '-v', 'error', '-y', '-f', 's16le', '-ar', str(SAMPLE_RATE), '-ac', '1',
             '-i', '-', '-c:a', 'libmp3lame', '-b:a', config['bitrate'], src],
            input=np.concatenate(parts).tobytes(), check=True)
        print(f'wrote {src}', flush=True)
        next_bank += 1


def main():
    words = exported_words()
    missing = {}
    for lang, key in (('zh', 'zh'), ('lao', 'lao')):
        clips = read_manifest(LANGUAGES[lang]['manifest'])
        missing[lang] = [text for text in words[key] if text not in clips]
        print(f'{lang}: {len(missing[lang])} entries need audio', flush=True)
    if not any(missing.values()):
        return 0
    with tempfile.TemporaryDirectory() as tmp:
        workdir = Path(tmp)
        for lang in ('lao', 'zh'):
            if not missing[lang]:
                continue
            files = (asyncio.run(synthesize_lao(missing[lang], workdir)) if lang == 'lao'
                     else synthesize_mandarin(missing[lang], workdir))
            clips = read_manifest(LANGUAGES[lang]['manifest'])
            bundle(lang, files, clips)
            write_manifest(lang, clips)
    return 0


if __name__ == '__main__':
    sys.exit(main())

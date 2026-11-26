#!/usr/bin/env python3
"""Generate recordings for vocabulary entries.

Voices (Microsoft neural voices through edge-tts):
- Mandarin: zh-CN-XiaoxiaoNeural, rate -10%
- Lao: lo-LA-ChanthavongNeural, default rate

Entries without a clip are synthesized and appended to newly numbered bank
files, so existing banks stay unchanged. When the voice recorded in a manifest
header differs from the configured voice, every clip of that language is
rebuilt into new bank files (new file names, so phones never mix a cached old
bank with new timings) and the old banks are deleted.

Run from the repository root:

    python3 tools/generate_audio.py

Requirements: Node.js, FFmpeg, numpy and edge-tts. Network access to the
edge-tts service is needed.
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
CONCURRENCY = 16
LANGUAGES = {
    'zh': {
        'manifest': Path('audio/manifest.js'),
        'variable': 'NAMOU_VOICE_CLIPS',
        'voice': 'zh-CN-XiaoxiaoNeural',
        'rate': '-10%',
        'bank': 'audio/mandarin-{:02d}.mp3',
        'pattern': re.compile(r'audio/mandarin-(\d+)\.mp3$'),
        'glob': 'audio/mandarin-*.mp3',
        'gap': 0.7,
        'bitrate': '48k',
    },
    'lao': {
        'manifest': Path('audio/lao/manifest.js'),
        'variable': 'NAMOU_LAO_CLIPS',
        'voice': 'lo-LA-ChanthavongNeural',
        'rate': '+0%',
        'bank': 'audio/lao/chanthavong-{:02d}.mp3',
        'pattern': re.compile(r'audio/lao/chanthavong-(\d+)\.mp3$'),
        'glob': 'audio/lao/chanthavong-*.mp3',
        'gap': 0.6,
        'bitrate': '40k',
        # Existing Lao banks were made with this voice before headers were added.
        'legacy_header_ok': True,
    },
}


def header(lang):
    config = LANGUAGES[lang]
    return f"// Microsoft {config['voice']}, rate {config['rate']}. Timings in seconds.\n"


def read_manifest(lang):
    text = LANGUAGES[lang]['manifest'].read_text(encoding='utf-8')
    return text, json.loads(re.search(r'=\s*(\{.*\});', text, re.S).group(1))


def needs_rebuild(lang, text):
    config = LANGUAGES[lang]
    if text.startswith('//'):
        return text.split('\n', 1)[0] + '\n' != header(lang)
    return not config.get('legacy_header_ok', False)


def write_manifest(lang, clips):
    config = LANGUAGES[lang]
    body = json.dumps(clips, ensure_ascii=False, separators=(',', ':'))
    config['manifest'].write_text(
        f"{header(lang)}window.{config['variable']} = {body};\n", encoding='utf-8')


def exported_words():
    output = subprocess.run(['node', 'tests/vocabulary.cjs', '--export'],
                            check=True, capture_output=True, text=True).stdout
    return json.loads(output)


def speech_text(lang, text):
    """Mandarin: drop parenthetical notes and turn slashes into pauses."""
    if lang != 'zh':
        return text
    text = re.sub(r'[（(][^）)]*[）)]', '', text)
    return re.sub(r'\s*/\s*', '，', text).strip(' ，') or text


def decode(path):
    raw = subprocess.run(
        ['ffmpeg', '-v', 'error', '-i', str(path), '-ac', '1', '-ar', str(SAMPLE_RATE),
         '-f', 's16le', '-'], check=True, capture_output=True).stdout
    return np.frombuffer(raw, dtype=np.int16)


def trim(samples, lead=0.12, tail=0.15):
    """Trim long silences around speech, keeping a short margin on both sides."""
    if not len(samples):
        return samples
    level = np.abs(samples.astype(np.int32))
    loud = np.nonzero(level > max(1, level.max()) * 0.003)[0]  # about -50 dB
    if not len(loud):
        return samples
    start = max(0, loud[0] - int(lead * SAMPLE_RATE))
    end = min(len(samples), loud[-1] + int(tail * SAMPLE_RATE))
    return samples[start:end]


async def synthesize(lang, texts, workdir):
    import edge_tts

    config = LANGUAGES[lang]
    semaphore = asyncio.Semaphore(CONCURRENCY)
    files = {}
    done = 0

    async def one(index, text):
        nonlocal done
        path = workdir / f'{lang}-{index:05d}.mp3'
        async with semaphore:
            for attempt in range(6):
                try:
                    await edge_tts.Communicate(speech_text(lang, text), config['voice'],
                                               rate=config['rate']).save(str(path))
                    if path.stat().st_size > 0:
                        break
                except Exception as error:  # Network hiccups or throttling: retry with backoff.
                    print(f'retry {attempt + 1} for {text}: {error}', flush=True)
                await asyncio.sleep(2 * (attempt + 1))
            else:
                raise RuntimeError(f'No audio for {text}')
        files[text] = path
        done += 1
        if done % 100 == 0 or done == len(texts):
            print(f'{lang} {done}/{len(texts)}', flush=True)

    await asyncio.gather(*(one(i, t) for i, t in enumerate(texts)))
    return {text: files[text] for text in texts}  # Keep vocabulary order in the banks.


def bundle(lang, files, clips, next_bank):
    """Concatenate clips into new banks and record each clip's time range."""
    config = LANGUAGES[lang]
    gap = np.zeros(int(round(config['gap'] * SAMPLE_RATE)), dtype=np.int16)
    items = list(files.items())
    written = []
    for offset in range(0, len(items), BANK_SIZE):
        src = config['bank'].format(next_bank)
        parts, position = [], 0
        for i, (text, path) in enumerate(items[offset:offset + BANK_SIZE]):
            if i:
                parts.append(gap)
                position += len(gap)
            samples = trim(decode(path))
            clips[text] = {'src': src,
                           'start': round(position / SAMPLE_RATE, 3),
                           'end': round((position + len(samples)) / SAMPLE_RATE, 3)}
            parts.append(samples)
            position += len(samples)
        subprocess.run(
            ['ffmpeg', '-v', 'error', '-y', '-f', 's16le', '-ar', str(SAMPLE_RATE), '-ac', '1',
             '-i', '-', '-c:a', 'libmp3lame', '-b:a', config['bitrate'], src],
            input=np.concatenate(parts).tobytes(), check=True)
        written.append(src)
        next_bank += 1
    print(f'{lang}: wrote {len(written)} bank(s)', flush=True)
    return written


def main():
    words = exported_words()
    for lang, key in (('zh', 'zh'), ('lao', 'lao')):
        config = LANGUAGES[lang]
        text, clips = read_manifest(lang)
        existing = sorted(Path('.').glob(config['glob']))
        numbers = [int(config['pattern'].search(p.as_posix()).group(1)) for p in existing]
        next_bank = max(numbers, default=0) + 1
        rebuild = needs_rebuild(lang, text)
        if rebuild:
            print(f'{lang}: voice changed, rebuilding all {len(words[key])} clips', flush=True)
            clips = {}
        missing = [t for t in words[key] if t not in clips]
        print(f'{lang}: {len(missing)} entries need audio', flush=True)
        if not missing and not rebuild:
            continue
        with tempfile.TemporaryDirectory() as tmp:
            files = asyncio.run(synthesize(lang, missing, Path(tmp)))
            written = bundle(lang, files, clips, next_bank)
        if rebuild:
            for path in existing:
                if path.as_posix() not in written:
                    path.unlink()
        write_manifest(lang, clips)
    return 0


if __name__ == '__main__':
    sys.exit(main())

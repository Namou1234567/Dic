# Bilingual vocabulary audio

The current public vocabulary requires 2,278 Lao clips and 2,233 Mandarin clips. Clips are grouped by language into MP3 files. The site loads audio on demand and uses the clip manifests to play the requested segment.

| Language | Voice and generation method | Files |
|---|---|---|
| Mandarin | Kokoro-82M-v1.1-zh, female voice `zf_001`, speed 0.95, synthesized locally | `mandarin-*.mp3`, `manifest.js` |
| Lao | Microsoft Lao male voice `lo-LA-ChanthavongNeural`, synthesized online with `edge-tts` and then bundled | `lao/chanthavong-*.mp3`, `lao/manifest.js` |

[Kokoro model](https://huggingface.co/hexgrad/Kokoro-82M-v1.1-zh) · [Kokoro model license](MODEL-LICENSE.txt) · [edge-tts project](https://github.com/rany2/edge-tts)

## Adding entries or regenerating audio

The quickest way is automatic: push a branch that changes `vocabulary.js`. The **Generate missing audio** workflow (`.github/workflows/audio.yml`) runs `tools/generate_audio.py` on GitHub, synthesizes only the entries that have no clip yet with the voices above, writes them to newly numbered banks, updates both manifests, and commits the result back to the branch. Commits made by the workflow do not start other workflows, so push one more commit (an empty commit is fine) to rerun **Dictionary checks** on the pull request. You can also run the script locally with network access to Hugging Face and the edge-tts service.

The manual steps below describe what the script does.


1. From the repository root, run `node tests/vocabulary.cjs --export > /tmp/namou-words.json` to export deduplicated `zh` and `lao` text arrays. Use the exported text verbatim as manifest keys, preserving spelling, punctuation, and meanings.
2. Synthesize each Mandarin entry with the Kokoro Chinese pipeline (`lang_code='z'`). In the synthesis input, turn slashes into pauses, remove parenthetical notes, and add a period at the end. Synthesize Lao entries individually, for example with `edge-tts --voice lo-LA-ChanthavongNeural --text 'ສະບາຍດີ' --write-media hello.mp3`. The generation environment needs access to the relevant model or service.
3. Use FFmpeg to decode clips to 24 kHz mono, then concatenate at most 50 clips per bank. Leave 0.7 seconds of silence between Mandarin clips and encode the MP3 at 48 kbps. For Lao, leave 0.6 seconds and encode at 40 kbps. Put small additions in a newly numbered file to avoid rebuilding a whole bank.
4. Calculate the start and end times in seconds from the sample positions during concatenation. Exclude the silence between clips from each clip's boundaries. Assign the Mandarin manifest to `window.NAMOU_VOICE_CLIPS` and the Lao manifest to `window.NAMOU_LAO_CLIPS`. Each record looks like `{"src":"audio/mandarin-01.mp3","start":0,"end":1.15}`. Paths are relative to the site root.
5. Submit the audio and manifests together. Run `node tests/vocabulary.cjs`, then listen to a sample of new entries, the first and last clips, and entries with multiple meanings from both search and flashcards. The automated check verifies coverage and time ranges. Listen to clips to verify pronunciation.

If a personal Chinese meaning has no recording, the site tries the browser's built-in Chinese voice. Lao playback requires a corresponding recording.

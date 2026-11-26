# Xiao Cidian (小词典)

A Lao–Chinese learning aid for the Nam Ou hydropower station. Search in Lao, Chinese, or pinyin, listen to recordings in both languages, and study flashcards by work or everyday-life category. Missed words go to a review list.

[Open the online dictionary](https://namou1234567.github.io/Dic/)

Study progress and missed words are saved only in the user's own browser.

## Files

| Contents | Location |
|---|---|
| Pages, search, flashcards, and playback | `index.html` |
| Vocabulary | `vocabulary.js` |
| Recordings and clip manifests | `audio/` |
| Recording generator | `tools/generate_audio.py` |
| Lao font, pinyin library, and their licenses | `fonts/`, `vendor/` |
| Checks | `tests/`, `.github/workflows/` |

## Updating the vocabulary

1. Edit `vocabulary.js`. Each entry has a Lao headword (`lao`), Chinese meaning (`zh`), and category (`cat`: `工作` or `生活`). Separate several Chinese meanings with `；`.
2. Push the change to a branch other than `main`. The **Generate missing audio** workflow records the new entries and commits the audio to the branch. Push one more commit (an empty one is fine) so **Dictionary checks** runs on the result.
3. Raise the version number in `index.html` (`dict-version`) and the `?v=` values on its `<script>` tags, so phones load the new files and show the update banner.
4. Open a pull request, wait for **Dictionary checks**, and merge.

## Recordings

| Language | Voice | Files |
|---|---|---|
| Mandarin | Microsoft `zh-CN-XiaoxiaoNeural`, rate -10% | `audio/mandarin-*.mp3`, `audio/manifest.js` |
| Lao | Microsoft `lo-LA-ChanthavongNeural` | `audio/lao/chanthavong-*.mp3`, `audio/lao/manifest.js` |

Recordings are made with [edge-tts](https://github.com/rany2/edge-tts) and packed up to 50 clips per MP3 file. The manifests store each clip's file and time range. `tools/generate_audio.py` records only the entries without a clip and puts them in new files. If the voice in the script changes, it re-records that whole language. A Chinese meaning that a user adds personally is read by the browser's own voice.

## Local checks

Requires Node.js and FFmpeg.

```sh
node tests/vocabulary.cjs
npm install --no-save --package-lock=false playwright@1.65.1
npx playwright install chromium webkit
python3 -m http.server 8765 &
node tests/browser.cjs
```

[Changelog](CHANGELOG.md)

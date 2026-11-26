# Xiao Cidian (小词典)

A Lao–Chinese learning aid for the Nam Ou hydropower station. Search in Lao, Chinese, or pinyin, listen to bilingual recordings, and study flashcards by work or everyday-life category. The review list keeps track of missed words.

[Open the online dictionary](https://namou1234567.github.io/Dic/)

The site is published through GitHub Pages. The vocabulary and public recordings ship with the site. Study progress and missed words are saved in the current browser.

## Maintenance and publishing

1. Edit entries in `vocabulary.js`. Separate distinct Chinese meanings with a full-width semicolon (`；`). Each entry contains the Lao headword (`lao`), Chinese meaning (`zh`), and category (`cat`). Use `工作` (work) or `生活` (everyday life) as the category value. When adding a meaning to an existing headword, keep its original spelling so the site can combine the meanings.
2. When adding or changing Lao spellings or Chinese meanings, update the audio files and manifests together using the [audio maintenance guide](audio/README.md). A category-only change does not require new recordings.
3. After changing `vocabulary.js` or files under `audio/`, update the `?v=` cache version on the corresponding `<script>` URLs in `index.html`. Mobile browsers may otherwise keep using an older cached version.
4. From the repository root, run `node tests/vocabulary.cjs`. This requires Node.js and FFmpeg, including `ffprobe`.
5. Preview locally with `python3 -m http.server 8765` and check search, categories, and pronunciation. In another terminal, run the playback checks below. Install both Chromium and WebKit with `npx playwright install chromium webkit` before running the mobile playback test.

   ```sh
   npm install --no-save --package-lock=false playwright@1.65.1
   npx playwright install chromium webkit
   node tests/study-audio.cjs
   node tests/mobile-audio.cjs
   ```

6. Open a pull request on GitHub. Check **Dictionary checks**, then verify the live site after merging.

## File locations

| Contents | Location |
|---|---|
| Pages, search, flashcards, and playback | `index.html` |
| Public vocabulary | `vocabulary.js` |
| Mandarin and Lao audio and clip manifests | `audio/` |
| Lao fonts and license | `fonts/` |
| Pinyin library and license | `vendor/` |
| Automated checks | `tests/`, `.github/workflows/check.yml` |

[View the changelog](CHANGELOG.md)

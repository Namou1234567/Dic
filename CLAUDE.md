# Working on this repository

Xiao Cidian (小词典) is a static Lao–Chinese dictionary for Nam Ou hydropower station staff, published with GitHub Pages at https://namou1234567.github.io/Dic/. See README.md for the file layout and CHANGELOG.md for history.

## Collaboration rules

- Talk with the owner in Chinese.
- Write everything that goes to GitHub in English: branch names, commit messages, pull requests, releases, documentation, code comments and test messages. Keep the Chinese and Lao interface text and vocabulary data as they are.
- Work on a branch and open a pull request. Merge only after the owner says "发布".
- Never force-push or rewrite history.
- Preserve users' personal learning data (localStorage keys such as `lao_custom_v12`, the missed-word list and study progress) when changing storage code.
- Keep the owner's private email address and credentials out of commits and files.

## Changing vocabulary or audio

- Several Chinese meanings of one Lao headword are written as one slash-separated text, for example `洗手间/厕所`. The recording reads them together with a pause at each slash.
- Pushing a change to `vocabulary.js` or `tools/generate_audio.py` on a branch runs the **Generate missing audio** workflow, which records new entries and commits the audio back. That commit does not trigger other workflows, so push one more commit (an empty one is fine) to run **Dictionary checks** on the pull request.
- Voices: Mandarin `zh-CN-XiaoxiaoNeural` at rate -10%, Lao `lo-LA-ChanthavongNeural`.
- When vocabulary or audio changes, raise `dict-version` in `index.html` and the `?v=` values on its script tags, so phones load the new files and show the update banner. Add a CHANGELOG entry.
- Run `node tests/vocabulary.cjs`, and `node tests/browser.cjs` with the site served on port 8765, before opening a pull request.

## After a release

Keep the repository tidy: one release, one Actions run and one deployment record per minor version (1.1, 1.2, 1.3, …). After merging, delete the extra workflow runs and old deployment records, and delete merged branches.

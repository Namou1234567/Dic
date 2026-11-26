# Changelog

## 1.1.2 · 2026-11-26

- Store only personal entries, additional meanings, missed headwords, and study progress locally. Migrate legacy storage and support importing older backups.
- Reuse up to four decoded audio banks on mobile and share concurrent requests for the same bank.
- Render flashcard meanings and pinyin as plain text. Update the reset message and the displayed version number. See [#20](https://github.com/Namou1234567/Dic/pull/20).

## 1.1.1 · 2026-11-25 · Stable

- Fix Lao and Mandarin playback on iPhone and iPad and add mobile playback tests. See [#18](https://github.com/Namou1234567/Dic/pull/18).
- Add shuffled flashcards within the selected category while preserving ordered study progress and missed words. See [#19](https://github.com/Namou1234567/Dic/pull/19).
- Fit all five study controls on one row at the tested mobile widths. Enlarge the flip hint and adjust card spacing and text hierarchy.
- Move the repository to `Namou1234567/Dic` and update the [online dictionary link](https://namou1234567.github.io/Dic/).

## 1.1.0 · 2026-11-24

- Update Lao–Chinese meanings from the revised vocabulary sheet and incorporate common hydropower station terms. The public vocabulary contains 1,938 headwords, including 906 work and 1,032 everyday-life entries. See [#17](https://github.com/Namou1234567/Dic/pull/17).
- Standardize the Lao spellings for “equality” and “pay/settle the bill.” Keep only “water level” as the meaning of `ລະດັບນ້ຳ`.
- Add bilingual recordings and move the public vocabulary to `vocabulary.js`. Preserve existing browser study progress and missed words.

## 1.0.0 · 2026-11-24

Stable baseline. See the [corresponding commit](https://github.com/Namou1234567/Dic/commit/f118635e3afb60dede9d7d1df5ac096aeda55e8d).

- Support Lao, Chinese, and pinyin search and combine the Chinese meanings of identical Lao headwords. See [#6](https://github.com/Namou1234567/Dic/pull/6), [#9](https://github.com/Namou1234567/Dic/pull/9), and [#10](https://github.com/Namou1234567/Dic/pull/10).
- Provide Mandarin and Lao audio, support Android playback, and add tap feedback. See [#4](https://github.com/Namou1234567/Dic/pull/4), [#11](https://github.com/Namou1234567/Dic/pull/11), [#12](https://github.com/Namou1234567/Dic/pull/12), and [#13](https://github.com/Namou1234567/Dic/pull/13).
- Include 1,438 entries, with 446 work and 992 everyday-life entries. Fix a bug where the Chinese audio button could play Lao after a card was flipped. See [#14](https://github.com/Namou1234567/Dic/pull/14) and [#15](https://github.com/Namou1234567/Dic/pull/15).

[Full commit history](https://github.com/Namou1234567/Dic/commits/main/)

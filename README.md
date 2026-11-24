# 小词典

南欧江水电站学习好帮手。支持用老挝语、中文和拼音查词，并提供双语朗读、工作与生活分类背诵及错题本。

[打开线上小词典](https://amyko2222-lang.github.io/Namou/)

网站由 GitHub Pages 发布。词库和公共词条音频随网站发布，学习进度和错题保存在当前浏览器。

## 维护和发布

1. 在 `vocabulary.js` 中维护词条。多个独立中文译义用全角分号「；」分隔。每条包含老挝语 `lao`、中文译义 `zh` 和分类 `cat`。分类使用「工作」或「生活」。已有老挝语词条的新增译义沿用原拼写，网页会合并译义。
2. 新增或改动老挝语拼写、中文译义时，按[音频维护说明](audio/README.md)同步音频文件与对应表。仅调整分类时无须重新生成音频。
3. 在仓库根目录运行 `node tests/vocabulary.cjs`。需要 Node.js 和 FFmpeg（含 `ffprobe`）。
4. 用 `python3 -m http.server 8765` 在本机预览。检查搜索、分类和朗读。可另开终端运行以下命令复测翻卡朗读。

   ```sh
   npm install --no-save --package-lock=false playwright@1.65.1
   npx playwright install chromium
   node tests/study-audio.cjs
   ```

5. 在 GitHub 提交审阅请求。查看 **Dictionary checks** 的结果，合并后核对线上页面。

## 文件位置

| 内容 | 位置 |
|---|---|
| 页面、搜索、背诵和播放 | `index.html` |
| 公开词库 | `vocabulary.js` |
| 中老双语音频和词条对应表 | `audio/` |
| 老挝语字体及许可 | `fonts/` |
| 拼音库及许可 | `vendor/` |
| 自动检查 | `tests/`、`.github/workflows/check.yml` |

[查看版本记录](CHANGELOG.md)

# 双语词库配音

1.0.0 版本包含 1,438 段老挝语和 1,474 段普通话，分别打包在 29 和 30 个 MP3 文件中。网页按需加载音频，根据词条对应表播放指定片段。

| 语言 | 声音和生成方式 | 文件 |
|---|---|---|
| 普通话 | Kokoro-82M-v1.1-zh，女声 `zf_001`，语速 0.95，本地合成 | `mandarin-*.mp3`、`manifest.js` |
| 老挝语 | 微软老挝语男声 `lo-LA-ChanthavongNeural`，通过 `edge-tts` 在线合成后打包 | `lao/chanthavong-*.mp3`、`lao/manifest.js` |

[Kokoro 模型](https://huggingface.co/hexgrad/Kokoro-82M-v1.1-zh) · [Kokoro 模型许可](MODEL-LICENSE.txt) · [edge-tts 项目](https://github.com/rany2/edge-tts)

## 新增词条或重新制作音频

1. 从仓库根目录运行 `node tests/vocabulary.cjs --export > /tmp/namou-words.json`，得到去重后的 `zh` 和 `lao` 文本数组。对应表的键使用导出的原文，保留原来的拼写、标点和译义。
2. 普通话使用 Kokoro 的中文管线（`lang_code='z'`）逐条合成。对送入语音模型的文本，把斜线改为停顿，去掉括号里的补充说明，句末加句号。老挝语逐条合成，例如 `edge-tts --voice lo-LA-ChanthavongNeural --text 'ສະບາຍດີ' --write-media hello.mp3`。此步骤需要生成环境访问相应的模型或服务。
3. 用 FFmpeg 将片段解码为 24 kHz 单声道，按每组最多 50 段拼接。普通话片段间留 0.7 秒静音，按 48 kbps 编码 MP3。老挝语留 0.6 秒，按 40 kbps 编码。新增少量词时可放入新编号的音频文件，避免重做已有整组。
4. 根据拼接时的采样位置计算每段起止秒数，边界排除段间静音。普通话文件赋值给 `window.NAMOU_VOICE_CLIPS`，老挝语赋值给 `window.NAMOU_LAO_CLIPS`。每条记录形如 `{"src":"audio/mandarin-01.mp3","start":0,"end":1.15}`。路径相对于网页根目录。
5. 音频和对应表放在同一个变更里。运行 `node tests/vocabulary.cjs`，并从搜索和背诵分别抽听新词、首尾片段及多译义词条。自动检查能验证覆盖和时间范围，音频读音需抽听。

个人新增的中文译义如果没有录音，网页会尝试浏览器系统中文语音。老挝语需要加入对应录音后才能播放。

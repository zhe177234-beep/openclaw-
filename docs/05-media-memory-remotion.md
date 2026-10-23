# 读图、绘图、记忆与 Remotion

## 一、读图不等于绘图

本次 `2026.10.2` 的配置职责：

| 配置/组件 | 职责 |
| --- | --- |
| 当前会话聊天模型 | 理解文本、规划任务、调用工具 |
| `agents.defaults.imageModel` | 当前聊天模型不能接收图片时，由读图工具使用的视觉模型 |
| `agents.defaults.mediaModels.image` | 图片生成和编辑的模型配置 |
| 记忆 embeddings | 文本向量化、索引和检索，独立于聊天和绘图 |

对话中曾使用 `agents.defaults.imageGenerationModel` 查询，实际报未知路径。按固定版本文档应查询：

```bash
openclaw config get agents.defaults.mediaModels.image
```

`Config path is valid but unset` 表示使用运行时默认值，不等于工具不存在。

## 二、这次图片生成实际用了什么

完整日志显示：

```text
image auth selected: provider=openai mode=oauth transport=codex-responses
requestModel=gpt-image-2 responsesModel=gpt-6-astra
```

DeepSeek 发起了图片工具调用；OpenAI OAuth 路径执行绘图。最初失败为 `ECONNREFUSED`，调整分流之后出现保存的 PNG 路径，并明确记录 `successful generation`。

随后发生 `completion wake failed`、`send_attempt_started` 与回传 TLS 错误。已经生成的图片应优先重发，避免无必要重复生成：

```text
请把刚才已生成并保存的头像 PNG 作为图片发送到当前聊天。
不要重新生成；若发送失败，报告实际错误，并保留本地文件。
```

不能只凭有本地附件路径，就断言微信投递已经成功；也不能把 completion wake 超时一概归因于绘图失败。需分开检查生成、完成通知、媒体上传和消息投递。

## 三、配置读图模型（尚待手机验证）

本次已给出但未收到执行成功证据的配置方法：

```bash
openclaw models list --provider openai
openclaw models set-image openai/gpt-6-astra
openclaw config validate
```

先确认模型目录和账号支持图像输入；示例标识不能保证每个账号都可用。设置不应改变当前微信会话的 SCNet 聊天选择。重启网关后重新发送原图，先要求描述人物发型、服装、姿势，不立即生成新图。

此外，本次自定义 SCNet 模型配置没有声明图像输入能力。不能因此推断平台上的模型本身绝对不支持视觉，也不能只加 `input: ["text", "image"]` 就获得上游没有的能力；需要平台能力说明和真实图像请求验证。

## 四、记忆报错（未解决）

日志曾出现：

```text
openai embeddings failed (429)
type=insufficient_quota
code=credit_balance_exhausted
```

会影响向量索引/检索，不能解释为本地文本记忆文件一定丢失。GPT 聊天授权、SCNet Token Plan 与 OpenAI embeddings API 额度是不同资源。不要因为聊天能回复，就假定所有辅助服务都已经有额度。

后续可选择有可用额度的 embedding 服务、验证过的本地方案，或在确定准确配置键后停用不需要的向量检索。本仓库未擅自关闭记忆或提供猜测的配置键，也未执行充值。

## 五、Remotion MV：目标和当前阻塞

目标：使用用户本人提供的《把回忆拼好给你》MP3 与 LRC，制作约三分钟歌词 MV。没有收到真实音频、歌词文件和最终渲染日志，因此不能称为已完成。

原始操作包含两个问题：

1. 文件名含空格和括号，`cp` 需要完整引号。
2. Claw 缺少读取共享存储内容的权限；`stat` 成功不意味着 `head` / `cp` 能读取。

如果某个环境已经获得存储权限，正确的引号形式示例是：

```bash
mkdir -p "$HOME/remotion-mv"
cp "/storage/emulated/0/Music/Sulune/把回忆拼好给你 - 王贰浪 (超高).lrc" "$HOME/remotion-mv/"
cp "/storage/emulated/0/Music/Sulune/把回忆拼好给你 - 王贰浪 (超高).mp3" "$HOME/remotion-mv/"
```

在本次原 Claw 环境里，仅改引号仍会遭遇权限限制。当前可操作的绕行方案是通过浏览器文件选择器导入：

```bash
node scripts/upload-files.cjs "$HOME/remotion-mv"
```

打开终端打印的 `UPLOAD_URL`（包含临时访问令牌），在同一手机浏览器选择 MP3 与 LRC。服务只监听 `127.0.0.1`，拒绝覆盖文件，不自动执行上传内容。完成后 Ctrl+C 停止该上传服务；不要停止另一个终端里不相关的网关。

### 真正开始制作前的验收顺序

1. 两份文件实际存在、非空、可读取；LRC 时间戳可解析。
2. 测量音频真实时长，确认截取约三分钟的范围；不盲目压缩整首歌或虚构歌词。
3. 使用 `command -v ffmpeg`、`command -v ffprobe`；`which` 不存在并不等于目标程序一定不存在。
4. 检查 Remotion 依赖与当前平台的浏览器/编码器能力，不把桌面 Linux 二进制兼容性当成理所当然。
5. 先渲染 5–10 秒小样，核实音频、字幕、字体和画面，再渲染全片。
6. 最后报告真实 MP4 路径、大小、时长、编码及可播放验证结果。

不能通过当前证据保证 Android 原生环境可完成 Remotion 的全流程渲染。若浏览器或编码器不兼容，应明确指出具体阻塞，保留项目，改用已经验证的电脑/云端渲染环境，不宣称手机已导出成片。

更完整的执行提示词见 [prompts/remotion-mv.md](../prompts/remotion-mv.md)。仓库不包含歌曲录音或歌词全文。

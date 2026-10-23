# 本次聊天与部署过程总结

记录日期：2026-10-23，北京时间。以下是按目标、证据与最终状态整理的过程，不是逐字聊天备份。图中的个人账号、二维码和凭据均未收录。

## 1. 原始目标：在安卓手机上使用 GPT 智能体

用户最初只想使用 GPT。OpenClaw 检测到机器安装了 Codex 和 Claude Code，但最初登录状态未验证。用户选择 OpenAI，再选择 Codex 设备码登录。

第一次设备码申请被阻断：`resolves to private/internal/special-use IP address`。当时代理软件的 FakeDNS 开启；调整网络之后设备码申请成功，浏览器授权完成。截图不足以证明所有同类错误都由 FakeDNS 引起，不能推广为唯一原因。

初始化显示推理校验通过，配置模型标识为 `openai/gpt-6-astra`，工作区和会话目录创建成功。安卓环境缺少 systemd 用户服务，服务安装被跳过。随后 TUI 提示 `ECONNREFUSED 127.0.0.1:18789`，原因是没有可连接的网关；在另一个终端前台启动网关后出现 `ready`。

## 2. 新目标：保留 Claude Code 操作方式，改用其他模型

用户希望保留 Claude Code 读文件、写代码、执行命令的工作方式，但底层调用 GPT 或其他模型。最终选择已购买的 SCNet DeepSeek 服务。

用户平台给出的信息：

| 项目 | 本次使用值 |
| --- | --- |
| Anthropic 兼容 Base URL | `https://api.scnet.cn/api/llm/anthropic` |
| OpenAI 兼容 Base URL（另一个协议入口） | `https://api.scnet.cn/api/llm/v1` |
| 实际在 Claude Code 成功使用的模型 ID | `DeepSeek-V4.1-Flash-1017-Event` |
| 密钥来源 | 用户平台 Token Plan；未纳入仓库 |

对话中另一个 AI 曾给出小写模型名，但用户平台截图和最终成功配置使用上面的完整 ID。以平台可复制的模型标识和实际响应为准。

## 3. Claude Code 在安卓上的启动修复

捆绑原生程序 `claude.exe` 报 `invalid ELF header`。检查后，原安装目录没有可用的 `cli.js`。改为在私有目录安装 JS 版 Claude Code `2.1.63`，通过 Node 启动；`--version` 正常返回。

之后出现 `UND_ERR_INVALID_ARG`、`ECONNRESET`、TLS 握手前断开。网络测试中 curl 一度失败，一度返回 `200`，说明链路条件并不固定。重新进入会话、清除显式代理环境变量并使用可连通 SCNet 的网络后，命令行最小请求返回 `OK`。

随后验证智能体工具：

1. 生成 `hello.js` 成功。
2. Bash 初始化报 `No suitable shell found`；修复为当前 App 内的有效 Bash 路径并重启会话。
3. Bash 再报 `/tmp/claude-...` 无权限；在启动进程前设置 `TMPDIR` 和 `CLAUDE_CODE_TMPDIR`。
4. 最终 Bash 执行 `node hello.js`，实际输出“你好，DeepSeek”。

该证据说明：模型调用、文件写入和一次真实本地命令执行已跑通，不代表手机全部文件都可访问。

## 4. 启动快捷命令与退出

用户希望新终端输入 `claude` 或 `Claude` 即可启动。最初脚本粘贴不完整，出现 `then/else/fi` 语法错误、`start-deepseek.sh` 和 `key.env` 缺失；补齐私有密钥文件、启动脚本和包装命令后，用户确认成功。

GPT 的 `gpt` / `GPT` 快捷命令本质是 `openclaw tui` 的别名，仍依赖网关。两个名称分别启动不同客户端，不是安装两个本地大模型。

用户还希望单次 Esc 退出。实际 Esc 用于中断、菜单退出或回退；普通退出使用 `/exit`，或者按界面提示 Ctrl+C。没有实际完成单 Esc 退出重映射。

## 5. 描述优势时的措辞修正

建议描述为：安卓终端接入云端 GPT，Claude Code 接入 DeepSeek，利用手机运行本地工具和轻量项目。优势是可以实际操作获授权的文件与程序，减少在聊天 App 与手工复制代码之间切换。

不应称作“满血 ChatGPT 完整本地部署”，也不能说 GPT/DeepSeek 推理使用手机 CPU。云端模型与本地执行是两部分。

## 6. 微信 ClawBot 接入中的三个连续阻塞

用户希望微信连接**第一次配置的 GPT/OpenClaw**，而不是连接另一套 Claude Code。官方一键命令曾报 `weixin-install: not found`，因此使用 OpenClaw 原生插件安装。

### 阻塞 A：临时目录祖先所有者校验

`temp workspace directory has an untrusted owner`。

手机当前用户与私有临时目录所有者相同、权限为 `700`，但 `/data` 等安卓系统祖先目录属于 UID `1000`，Node 又显示为 `linux`。仅修改 TMPDIR 并不能解决祖先校验。

为指定版本准备了局部兼容补丁：保留私有叶目录检查，识别安卓系统祖先，仅对确认的安卓运行环境应用。补丁先校验、备份、执行自检，再真实创建/读写/清理工作目录；失败还原。

下载到 Download 后因共享存储权限无法读取，改用 `127.0.0.1` 浏览器上传导入私有目录。用户手机输出修复成功。

### 阻塞 B：文件克隆被安卓拒绝

插件安装成功，加载失败：`guarded synchronous file copy failed`。

小文件测试显示 `clone=never` 成功，而 `clone=auto` 的底层错误为 `FICLONE: Permission denied / EACCES`。将该 App 环境中自动同步复制改为普通字节复制，并保留路径/身份/独占创建检查。用户手机执行修复后越过此故障。

### 阻塞 C：插件 SDK 接口已移除

`@tencent-weixin/openclaw-weixin@2.4.8` 无法导入 `openclaw/plugin-sdk/infra-runtime`。核对 npm 包与官方变更记录后，指定安装 `2.4.10`，该版修复 OpenClaw 2026.10 兼容性。

## 7. 微信登录、网关和实际回复

扫码凭据曾保存，但出现配置读取失败，微信页面显示解除连接；先让独立终端网关正常运行，再重试登录。

之后状态为 `Gateway reachable`，微信通道 `enabled, configured, running`。最终微信收到实际文本回复，完整消息链路验证通过。

日志也出现过状态数据库旧租约、恢复队列与未完成投递警告。没有删除状态数据库或证明所有警告永久解决；只记录后续成功启动与回复。

## 8. 模型名称、SCNet 接入与分流

机器人自称 `openai/gpt-6-astra`，部分日志却包含 `gpt-5.6-luna`。这些请求可能涉及主任务、辅助任务或恢复流程；不能只凭一个日志行或模型自我介绍断言当前回复由哪个模型完成。需要结合 `/model status`、会话及对应 run 的日志。

SCNet 先在 Claude Code 配置成功，后来再单独接入 OpenClaw。会话提示：`for this session only; configured default unchanged`，说明只是当前会话切换，默认模型不变。

第一次调用发生 TLS 连接重置。未带密钥的网络测试先报 `ECONNRESET`，后来返回 HTTP `400`。`400` 仅说明收到 HTTP 响应，不能证明密钥或模型调用成功；其后 `provider=scnet status=200` 才提供了实际模型调用证据。

用户使用 NekBox。截图显示只代理勾选应用，但 Claw 没有勾选；自定义规则把 SCNet 直连与 OpenAI 代理分开。后续图片任务还需要让微信 API/CDN 明确直连。

## 9. 图片生成、回传和读图

图片生成最初对 OpenAI 连接被拒绝。完整日志表明：OpenAI `gpt-image-2`，OAuth 登录路径，`responsesModel=gpt-6-astra`；并不是 DeepSeek 自己生成图像。

代理分流调整后，日志出现 PNG 附件与成功生成记录，但异步完成通知/投递超时。用户随后转述“图片已经收到”，又遇到当前聊天模型不能读图、缺少视觉模型配置的提示。

配置查询曾误用了旧名称 `agents.defaults.imageGenerationModel`。按本次 `2026.10.2` 版本核对后：

- `agents.defaults.mediaModels.image`：生成图片。查询有效但未设置时，运行时默认值适用。
- `agents.defaults.imageModel`：聊天模型无法接收图片时的读图工具模型。

早期给出了 `openclaw models set-image openai/gpt-6-astra`。归档后，用户于 2026-10-23 补充确认：“识图功能和生图功能都已成功。”因此，两项功能现记录为用户实测成功；最终采用的视觉模型标识、配置和新日志未提供，不把早期建议当成最终实际配置。

## 10. Remotion MV 与自动执行的边界

用户希望用《把回忆拼好给你》的 MP3 和 LRC 制作约 3 分钟 MV。原始 `cp` 文件名含空格，未完整加引号；同时 Claw 缺少共享存储读取权限。Claude Code 反复执行路径搜索和系统命令，但 `head` 明确报 `Permission denied`。

`stat` 找到文件不等于可读取。建议停止无效重试，用浏览器文件选择器上传到 `~/remotion-mv/`，再验证素材和渲染依赖。没有收到素材上传成功、Remotion 项目生成、预览或成片证据。

用户希望执行不再逐项确认，给出 `claude --dangerously-skip-permissions --continue`。这属于 Claude Code 操作审批设置，**不会获得安卓共享存储权限**。没有修改 Claw APK，也没有 Root 手机。

## 最终结论

本次成果是：安卓上的 OpenClaw 网关、GPT 接入、SCNet DeepSeek 编程助手、微信通道、会话模型切换，以及用户最新实测确认成功的识图和生图功能。待完成的是：长期媒体投递稳定性验证、记忆服务修复、共享存储长期访问方案，以及 Remotion MV 的素材导入和真实渲染。

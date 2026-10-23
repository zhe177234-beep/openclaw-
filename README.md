# 安卓 OpenClaw：GPT、DeepSeek、Claude Code 与微信实践记录

借助 OpenClaw 的安卓终端环境，在手机上接入 GPT，并运行以 SCNet DeepSeek 为底层模型的 Claude Code 编程助手。它可以读写**已经获得权限的**本地项目文件、修改代码、执行命令并验证结果。没有电脑时，也能利用手机 CPU 和运行环境完成轻量开发与自动化任务，同时需要管理文件权限、凭据和数据安全。

**这是一次真实聊天与终端排障过程的整理，记录日期为 2026-10-23（北京时间）。不是完整安卓 App 源码，也不是“一键安装即可保证成功”的安装器。** 模型推理主要在云端进行，手机运行网关、工具和本地程序；“接入 GPT”不等于把 ChatGPT 官方 App 或整个模型部署到了手机。

## 实际完成到哪里

| 功能 | 本次记录中的状态 | 依据与边界 |
| --- | --- | --- |
| OpenClaw 接入 OpenAI | 已验证 | 设备码登录完成，初始化推理校验通过 |
| Claude Code 接入 SCNet DeepSeek | 已验证 | JS 版 Claude Code 2.1.63 启动；创建 `hello.js`，Bash 执行后实际输出“你好，DeepSeek” |
| 微信 ClawBot 接入 OpenClaw | 已验证 | 插件 2.4.10 加载，通道 `enabled, configured, running`；微信收到回复 |
| 微信会话切换 SCNet DeepSeek | 已验证 | `/model` 选择成功，后续日志 `provider=scnet`、`status=200` |
| 图片生成 | 已验证生成 | 日志出现 PNG 路径及 `successful generation`；异步完成通知和回传曾发生超时、TLS 错误 |
| 微信图片回传 | 部分证据 | 对话后续出现“图片已经收到”的转述，但并未提供最终投递成功日志，不能据此保证长期稳定 |
| GPT 作为读图模型 | 待验证 | 已给出 `models set-image` 配置方法，未见配置及读图成功回执 |
| 记忆向量索引 | 未解决 | 曾返回 OpenAI embeddings `429 / insufficient_quota / credit_balance_exhausted` |
| Remotion 约 3 分钟歌词 MV | 未完成 | 素材读取出现 `Permission denied`；尚未验证 FFmpeg、浏览器及最终视频渲染 |
| 安卓共享存储“完全访问” | 未解决 | 当前 Claw App 没有声明所有文件访问权限；Claude 自动批准不能增加安卓权限 |

## 先区分四个组件

- **OpenClaw**：智能体平台，管理模型、会话、工具和消息通道。
- **Gateway（网关）**：常驻后台，接收微信消息，调用模型与工具，再将结果送回微信。
- **Claude Code**：另一套编程智能体界面；在本次实践中，它经 SCNet 的 Anthropic 兼容接口调用 DeepSeek。
- **微信 ClawBot**：OpenClaw 的消息入口。给 Claude Code 配置的接口不会自动成为 OpenClaw 的接口。

聊天模型、辅助模型、读图模型、绘图模型和记忆嵌入模型，也可能分别使用不同服务。不要仅凭机器人自称来判断实际调用模型。

## 阅读顺序

1. [完整过程与阶段总结](docs/01-conversation-summary.md)
2. [安卓部署与日常使用](docs/02-android-and-claude.md)
3. [微信、SCNet 与模型切换](docs/03-wechat-and-models.md)
4. [NekBox 分流与网络排查](docs/04-network-nekobox.md)
5. [读图、绘图、记忆与 Remotion](docs/05-media-memory-remotion.md)
6. [故障速查与版本兼容](docs/06-troubleshooting.md)
7. [权限、脱敏与自动执行](docs/07-permissions-and-security.md)
8. [验证记录](docs/08-validation.md)与[来源链接](docs/09-sources.md)

## 可复用文件

| 文件 | 用途 |
| --- | --- |
| [scripts/save-scnet-key.sh](scripts/save-scnet-key.sh) | 隐藏输入 SCNet 密钥，保存到手机私有目录；不输出密钥 |
| [scripts/start-claude-scnet.sh](scripts/start-claude-scnet.sh) | 启动已安装的 JS 版 Claude Code，转发命令行参数 |
| [scripts/configure-scnet-openclaw.sh](scripts/configure-scnet-openclaw.sh) | 为 OpenClaw 添加 SCNet 服务及模型目录，不更改默认聊天模型 |
| [scripts/upload-files.cjs](scripts/upload-files.cjs) | 手机浏览器选择媒体文件，上传到 App 私有项目目录 |
| [scripts/network-check.cjs](scripts/network-check.cjs) | 不带密钥的 SCNet 网络检查，非推理/鉴权校验 |
| [patches/openclaw-android-temp-fix.cjs](patches/openclaw-android-temp-fix.cjs) | 本次手机上成功执行过的临时目录兼容补丁，原文件保留 |
| [patches/openclaw-android-copy-fix.cjs](patches/openclaw-android-copy-fix.cjs) | 将对话中的 FICLONE 修复整理为带校验、备份与回滚的脚本 |
| [examples/scnet-provider.json](examples/scnet-provider.json) | 脱敏服务配置示例，不含密钥 |
| [prompts/remotion-mv.md](prompts/remotion-mv.md) | 先导入素材、验证渲染环境，再制作 MV 的执行提示词 |

这些脚本**不会自动安装 OpenClaw、自动充值、解除安卓沙箱或替你登录微信**。版本补丁仅面向本次环境，详细边界见故障文档。新整理的脚本和原先手机上已执行的步骤，在验证记录中分别标记。

## 日常命令

在安卓上，网关通常在独立终端前台运行：

```bash
openclaw gateway
```

另一个终端检查连接：

```bash
openclaw channels status --probe
```

在微信聊天中切换到已经配置好的 SCNet：

```text
/model scnet/DeepSeek-V4.1-Flash-1017-Event
```

此命令在本次实践中只切换当前会话。保留运行网关的终端；安卓后台清理和网络变化仍可能中断服务。

## 下载与隐私

可通过 GitHub 的 **Code → Download ZIP** 打包下载整个仓库。仓库只包含脱敏文档、示例与工具脚本，**没有手机真实配置备份、API Key、OAuth Token、登录二维码、设备码、微信账号、音乐文件或逐字聊天导出**。

上游项目与协议说明见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。本仓库记录特定版本上的实践，不代表相关服务的官方支持声明，也不保证未来版本和模型权限相同。

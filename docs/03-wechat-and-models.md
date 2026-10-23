# 微信、SCNet 与模型切换

## 微信通道安装

前提：OpenClaw 已有可用模型，当前安装环境允许插件加载。本次安卓环境还需要处理两个文件系统兼容问题，见 [故障文档](06-troubleshooting.md)。

官方页面曾给出：

```bash
npx -y @tencent-weixin/openclaw-weixin-cli@latest install
```

本次这个命令报 `weixin-install: not found`，后改用 OpenClaw 原生安装流程。不要把此失败解释为 npm 中所有未来版本都不可用。

**本次 2026.10.2 配合验证过的插件版本：**

```bash
openclaw plugins install "@tencent-weixin/openclaw-weixin@2.4.10" --force
openclaw plugins doctor --json
```

`--force` 用于覆盖现有插件；新装且无冲突时可省略。默认目录曾选择 `2.4.8`，它导入的部分 SDK 接口已被移除；所以明确指定版本，而不是反复安装同一旧包。

如果诊断没有加载错误，但插件未启用：

```bash
openclaw plugins enable openclaw-weixin
```

在独立终端启动网关，保持运行：

```bash
openclaw gateway
```

然后在另一个终端登录：

```bash
openclaw channels login --channel openclaw-weixin
openclaw channels status --probe
```

扫码需要本人使用微信完成。若二维码在同一手机上，可以尝试界面给出的继续链接；其可用性以微信实际流程为准，不保证所有微信客户端允许相册识码或直接打开链接。不要把有效二维码、设备码或授权链接提交仓库。

### 各种“成功”含义不同

| 输出 | 能证明什么 |
| --- | --- |
| `Installed plugin` | 包已安装，不能保证加载成功 |
| `doctor: ok=true` | 诊断未报告插件错误，不能保证外部服务正常 |
| `Local login saved auth` | 凭据已保存，不能保证网关正在运行 |
| `Gateway reachable`、通道 `running` | 网关可达、通道已启动，不能单独保证模型和消息投递成功 |
| 微信发消息后收到实际回复 | 当次入站、模型请求、出站的端到端验证 |

数据库“inventory retired”、旧租约或投递状态异常需要具体日志；先用新的 CLI 操作检查，不能把“删状态库”当通用恢复方案。

## 接入 SCNet：独立于 Claude Code

Claude Code 的 `ANTHROPIC_*` 不会自动同步到 OpenClaw。下面脚本将已保存的 Token Plan 密钥转存到 `~/.openclaw/.env`，配置里引用 `${SCNET_API_KEY}`，并追加 SCNet 模型目录。

先停止前台网关，避免与本地配置写入并发，再在仓库目录执行：

```bash
bash scripts/configure-scnet-openclaw.sh
```

它不会把所有会话或默认主模型自动切换为 DeepSeek。服务片段见 [examples/scnet-provider.json](../examples/scnet-provider.json)：

```json
{
  "baseUrl": "https://api.scnet.cn/api/llm/anthropic",
  "api": "anthropic-messages",
  "apiKey": "${SCNET_API_KEY}",
  "models": [
    {
      "id": "DeepSeek-V4.1-Flash-1017-Event",
      "name": "SCNet DeepSeek"
    }
  ]
}
```

不要再给这个 Base URL 随意追加 `/v1`；Anthropic SDK 的请求通常会落在 `/anthropic/v1/messages`。如果改成平台的 OpenAI 兼容入口，必须同步调整协议和模型参数，不能只替换网址。

校验通过后，重启网关，并在微信单独发送：

```text
/model scnet/DeepSeek-V4.1-Flash-1017-Event
```

再发送一句短测试。`Model set ... for this session only; configured default unchanged` 只说明会话选择成功；实际回复与日志 `provider=scnet status=200` 才能证明当次推理成功。

## 模型选择命令

微信文本命令：

```text
/model list
/model status
/model openai/gpt-6-astra
/model scnet/DeepSeek-V4.1-Flash-1017-Event
```

只有已配置、可用且被允许的模型才能实际调用。先查看列表，避免把本仓库里的示例模型名当作账号一定拥有的能力。

CLI 查看目录与状态：

```bash
openclaw models list
openclaw models status
```

有意修改共享默认模型才使用：

```bash
openclaw models set scnet/DeepSeek-V4.1-Flash-1017-Event
```

已有的会话选择、每个 agent 的独立配置可能覆盖全局默认。不要仅凭更改默认值，断言所有微信和 TUI 会话都跟着切换。

## 模型身份核实

本次日志既出现 `gpt-6-astra`，也出现 `gpt-5.6-luna`，涉及主模型、辅助模型或恢复任务的可能性不能排除。模型自称、启动 banner 与某一条后台请求都不是完整证明。需要同时核对：

1. 当前会话的 `/model status`；
2. 对应 agent 和会话配置；
3. 同一 run 的 provider/model 请求记录。

对话中曾把单个 `luna` 日志直接解释为当前回复模型，本整理修正为“存在名称差异，需要按 run 对齐验证”。

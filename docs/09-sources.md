# 上游与资料来源

本记录以对话中的终端/微信结果为实践证据，以下链接用于核对公开实现和配置。优先固定版本文档；主分支和在线文档会变化。

## 安卓与文件系统

- [AidanPark/openclaw-android](https://github.com/AidanPark/openclaw-android)
- [Claw AndroidManifest.xml](https://github.com/AidanPark/openclaw-android/blob/main/android/app/src/main/AndroidManifest.xml)
- [fs-safe Android 临时目录兼容 PR #982](https://github.com/openclaw/fs-safe/pull/982)
- [fs-safe 写入和复制策略](https://github.com/openclaw/fs-safe/blob/main/docs/writing.md)
- [Android 所有文件访问权限](https://developer.android.com/training/data-storage/manage-all-files)
- [Termux 存储设置命令实现](https://github.com/termux/termux-tools/blob/master/scripts/termux-setup-storage.in)

## 微信

- [Tencent/openclaw-weixin](https://github.com/Tencent/openclaw-weixin)
- [腾讯插件变更记录](https://github.com/Tencent/openclaw-weixin/blob/main/CHANGELOG.md)：2.4.10 记录修复 OpenClaw 2026.10 兼容性。
- [微信插件协议、默认 API/CDN](https://github.com/Tencent/openclaw-weixin/blob/main/docs/protocol.md)
- [SDK 接口移除问题 #166404](https://github.com/openclaw/openclaw/issues/166404)
- [腾讯插件兼容问题 #336](https://github.com/Tencent/openclaw-weixin/issues/336)

## OpenClaw 固定版本与 CLI

- [2026.10.2 package.json](https://github.com/openclaw/openclaw/blob/v2026.10.2/package.json)
- [2026.10.2 图片生成文档](https://github.com/openclaw/openclaw/blob/v2026.10.2/docs/tools/image-generation.md)
- [插件 CLI](https://docs.openclaw.ai/cli/plugins)
- [通道 CLI](https://docs.openclaw.ai/cli/channels)
- [模型配置和切换](https://docs.openclaw.ai/concepts/models)
- [模型 CLI](https://docs.openclaw.ai/cli/models)
- [自定义服务](https://docs.openclaw.ai/concepts/model-providers/custom-providers)
- [环境变量与私有 .env](https://docs.openclaw.ai/help/environment)
- [配置 CLI](https://docs.openclaw.ai/cli/config)

## Claude Code 与网络

- [Claude Code CLI 参数](https://code.claude.com/docs/en/cli-reference)
- [Claude Code 权限](https://code.claude.com/docs/en/permissions)
- [NekoBoxForAndroid](https://github.com/MatsuriDayo/NekoBoxForAndroid)
- [NekBox 域名规则解析实现](https://github.com/MatsuriDayo/NekoBoxForAndroid/blob/main/app/src/main/java/moe/matsuri/nb4a/SingBoxOptionsUtil.kt)

## SCNet

- [SCNet 平台](https://www.scnet.cn/)
- 本次 Anthropic 兼容入口：`https://api.scnet.cn/api/llm/anthropic`。
- 本次 OpenAI 兼容入口：`https://api.scnet.cn/api/llm/v1`。
- 精确模型 ID、套餐与额度应以用户当前平台页面为准。端点存在不代表本仓库拥有平台账户权限，也不保证所有模型支持相同输入和工具协议。

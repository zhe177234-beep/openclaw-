# 第三方说明

本仓库是独立实践笔记，不隶属 OpenClaw、Anthropic、Tencent、SCNet 或 NekBox。

`tests/fixtures/fs-safe-0.24.2/` 中三个 JavaScript 文件原样来自 npm 发布包 `@openclaw/fs-safe@0.24.2`，用于按 SHA-256 验证版本补丁，版权属于对应上游。`patches/openclaw-android-temp-fix.cjs` 的祖先权限规则参考 [openclaw/fs-safe PR #982](https://github.com/openclaw/fs-safe/pull/982)。保留上游 MIT 声明如下。

## fs-safe — MIT License

Copyright (c) 2026 openclaw

Copyright (c) 2026 OpenClaw Foundation (guest filesystem Python source)

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

## 其他项目

其他上游项目仅以名称、短错误信息、配置参数和链接作兼容性说明；本仓库不打包它们的 APK、模型权重、登录数据或安装依赖。Claude Code 的授权和使用条件以 Anthropic 当前条款为准，第三方模型兼容性以平台和实际测试为准。

# 故障速查与版本补丁

## 快速定位

| 现象 | 本次定位 | 处理/状态 |
| --- | --- | --- |
| TUI 拒绝连接 127.0.0.1:18789 | 网关未运行 | 独立终端 `openclaw gateway` |
| Codex 设备码申请特殊地址阻断 | DNS/代理与地址检查冲突 | 调整网络后成功；不是登录账号被证明无效 |
| `claude.exe invalid ELF header` | 原生入口在当前安卓环境不兼容 | JS 版 CLI 2.1.63 经 Node 启动成功 |
| `which: command not found` | 缺少 which 工具 | 使用 Bash 内建 `command -v` |
| Bash 无合适 shell | 启动环境 SHELL 不正确 | 启动前设置 `$PREFIX/bin/bash` |
| Claude `/tmp` mkdir 拒绝 | 默认临时路径不可写 | 启动前设置 TMPDIR / CLAUDE_CODE_TMPDIR |
| 插件临时目录 untrusted owner | 安卓系统祖先 UID 1000 与 Linux/glibc 检测不匹配 | 限定版本局部补丁，手机已验证 |
| 插件 guarded copy failed | FICLONE 在安卓拒绝，auto 未回退 | 本次对比 never/auto 测试确认；局部改普通复制 |
| `ERR_PACKAGE_PATH_NOT_EXPORTED` | 插件 2.4.8 SDK 不兼容 | 指定腾讯插件 2.4.10 后成功 |
| `inventory retired` / 配置读取错误 | 插件操作生命周期/并发状态问题 | 新操作与后续启动曾成功；未证明永久消除 |
| 图片服务 ECONNREFUSED | OpenAI 连接被拒绝 | 让 Claw 进入 NekBox，按域名分流 |
| 图片已保存但微信没收到 | 完成通知/上传/投递链路失败 | 保留图片，检查微信 API/CDN 直连并重发 |
| SCNet TLS ECONNRESET | 握手前连接重置 | 链路对照测试；之后真实请求 200 |
| embeddings 429 | 额度不足 | 尚未解决，不以聊天授权代替嵌入额度 |
| `/storage/... Permission denied` | 安卓共享存储限制 | 浏览器上传或具备存储授权的 App 方案 |

## 补丁的适用范围

仅在以下环境检查通过时执行：

- App 为 `com.openclaw.android`，本次使用 Linux/glibc Node。
- OpenClaw 为 `2026.10.2`。
- 依赖 `@openclaw/fs-safe` 为 `0.24.2`。
- 目标源码哈希与脚本内记录一致；已有修改必须是本脚本可识别的版本。
- 停止使用该依赖的任务和网关，先保留可恢复安装。

**不要直接把这些补丁当作所有未来版本的通用安装步骤。** 版本变化时重新对照上游。升级可能覆盖局部文件，也可能已修复同类问题。

## 临时目录补丁

保留了对话中实际在用户手机执行成功的原脚本：

```bash
node patches/openclaw-android-temp-fix.cjs --check
node patches/openclaw-android-temp-fix.cjs --apply
```

撤销：

```bash
node patches/openclaw-android-temp-fix.cjs --restore
```

它借鉴 fs-safe 上游 Android 祖先策略，增加当前 App/Linux/glibc 的环境识别。不会全局伪造平台、修改系统目录权限或跳过全部安全校验。临时根目录和新建子目录仍需当前用户所有且私有，外部 UID 与不安全可写目录仍被拒绝。

脚本中的“现在可重试”是当时原始提示；后续版本排障发现默认微信包偏旧，实际应参考本仓库显式 `2.4.10` 安装步骤。

## FICLONE 同步复制补丁

仓库新增脚本将对话里执行成功的同一处代码调整整理成文件：

```bash
node patches/openclaw-android-copy-fix.cjs --check
node patches/openclaw-android-copy-fix.cjs --apply
```

撤销：

```bash
node patches/openclaw-android-copy-fix.cjs --restore
```

只把该 App 环境下的 `clone: auto` 转成 `never`，显式 `always` 和其他环境保持原行为；保留来源文件身份、路径、字节上限与目标独占创建校验。**不会设置 `FS_SAFE_NATIVE_MODE=off` 来关闭整个原生辅助能力。**

它识别对话里已经建立的 `.before-android-copy` 备份；新包装器在沙箱外环境会拒绝操作。新的脚本包装与手机此前执行过的代码属于不同验证层级，见 [验证记录](08-validation.md)。

## 数据库与恢复队列

本次出现过旧租约、`owner-pid-dead`、状态所有权未验证，以及投递队列的 `send_attempt_started`。后者拒绝盲目重放，是为避免不确定状态下重复发送。

不要凭一条恢复警告删除整个 `.openclaw`、状态 SQLite、OAuth 数据或微信账号。先检查是否有多个网关、旧进程、未完成维护，再保存脱敏日志。对话没有完成数据库级别的通用修复，本仓库也不提供自动清库脚本。

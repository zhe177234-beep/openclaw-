# 安卓环境与 Claude Code

## 版本范围

本次证据对应：Claw 包名 `com.openclaw.android`、OpenClaw `2026.10.2 (b8952d4)`、Node `24.21.0`、npm `11.19.0`、JS 版 Claude Code `2.1.63`。补丁所针对的依赖为 `@openclaw/fs-safe@0.24.2`。

Claw 常用目录：

```text
HOME   /data/user/0/com.openclaw.android/files/home
PREFIX /data/user/0/com.openclaw.android/files/usr
```

`/data/data/...` 可能与 `/data/user/0/...` 指向同一目录，以实际 realpath 为准。这个 App 与 Termux 是独立安装，不能混用彼此的私有路径和权限。出现读取 `/data/data/com.termux/.../bash.bashrc` 的权限错误时，检查启动文件里是否残留另一 App 的硬编码路径；不要直接修改别人私有目录的权限。

本仓库不重做 OpenClaw APK 安装器。新装环境先参考 [上游项目](https://github.com/AidanPark/openclaw-android)，本记录的版本并非未来所有版本的推荐值。

## GPT 与网关

首次设置时选择 OpenAI、设备码登录，按 CLI 显示的官方地址完成本人授权。二维码、设备码、OAuth Token 都不应发布到 GitHub。

安卓截图中 systemd 用户服务不可用，因此使用一个终端前台运行：

```bash
openclaw gateway
```

另一个终端启动 TUI：

```bash
openclaw tui
```

需要 `gpt` / `GPT` 快捷命令，可在自己的 `~/.bashrc` 添加：

```bash
alias gpt='openclaw tui'
alias GPT='openclaw tui'
```

新终端加载后生效。别名仅打开 TUI，不自动保证网关已启动。

重启前台网关：到运行它的终端按 Ctrl+C，等命令提示符出现，再运行 `openclaw gateway`。若端口仍被占用，先识别已有实例，不要盲目启动多个网关或直接删数据库。

## Claude Code 的 JS 启动方式

本次捆绑原生二进制报 ELF 错误。曾成功使用以下私有安装布局：

```bash
mkdir -p "$HOME/claude-js-test"
cd "$HOME/claude-js-test"
npm install --save-exact @anthropic-ai/claude-code@2.1.63
node "$HOME/claude-js-test/node_modules/@anthropic-ai/claude-code/cli.js" --version
```

这是一条历史兼容路径，不建议无期限锁在旧版。新版本可能没有 `cli.js`，升级前先检查入口并保留可恢复安装；上面这条命令不保证适用于未来 npm 包或所有安卓 ROM。

## 保存 SCNet 凭据与启动

先在仓库目录运行：

```bash
bash scripts/save-scnet-key.sh
bash scripts/start-claude-scnet.sh --version
bash scripts/start-claude-scnet.sh
```

密钥在手机本地隐藏输入，保存为 `~/.config/claude-scnet/key.env`，不在 GitHub 保存。启动脚本使用 Anthropic 兼容 Base URL，模型为 `DeepSeek-V4.1-Flash-1017-Event`，并设置 Bash、临时目录和子代理模型映射。清除显式 HTTP/SOCKS 环境代理不代表绕过手机 VPN；域名分流仍由 VPN 软件决定。

如果需要在新终端直接输入 `claude` / `Claude`，先确认自己当前已有包装器，避免覆盖正常工作的旧脚本。新环境可保存仓库启动器：

```bash
cp scripts/start-claude-scnet.sh "$HOME/start-claude-scnet.sh"
chmod 700 "$HOME/start-claude-scnet.sh"
```

然后在 `~/.bashrc` 中添加并重新打开终端；已有同名 alias 时先取消 alias，再定义函数：

```bash
unalias claude Claude 2>/dev/null
claude() { "$PREFIX/bin/bash" "$HOME/start-claude-scnet.sh" "$@"; }
Claude() { claude "$@"; }
```

安卓不一定存在 `/usr/bin/env`，以上函数显式使用当前 App 的 Bash。不要把这些 shell 配置行输入到 Claude 聊天框执行；应编辑自己的启动文件或在真实 Bash 提示符下定义。路径是否正确可以用 `type -a claude` 检查。

## 三种常见启动失败

| 报错 | 已验证的处理方向 |
| --- | --- |
| `invalid ELF header` | 本次用 Node 启动 JS 入口；不能把桌面二进制直接当成兼容安卓程序 |
| `No suitable shell found` | 在 Claude 启动前设置 `SHELL="$PREFIX/bin/bash"`，重新启动会话 |
| `mkdir /tmp/claude-... EACCES` | 在启动前设置 `TMPDIR`、`CLAUDE_CODE_TMPDIR` 到 App 内的可写目录 |

在 Claude 工具命令内部临时设置 SHELL/TMPDIR 可能太晚，因为工具初始化已经发生。仓库启动器将这些变量设在进程启动前。

## 验证与退出

让它创建 `hello.js`，再要求真正通过 Bash 执行：

```text
请创建 hello.js，内容为 console.log("你好，DeepSeek");
然后用 Bash 执行 node hello.js，报告实际输出；若失败，保留错误，不要把预期输出当成运行结果。
```

退出使用 `/exit`；Esc 通常是中断或关闭菜单，不等同于退出整个客户端。

自动执行模式详见 [权限文档](07-permissions-and-security.md)。

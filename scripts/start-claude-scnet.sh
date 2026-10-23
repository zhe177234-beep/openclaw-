#!/usr/bin/env bash
# Historical JS CLI layout used successfully in the Android conversation.
set +x
set -euo pipefail
: "${PREFIX:?请在 Claw 的终端中运行，当前未设置 PREFIX}"
task_key_file="${CLAUDE_SCNET_KEY_ENV:-$HOME/.config/claude-scnet/key.env}"
task_cli="${CLAUDE_SCNET_CLI_JS:-$HOME/claude-js-test/node_modules/@anthropic-ai/claude-code/cli.js}"
if [[ ! -r "$task_key_file" || ! -f "$task_cli" ]]; then
  printf '缺少可读的私有密钥文件或 JS CLI。请先检查安装路径。\n' >&2
  exit 1
fi
# The source file is created locally by save-scnet-key.sh; never source a downloaded secret file.
source "$task_key_file"
: "${ANTHROPIC_AUTH_TOKEN:?没有读取到 SCNet 密钥}"
export ANTHROPIC_AUTH_TOKEN
export ANTHROPIC_BASE_URL='https://api.scnet.cn/api/llm/anthropic'
export ANTHROPIC_MODEL='DeepSeek-V4.1-Flash-1017-Event'
export ANTHROPIC_DEFAULT_OPUS_MODEL="$ANTHROPIC_MODEL"
export ANTHROPIC_DEFAULT_SONNET_MODEL="$ANTHROPIC_MODEL"
export ANTHROPIC_DEFAULT_HAIKU_MODEL="$ANTHROPIC_MODEL"
export CLAUDE_CODE_SUBAGENT_MODEL="$ANTHROPIC_MODEL"
export SHELL="$PREFIX/bin/bash"
export PATH="$PREFIX/bin:$PATH"
export TMPDIR="$PREFIX/tmp"
export CLAUDE_CODE_TMPDIR="$TMPDIR"
export DISABLE_AUTOUPDATER=1
unset ANTHROPIC_API_KEY
unset HTTP_PROXY HTTPS_PROXY ALL_PROXY http_proxy https_proxy all_proxy
mkdir -p "$TMPDIR"
if [[ ! -x "$SHELL" || ! -x "$PREFIX/bin/node" ]]; then
  printf '当前 PREFIX 下缺少可执行的 Bash 或 Node。\n' >&2
  exit 1
fi
exec "$PREFIX/bin/node" "$task_cli" "$@"

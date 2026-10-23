#!/usr/bin/env bash
# Run with: bash scripts/save-scnet-key.sh
set +x
set -euo pipefail
umask 077
task_key_dir="$HOME/.config/claude-scnet"
mkdir -p "$task_key_dir"
chmod 700 "$task_key_dir"
read -r -s -p '请输入 SCNet Token Plan 密钥（输入不显示）: ' task_scnet_key
printf '\n'
if [[ -z "$task_scnet_key" || "$task_scnet_key" == *$'\r'* || "$task_scnet_key" == *$'\n'* ]]; then
  printf '密钥为空或包含换行，未保存。\n' >&2
  exit 1
fi
task_key_file="$task_key_dir/key.env"
if [[ -L "$task_key_file" ]]; then
  printf '凭据路径是符号链接，停止。\n' >&2
  exit 1
fi
if [[ -f "$task_key_file" ]]; then
  task_key_backup="$task_key_file.backup-$(date +%s)-$$"
  cp "$task_key_file" "$task_key_backup"
  chmod 600 "$task_key_backup"
fi
task_key_temp=$(mktemp "$task_key_dir/.key.XXXXXXXX")
trap 'rm -f "$task_key_temp"' EXIT
printf 'export ANTHROPIC_AUTH_TOKEN=%q\n' "$task_scnet_key" > "$task_key_temp"
chmod 600 "$task_key_temp"
mv "$task_key_temp" "$task_key_file"
unset task_scnet_key
printf '凭据已保存到私有目录，未显示密钥内容。\n'

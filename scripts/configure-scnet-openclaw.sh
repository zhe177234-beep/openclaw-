#!/usr/bin/env bash
# Stop the foreground Gateway before running this script.
set +x
set -euo pipefail
umask 077
task_key_file="${CLAUDE_SCNET_KEY_ENV:-$HOME/.config/claude-scnet/key.env}"
if [[ ! -r "$task_key_file" ]]; then
  printf '没有找到私有 SCNet 密钥文件，请先运行 save-scnet-key.sh。\n' >&2
  exit 1
fi
source "$task_key_file"
export SCNET_API_KEY="${ANTHROPIC_AUTH_TOKEN:?没有读取到 SCNet 密钥}"
node <<'JS'
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const net = require('node:net');
(async () => {
  await new Promise((resolve, reject) => {
    const s = net.connect({host: '127.0.0.1', port: 18789});
    s.once('connect', () => {s.destroy(); reject(new Error('默认端口有服务运行，请先停止网关。'));});
    s.once('error', e => {s.destroy(); e.code === 'ECONNREFUSED' ? resolve() : reject(e);});
    s.setTimeout(1500, () => {s.destroy(); reject(new Error('无法确认网关状态，未修改。'));});
  });
  const key = process.env.SCNET_API_KEY;
  if (!key || /[\r\n]/.test(key)) throw new Error('密钥为空或格式异常。');
  const dir = process.env.OPENCLAW_STATE_DIR || path.join(os.homedir(), '.openclaw');
  fs.mkdirSync(dir, {recursive: true, mode: 0o700});
  const file = path.join(dir, '.env');
  let old = '';
  if (fs.existsSync(file)) {
    const stat = fs.lstatSync(file);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.uid !== process.geteuid()) throw new Error('.env 不是当前用户拥有的普通文件。');
    old = fs.readFileSync(file, 'utf8');
    fs.writeFileSync(file + '.backup-' + crypto.randomUUID(), old, {mode: 0o600, flag: 'wx'});
  }
  const lines = old.split(/\r?\n/).filter(line => !/^\s*(?:export\s+)?SCNET_API_KEY\s*=/.test(line));
  lines.push('SCNET_API_KEY=' + JSON.stringify(key));
  const staging = file + '.tmp-' + crypto.randomUUID();
  try {
    fs.writeFileSync(staging, lines.join('\n') + '\n', {mode: 0o600, flag: 'wx'});
    fs.renameSync(staging, file);
  } finally {
    try {fs.unlinkSync(staging);} catch(e) {if (e.code !== 'ENOENT') throw e;}
  }
  console.log('SCNet 密钥已写入私有 .env；已有文件已备份，未显示密钥。');
})().catch(e => {console.error(e.message); process.exitCode = 1;});
JS
openclaw config set models.providers.scnet '{"baseUrl":"https://api.scnet.cn/api/llm/anthropic","api":"anthropic-messages","apiKey":"${SCNET_API_KEY}","models":[{"id":"DeepSeek-V4.1-Flash-1017-Event","name":"SCNet DeepSeek"}]}' --strict-json
openclaw config set agents.defaults.models '{"scnet/DeepSeek-V4.1-Flash-1017-Event":{}}' --strict-json --merge
openclaw config validate
printf '配置完成。默认聊天模型未修改；重启网关后可在微信用 /model 切换。\n'

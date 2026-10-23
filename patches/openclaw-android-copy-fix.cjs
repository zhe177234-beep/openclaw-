#!/usr/bin/env node
'use strict';
// Only OpenClaw 2026.10.2 / fs-safe 0.24.2 in com.openclaw.android.
// Converts automatic synchronous clone requests to ordinary copying in that App.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const net = require('node:net');
const {pathToFileURL} = require('node:url');
const EXPECTED = 'd1aa86b3e2c2b88432a65844809aa817e1dafb1c75cbf6ff00a49d3a2cc911c0';
const BEFORE = 'const clone = resolveCopyCloneMode(options.clone, "never");';
const AFTER = 'const clone = resolveCopyCloneMode(options.clone === "auto" && /^\\/data\\/(?:data|user\\/\\d+)\\/com\\.openclaw\\.android\\/files\\/usr$/.test(process.env.PREFIX ?? "") ? "never" : options.clone, "never");';
const hash = value => crypto.createHash('sha256').update(value).digest('hex');

function buildPatch(source) {
  if (hash(source) !== EXPECTED || source.split(BEFORE).length !== 2) throw new Error('固定版本源码校验失败，未修改。');
  return source.replace(BEFORE, AFTER);
}
function ownFile(file) {
  const s = fs.lstatSync(file);
  if (!s.isFile() || s.isSymbolicLink() || s.uid !== process.geteuid() || (s.mode & 0o022)) throw new Error('文件类型、所有者或权限不匹配，未修改。');
  return s;
}
function replaceAtomic(file, data, mode) {
  const staging = file + '.tmp-' + crypto.randomUUID();
  try {
    fs.writeFileSync(staging, data, {flag: 'wx', mode: 0o600});
    fs.chmodSync(staging, mode & 0o777);
    fs.renameSync(staging, file);
  } finally {
    try {fs.unlinkSync(staging);} catch(e) {if (e.code !== 'ENOENT') throw e;}
  }
}
function confirmGatewayStopped() {
  return new Promise((resolve, reject) => {
    const s = net.connect({host: '127.0.0.1', port: 18789});
    s.once('connect', () => {s.destroy(); reject(new Error('默认网关端口正在使用，请停止网关和相关任务再修改。'));});
    s.once('error', e => {s.destroy(); e.code === 'ECONNREFUSED' ? resolve() : reject(e);});
    s.setTimeout(1500, () => {s.destroy(); reject(new Error('无法确认网关状态，未修改。'));});
  });
}
async function main() {
  const action = process.argv[2] || '--check';
  if (!['--check', '--apply', '--restore'].includes(action)) throw new Error('用法：node 脚本.cjs --check / --apply / --restore');
  const prefix = fs.realpathSync(process.env.PREFIX || '');
  if (!/^\/data\/(?:data|user\/\d+)\/com\.openclaw\.android\/files\/usr$/.test(prefix) ||
      !['/system/bin/app_process', '/system/bin/app_process64', '/system/bin/app_process32'].some(p => fs.existsSync(p)) ||
      fs.statSync(prefix).uid !== process.geteuid()) throw new Error('不是已验证的安卓 Claw App 环境，未修改。');
  const ocRoot = path.join(prefix, 'lib/node_modules/openclaw');
  const depRoot = path.join(ocRoot, 'node_modules/@openclaw/fs-safe');
  if (JSON.parse(fs.readFileSync(path.join(ocRoot, 'package.json'), 'utf8')).version !== '2026.10.2' ||
      JSON.parse(fs.readFileSync(path.join(depRoot, 'package.json'), 'utf8')).version !== '0.24.2') throw new Error('版本不匹配，未修改。');
  const file = path.join(depRoot, 'dist/copy-root-file-sync.js');
  const stat = ownFile(file);
  const backup = file + '.before-android-copy';
  const current = fs.readFileSync(file, 'utf8');
  let original = current;
  if (fs.existsSync(backup)) {ownFile(backup); original = fs.readFileSync(backup, 'utf8');}
  const patched = buildPatch(original);
  if (current !== original && current !== patched) throw new Error('文件有其他修改，未覆盖。');
  if (action === '--check') {
    console.log(current === patched ? '版本校验通过，复制兼容补丁已应用。' : '版本校验通过，可应用复制兼容补丁。');
    return;
  }
  await confirmGatewayStopped();
  if (action === '--restore') {
    replaceAtomic(file, original, stat.mode);
    console.log('已恢复同步复制文件；模型和凭据没有改动。');
    return;
  }
  if (!fs.existsSync(backup)) fs.writeFileSync(backup, original, {flag: 'wx', mode: 0o600});
  ownFile(backup);
  if (hash(fs.readFileSync(backup)) !== EXPECTED) throw new Error('备份校验失败，未修改。');
  let proof;
  try {
    replaceAtomic(file, patched, stat.mode);
    const tmp = path.join(prefix, 'tmp');
    fs.mkdirSync(tmp, {recursive: true, mode: 0o700});
    proof = fs.mkdtempSync(path.join(tmp, 'openclaw-copy-proof-'));
    const source = path.join(proof, 'source');
    const target = path.join(proof, 'target');
    fs.writeFileSync(source, 'copy-check', {flag: 'wx', mode: 0o600});
    const {copyRootFileSync} = await import(pathToFileURL(file).href);
    const result = copyRootFileSync({source: {rootPath: proof, absolutePath: source}, destination: {rootPath: proof, absolutePath: target}, clone: 'auto'});
    result.close();
    if (fs.readFileSync(target, 'utf8') !== 'copy-check') throw new Error('自动复制字节验证失败。');
    console.log('复制兼容修复成功：自动模式下创建、复制和读取均通过。原文件已备份。');
  } catch(e) {
    replaceAtomic(file, original, stat.mode);
    throw new Error('验证失败，已恢复原文件：' + e.message);
  } finally {
    if (proof) fs.rmSync(proof, {recursive: true, force: true});
  }
}
module.exports = {buildPatch, hash, EXPECTED, BEFORE, AFTER};
if (require.main === module) main().catch(e => {console.error('停止：' + e.message); process.exitCode = 1;});

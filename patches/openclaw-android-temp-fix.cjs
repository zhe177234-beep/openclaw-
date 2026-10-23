#!/usr/bin/env node
'use strict';
/*
 * Target: OpenClaw 2026.10.2 / @openclaw/fs-safe 0.24.2 in com.openclaw.android.
 * Backports the ancestry-only Android policy from openclaw/fs-safe PR #982.
 * Additional host detection supports this app's Linux/glibc Node runtime.
 * No network requests, credential reads, model changes, or OS permission edits.
 * --check: read-only. --apply: backs up, patches two files, verifies, rolls back on error.
 * --restore: restores only these two files if their contents still match this patch.
 * Upstream: https://github.com/openclaw/fs-safe/pull/982 (MIT).
 */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const vm = require('node:vm');
const net = require('node:net');
const { pathToFileURL } = require('node:url');
const marker = '// OC_ANDROID_TEMP_FIX_V1';
const entries = [
  ['temp-workspace-ownership.js', 'dc3f7d3be66ae6102ab1802445b2038995eb20f04fc1320aa6876fc15b8f863f'],
  ['temp-workspace-child-admission.js', '66a4964fbc6babd353626ab116aa880431d783e103bc195f49c91dc6389352ba'],
];
const hash = s => crypto.createHash('sha256').update(s).digest('hex');

const hostDetection = `
${marker}
function isAndroidAppRuntime() {
    if (process.platform === "android") return true;
    if (process.platform !== "linux") return false;
    try {
        const uid = process.geteuid?.();
        if (!Number.isSafeInteger(uid) || uid % 100000 < 10000 || uid % 100000 > 19999) return false;
        const prefix = fs.realpathSync(process.env.PREFIX || "");
        if (!/^\\/data\\/(?:data|user\\/\\d+)\\/com\\.openclaw\\.android\\/files\\/usr$/.test(prefix)) return false;
        return fs.statSync(prefix).uid === uid &&
            ["/system/bin/app_process", "/system/bin/app_process64", "/system/bin/app_process32"].some(p => fs.existsSync(p));
    } catch { return false; }
}

// Only ancestor group-write receives the upstream Android exception.
// Temp roots and workspace children must still be owned by this app and private.
export function hasTrustedAndroidTempAncestorGroup(stat, uid, ownership) {
    if (!isAndroidAppRuntime()) return false;
    if (ownership === "user" && uid % 100000 >= 10000 && uid % 100000 <= 19999) {
        return stat.gid === uid || stat.gid === BigInt(uid);
    }
    if (ownership !== "android-system" || (stat.gid !== 1000 && stat.gid !== 1000n)) return false;
    try {
        const gid = process.getegid?.();
        const groups = process.getgroups?.();
        return gid !== undefined && Number.isSafeInteger(gid) && gid >= 0 && gid !== 1000 &&
            Array.isArray(groups) && groups.every(g => Number.isSafeInteger(g) && g >= 0 && g !== 1000);
    } catch { return false; }
}
`;

function replaceOnce(text, before, after) {
  if (text.split(before).length !== 2) throw Error('代码与已验证版本不一致，未修改。');
  return text.replace(before, after);
}
function buildPatch(owner, child) {
  if (hash(owner) !== entries[0][1] || hash(child) !== entries[1][1]) {
    throw Error('原始文件校验不匹配，未修改。');
  }
  owner = replaceOnce(owner, 'let warned = false;', hostDetection + '\nlet warned = false;');
  owner = replaceOnce(owner, '    if (process.platform !== "linux")\n',
    '    if (isAndroidAppRuntime() && (stat.uid === 1000 || stat.uid === 1000n)) return "android-system";\n    if (process.platform !== "linux")\n');
  child = replaceOnce(child,
    'import { classifyTempWorkspaceOwner, warnUnmappedTempWorkspaceAncestor }',
    'import { classifyTempWorkspaceOwner, hasTrustedAndroidTempAncestorGroup, warnUnmappedTempWorkspaceAncestor }');
  child = replaceOnce(child,
    '    const writable = typeof stat.mode === "bigint"\n        ? (stat.mode & 18n) !== 0n\n        : Number.isSafeInteger(stat.mode) && stat.mode >= 0 && (stat.mode & 0o022) !== 0;',
    marker + '\n    const writeMask = !privateDirectory && hasTrustedAndroidTempAncestorGroup(stat, uid, ownership) ? 0o002 : 0o022;\n    const writable = typeof stat.mode === "bigint"\n        ? (stat.mode & BigInt(writeMask)) !== 0n\n        : Number.isSafeInteger(stat.mode) && stat.mode >= 0 && (stat.mode & writeMask) !== 0;');
  return [owner, child];
}

function verifyPolicy(owner, child) {
  const nativeFs = {
    realpathSync: () => '/data/data/com.openclaw.android/files/usr',
    statSync: () => ({ uid: 10524 }), existsSync: () => true,
    readFileSync: () => { throw Error('no namespace evidence'); },
  };
  const base = { platform: 'linux', env: { PREFIX: '/data/user/0/com.openclaw.android/files/usr' },
    geteuid: () => 10524, getegid: () => 10524, getgroups: () => [10524, 3003], emitWarning() {} };
  let checks = 0;
  const expect = (fn, uid, gid, mode, priv, code, bigint = false) => {
    let caught;
    try { fn({ uid: bigint ? BigInt(uid) : uid, gid: bigint ? BigInt(gid) : gid,
      mode: bigint ? BigInt(mode) : mode }, 10524, priv); } catch (e) { caught = e; }
    if (code ? caught?.code !== code : caught !== undefined) throw Error('局部权限策略自检失败。');
    checks++;
  };
  for (const bigint of [false, true]) {
    const context = vm.createContext({ fs: nativeFs, process: base, console });
    const code = s => s.replace(/^import .*;\r?\n/gm, '').replace(/^export /gm, '');
    vm.runInContext('class FsSafeError extends Error { constructor(code, message) { super(message); this.code = code; } }\n' + code(owner) + '\n' + code(child), context);
    const admit = context.assertTrustedTempWorkspaceDirectory;
    expect(admit, 1000, 1000, 0o40771, false, null, bigint);
    expect(admit, 1000, 1000, 0o40771, true, 'not-owned', bigint);
    expect(admit, 1001, 1001, 0o40755, false, 'not-owned', bigint);
    expect(admit, 1000, 3003, 0o40771, false, 'insecure-permissions', bigint);
    expect(admit, 1000, 1000, 0o40777, false, 'insecure-permissions', bigint);
    expect(admit, 10524, 10524, 0o40771, false, null, bigint);
    expect(admit, 10524, 10525, 0o40771, false, 'insecure-permissions', bigint);
    expect(admit, 10524, 10524, 0o40771, true, 'insecure-permissions', bigint);
    expect(admit, 10524, 10524, 0o40700, true, null, bigint);
    expect(admit, 0, 0, 0o40755, false, null, bigint);
    for (const bad of [() => [10524, 1000], () => undefined, () => [-1]]) {
      base.getgroups = bad;
      expect(admit, 1000, 1000, 0o40771, false, 'insecure-permissions', bigint);
    }
    base.getgroups = () => [10524, 3003];
    base.env.PREFIX = '/not-an-android-app';
    const oldRealpath = nativeFs.realpathSync;
    nativeFs.realpathSync = () => '/not-an-android-app';
    expect(admit, 1000, 1000, 0o40755, false, 'not-owned', bigint);
    nativeFs.realpathSync = oldRealpath;
    base.env.PREFIX = '/data/user/0/com.openclaw.android/files/usr';
    nativeFs.existsSync = () => false;
    expect(admit, 1000, 1000, 0o40755, false, 'not-owned', bigint);
    nativeFs.existsSync = () => true;
  }
  return checks;
}

function ownFile(filename) {
  const s = fs.lstatSync(filename);
  if (!s.isFile() || s.isSymbolicLink() || s.uid !== process.geteuid() || (s.mode & 0o022)) {
    throw Error('文件不是当前用户拥有的普通文件，或可被其他用户写入，未修改：' + filename);
  }
  return s;
}
function atomicReplace(filename, text, mode) {
  const staging = filename + '.tmp-' + crypto.randomUUID();
  let fd;
  try {
    fd = fs.openSync(staging, 'wx', 0o600);
    fs.writeFileSync(fd, text);
    fs.fsyncSync(fd);
    fs.closeSync(fd); fd = undefined;
    fs.chmodSync(staging, mode & 0o777);
    fs.renameSync(staging, filename);
  } finally {
    if (fd !== undefined) fs.closeSync(fd);
    try { fs.unlinkSync(staging); } catch (e) { if (e.code !== 'ENOENT') throw e; }
  }
}
async function portIsBusy() {
  return new Promise((resolve, reject) => {
    const socket = net.connect({ host: '127.0.0.1', port: 18789 });
    const finish = value => { socket.destroy(); resolve(value); };
    socket.once('connect', () => finish(true));
    socket.once('error', e => e.code === 'ECONNREFUSED' ? finish(false) : reject(e));
    socket.setTimeout(1500, () => { socket.destroy(); reject(Error('无法确认网关状态，未修改。')); });
  });
}
async function main() {
  const mode = process.argv[2] || '--check';
  if (!['--check', '--apply', '--restore'].includes(mode)) throw Error('用法：node 脚本.cjs --check / --apply / --restore');
  const prefix = fs.realpathSync(process.env.PREFIX || '');
  if (!/^\/data\/(?:data|user\/\d+)\/com\.openclaw\.android\/files\/usr$/.test(prefix) ||
      !['/system/bin/app_process', '/system/bin/app_process64', '/system/bin/app_process32'].some(p => fs.existsSync(p))) {
    throw Error('本脚本只用于安卓 Claw App，不在此环境中修改。');
  }
  const ocRoot = path.join(prefix, 'lib/node_modules/openclaw');
  if (JSON.parse(fs.readFileSync(path.join(ocRoot, 'package.json'), 'utf8')).version !== '2026.10.2') {
    throw Error('OpenClaw 版本与已验证的 2026.10.2 不一致，未修改。');
  }
  const dep = path.join(ocRoot, 'node_modules/@openclaw/fs-safe');
  if (JSON.parse(fs.readFileSync(path.join(dep, 'package.json'), 'utf8')).version !== '0.24.2') {
    throw Error('fs-safe 不是已验证的 0.24.2，未修改。');
  }
  const files = entries.map(([name, expected]) => {
    const filename = path.join(dep, 'dist', name);
    const stat = ownFile(filename);
    const current = fs.readFileSync(filename, 'utf8');
    const backup = filename + '.android-temp-fix-v1.original';
    let original;
    if (hash(current) === expected) original = current;
    else {
      ownFile(backup);
      original = fs.readFileSync(backup, 'utf8');
      if (hash(original) !== expected) throw Error('备份校验不匹配，未修改。');
    }
    return { filename, stat, current, original, backup };
  });
  const patched = buildPatch(...files.map(f => f.original));
  for (let i = 0; i < files.length; i++) {
    if (files[i].current !== files[i].original && files[i].current !== patched[i]) throw Error('文件有其他修改，未覆盖。');
  }
  console.log('版本及原始文件校验通过。权限策略自检通过：' + verifyPolicy(...patched) + ' 项。');
  if (mode === '--check') {
    console.log(files.every(f => f.current !== f.original) ? '局部修复已安装。' : '可应用局部修复。此检查没有修改任何文件。');
    return;
  }
  if (await portIsBusy()) throw Error('请先在运行网关的终端按 Ctrl+C 停止网关，再执行本命令。');
  if (mode === '--restore') {
    for (const f of files) atomicReplace(f.filename, f.original, f.stat.mode);
    console.log('已恢复两个依赖文件；GPT 登录、配置和聊天记录未改动。');
    return;
  }
  for (const f of files) {
    if (!fs.existsSync(f.backup)) fs.writeFileSync(f.backup, f.original, { flag: 'wx', mode: 0o600 });
    ownFile(f.backup);
    if (hash(fs.readFileSync(f.backup)) !== hash(f.original)) throw Error('已有备份不一致，未修改。');
  }
  try {
    for (let i = 0; i < files.length; i++) atomicReplace(files[i].filename, patched[i], files[i].stat.mode);
    const rootDir = path.join(prefix, 'tmp', 'openclaw-android-temp-proof');
    fs.mkdirSync(rootDir, { recursive: true, mode: 0o700 });
    const s = fs.lstatSync(rootDir);
    if (!s.isDirectory() || s.isSymbolicLink() || s.uid !== process.geteuid() || (s.mode & 0o077)) throw Error('验证目录不满足私有目录要求。');
    const { withTempWorkspace } = await import(pathToFileURL(path.join(dep, 'dist/temp.js')).href);
    const result = await withTempWorkspace({ rootDir, prefix: 'verify-' }, async ws => {
      await ws.writeText('proof.txt', 'verified');
      return (await ws.read('proof.txt')).toString();
    });
    if (result !== 'verified') throw Error('临时工作目录读写验证失败。');
    console.log('修复成功：私有临时工作目录创建、读写、清理均通过。');
    console.log('GPT 登录、模型配置及 Claude Code 均未改动。');
    console.log('现在可重试：openclaw plugins install "@tencent-weixin/openclaw-weixin"');
  } catch (error) {
    for (const f of files) atomicReplace(f.filename, f.original, f.stat.mode);
    throw Error('验证未通过，两个文件已自动还原。原因：' + error.message);
  }
}
module.exports = { buildPatch, verifyPolicy, hash };
if (require.main === module) main().catch(e => { console.error('停止：' + e.message); process.exitCode = 1; });

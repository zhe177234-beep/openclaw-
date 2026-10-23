#!/usr/bin/env node
'use strict';
// Select files in the Android browser and import them into App-private storage.
// No execution, no directory listing, no credential reads and no overwrite.
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const http = require('node:http');
const crypto = require('node:crypto');
const {Transform} = require('node:stream');
const {pipeline} = require('node:stream/promises');
const {parseArgs} = require('node:util');
const ALLOWED = new Set(['.mp3', '.lrc', '.wav', '.m4a', '.mp4', '.png', '.jpg', '.jpeg', '.webp', '.txt']);
const PAGE = `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>导入素材</title><style>body{font:18px system-ui;max-width:650px;margin:30px auto;padding:20px}button,input{font:inherit;margin:12px 0}pre{white-space:pre-wrap;overflow-wrap:anywhere}</style><h1>导入素材</h1><p>选择 MP3、LRC 或支持的媒体文件。只导入文件，不执行内容；不会覆盖同名文件。</p><input id="files" type="file" multiple><br><button id="send">上传所选文件</button><pre id="result"></pre><script>
const button=document.getElementById('send');
button.onclick=async()=>{button.disabled=true;const result=document.getElementById('result');result.textContent='';
try{const files=document.getElementById('files').files;if(!files.length)throw Error('请先选择文件');
for(const file of files){const query=new URLSearchParams({token:new URLSearchParams(location.search).get('token'),name:file.name});
const response=await fetch('/upload?'+query,{method:'POST',headers:{'Content-Type':'application/octet-stream'},body:file});const data=await response.json();
result.textContent+=file.name+'：'+(response.ok?'成功，'+data.bytes+' 字节':data.error)+'\\n';}}
catch(e){result.textContent+='错误：'+e.message;}finally{button.disabled=false;}};
</script></html>`;

function selectName(name) {
  if (!name || name === '.' || name === '..' || name.length > 240 || /[\\/\x00-\x1f\x7f]/.test(name) || path.basename(name) !== name) {
    throw new Error('文件名不合法');
  }
  if (!ALLOWED.has(path.extname(name).toLowerCase())) throw new Error('不支持此扩展名');
  return name;
}

function createUploadServer({directory, maxBytes = 100 * 1024 * 1024, token = crypto.randomBytes(24).toString('hex')}) {
  if (!Number.isSafeInteger(maxBytes) || maxBytes <= 0) throw new Error('大小限制无效');
  const requested = path.resolve(directory);
  fs.mkdirSync(requested, {recursive: true, mode: 0o700});
  const rootStat = fs.lstatSync(requested);
  if (!rootStat.isDirectory() || rootStat.isSymbolicLink() || rootStat.uid !== process.geteuid() || (rootStat.mode & 0o022)) {
    throw new Error('目标必须是当前用户拥有且不允许其他用户写入的普通目录');
  }
  const root = fs.realpathSync(requested);
  let busy = false;
  const reply = (res, status, data) => {
    res.writeHead(status, {'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff'});
    res.end(JSON.stringify(data));
  };
  const server = http.createServer(async (req, res) => {
    let url;
    try {url = new URL(req.url, 'http://127.0.0.1');} catch {return reply(res, 400, {error: '请求地址无效'});}
    if (url.searchParams.get('token') !== token) return reply(res, 403, {error: '访问令牌无效，请使用终端打印的完整地址'});
    if (req.method === 'GET' && url.pathname === '/') {
      res.writeHead(200, {'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'"});
      return res.end(PAGE);
    }
    if (req.method !== 'POST' || url.pathname !== '/upload') return reply(res, 404, {error: '接口不存在'});
    let name;
    try {name = selectName(url.searchParams.get('name'));} catch(e) {return reply(res, 400, {error: e.message});}
    if (Number(req.headers['content-length'] || 0) > maxBytes) return reply(res, 413, {error: '文件超过大小限制'});
    if (busy) return reply(res, 503, {error: '正在上传另一个文件，请稍后重试'});
    busy = true;
    let stage;
    let bytes = 0;
    try {
      if (fs.realpathSync(requested) !== root) throw new Error('目标目录已变化');
      const now = fs.lstatSync(requested);
      if (now.dev !== rootStat.dev || now.ino !== rootStat.ino || now.isSymbolicLink()) throw new Error('目标目录身份已变化');
      stage = fs.mkdtempSync(path.join(root, '.uploads-'));
      const stagedFile = path.join(stage, 'data');
      const limiter = new Transform({transform(chunk, encoding, callback) {
        bytes += chunk.length;
        callback(bytes > maxBytes ? Object.assign(new Error('文件超过大小限制'), {code: 'TOO_LARGE'}) : null, chunk);
      }});
      await pipeline(req, limiter, fs.createWriteStream(stagedFile, {flags: 'wx', mode: 0o600}));
      if (bytes === 0) throw new Error('不能上传空文件');
      // COPYFILE_EXCL prevents overwrite; no hardlinks or FICLONE on Android.
      fs.copyFileSync(stagedFile, path.join(root, name), fs.constants.COPYFILE_EXCL);
      console.log('已导入：' + name + ' (' + bytes + ' bytes)');
      reply(res, 201, {name, bytes});
    } catch(e) {
      if (!res.destroyed && !res.headersSent) reply(res, e.code === 'EEXIST' ? 409 : e.code === 'TOO_LARGE' ? 413 : 400,
        {error: e.code === 'EEXIST' ? '同名文件已存在，未覆盖' : e.message});
    } finally {
      if (stage) fs.rmSync(stage, {recursive: true, force: true});
      busy = false;
    }
  });
  server.requestTimeout = 300000;
  server.headersTimeout = 15000;
  return {server, token, directory: root};
}

function main() {
  const {values, positionals} = parseArgs({options: {port: {type: 'string', default: '8765'}, 'max-mb': {type: 'string', default: '100'}}, allowPositionals: true});
  if (positionals.length > 1) throw new Error('用法：node upload-files.cjs [目录] [--port 8765] [--max-mb 100]');
  const port = Number(values.port), maxMb = Number(values['max-mb']);
  if (!Number.isInteger(port) || port < 0 || port > 65535 || !Number.isInteger(maxMb) || maxMb < 1 || maxMb > 1024) throw new Error('端口或大小限制无效');
  const app = createUploadServer({directory: positionals[0] || path.join(os.homedir(), 'remotion-mv'), maxBytes: maxMb * 1024 * 1024});
  app.server.on('error', e => {console.error('上传服务失败：' + e.message); process.exitCode = 1;});
  app.server.listen(port, '127.0.0.1', () => {
    console.log('UPLOAD_URL=http://127.0.0.1:' + app.server.address().port + '/?token=' + app.token);
    console.log('DESTINATION=' + app.directory);
    console.log('在同一手机浏览器打开完整地址，上传后按 Ctrl+C 停止。');
  });
  const stop = () => {app.server.close(); app.server.closeAllConnections();};
  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);
}
if (require.main === module) {try {main();} catch(e) {console.error(e.message); process.exitCode = 1;}}
module.exports = {createUploadServer, selectName};

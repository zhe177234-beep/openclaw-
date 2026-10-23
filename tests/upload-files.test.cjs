'use strict';
const {test, before, after} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {createUploadServer} = require('../scripts/upload-files.cjs');
let app, address, dir;
before(async () => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'oc-upload-test-'));
  app = createUploadServer({directory: dir, maxBytes: 1024});
  await new Promise(resolve => app.server.listen(0, '127.0.0.1', resolve));
  address = 'http://127.0.0.1:' + app.server.address().port;
});
after(async () => {
  app.server.closeAllConnections();
  await new Promise(resolve => app.server.close(resolve));
  fs.rmSync(dir, {recursive: true, force: true});
});
function upload(name, body, token = app.token) {
  return fetch(address + '/upload?' + new URLSearchParams({token, name}), {method: 'POST', body});
}
test('rejects unauthenticated access and does not expose files', async () => {
  assert.equal((await fetch(address + '/')).status, 403);
  assert.equal((await upload('unauthorized.lrc', 'x', 'wrong')).status, 403);
  assert.equal(fs.existsSync(path.join(dir, 'unauthorized.lrc')), false);
});
test('serves a multiple-file picker only with the temporary token', async () => {
  const response = await fetch(address + '/?token=' + app.token);
  assert.equal(response.status, 200);
  assert.match(await response.text(), /type="file" multiple/);
  assert.match(response.headers.get('content-security-policy'), /frame-ancestors 'none'/);
});
test('imports a Chinese filename with unchanged bytes', async () => {
  const name = '中文素材 (测试).lrc';
  const content = '[00:01.00]测试字幕\n';
  const response = await upload(name, content);
  assert.equal(response.status, 201);
  assert.equal((await response.json()).bytes, Buffer.byteLength(content));
  assert.equal(fs.readFileSync(path.join(dir, name), 'utf8'), content);
});
test('never overwrites an existing filename', async () => {
  fs.writeFileSync(path.join(dir, 'existing.mp3'), 'original');
  assert.equal((await upload('existing.mp3', 'replacement')).status, 409);
  assert.equal(fs.readFileSync(path.join(dir, 'existing.mp3'), 'utf8'), 'original');
});
test('rejects traversal, including Windows separators', async () => {
  for (const name of ['../escape.mp3', 'nested/escape.mp3', '..\\escape.mp3']) {
    assert.equal((await upload(name, 'x')).status, 400);
  }
  assert.equal(fs.existsSync(path.join(dir, 'nested')), false);
});
test('rejects executable extensions and empty files', async () => {
  assert.equal((await upload('run.cjs', 'throw 1')).status, 400);
  assert.equal((await upload('empty.lrc', '')).status, 400);
  assert.equal(fs.existsSync(path.join(dir, 'empty.lrc')), false);
});
test('rejects oversize bodies and removes all staging directories', async () => {
  assert.equal((await upload('huge.mp3', Buffer.alloc(2048))).status, 413);
  assert.equal(fs.existsSync(path.join(dir, 'huge.mp3')), false);
  assert.equal(fs.readdirSync(dir).some(name => name.startsWith('.uploads-')), false);
});

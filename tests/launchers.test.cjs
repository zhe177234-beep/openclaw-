'use strict';
const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {spawnSync} = require('node:child_process');
const project = path.resolve(__dirname, '..');
const token = 'TEST_TOKEN_NOT_A_REAL_CREDENTIAL';

test('SCNet launcher forwards arguments and sets the pre-start shell/temp/model environment', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'oc-launcher-test-'));
  try {
    fs.mkdirSync(path.join(dir, 'bin'));
    fs.symlinkSync(process.execPath, path.join(dir, 'bin/node'));
    fs.symlinkSync('/bin/bash', path.join(dir, 'bin/bash'));
    const key = path.join(dir, 'key.env');
    fs.writeFileSync(key, 'export ANTHROPIC_AUTH_TOKEN=' + token + '\n', {mode: 0o600});
    const cli = path.join(dir, 'stub.cjs');
    fs.writeFileSync(cli, `console.log(JSON.stringify({args:process.argv.slice(2),model:process.env.ANTHROPIC_MODEL,shell:process.env.SHELL,tmp:process.env.TMPDIR,claudeTmp:process.env.CLAUDE_CODE_TMPDIR,tokenLoaded:!!process.env.ANTHROPIC_AUTH_TOKEN,proxy:process.env.HTTPS_PROXY,wrongKey:process.env.ANTHROPIC_API_KEY}));`);
    const result = spawnSync('bash', [path.join(project, 'scripts/start-claude-scnet.sh'), '--continue', '--dangerously-skip-permissions'], {
      encoding: 'utf8', env: {...process.env, PREFIX: dir, CLAUDE_SCNET_KEY_ENV: key, CLAUDE_SCNET_CLI_JS: cli, HTTPS_PROXY: 'http://127.0.0.1:1', ANTHROPIC_API_KEY: 'TEST_UNRELATED_KEY'},
    });
    assert.equal(result.status, 0, result.stderr);
    const data = JSON.parse(result.stdout);
    assert.deepEqual(data.args, ['--continue', '--dangerously-skip-permissions']);
    assert.equal(data.model, 'DeepSeek-V4.1-Flash-1017-Event');
    assert.equal(data.shell, path.join(dir, 'bin/bash'));
    assert.equal(data.tmp, path.join(dir, 'tmp'));
    assert.equal(data.claudeTmp, data.tmp);
    assert.equal(data.tokenLoaded, true);
    assert.equal(data.proxy, undefined);
    assert.equal(data.wrongKey, undefined);
    assert.equal(result.stdout.includes(token), false);
  } finally {fs.rmSync(dir, {recursive: true, force: true});}
});

test('SCNet configuration preserves other dotenv values and never writes the default model', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'oc-config-test-'));
  try {
    const bin = path.join(dir, 'bin');
    const state = path.join(dir, 'state');
    fs.mkdirSync(bin); fs.mkdirSync(state, {mode: 0o700});
    const key = path.join(dir, 'key.env');
    fs.writeFileSync(key, 'export ANTHROPIC_AUTH_TOKEN=' + token + '\n', {mode: 0o600});
    const dotenv = path.join(state, '.env');
    const original = 'KEEP_THIS_SETTING=yes\n';
    fs.writeFileSync(dotenv, original, {mode: 0o600});
    const trace = path.join(dir, 'trace.jsonl');
    const capture = path.join(dir, 'capture.cjs');
    fs.writeFileSync(capture, 'require("node:fs").appendFileSync(process.env.TASK_TRACE_FILE,JSON.stringify(process.argv.slice(2))+"\\n");');
    const shim = path.join(bin, 'openclaw');
    fs.writeFileSync(shim, '#!/bin/bash\nexec ' + JSON.stringify(process.execPath) + ' ' + JSON.stringify(capture) + ' "$@"\n', {mode: 0o700});
    const result = spawnSync('bash', [path.join(project, 'scripts/configure-scnet-openclaw.sh')], {
      encoding: 'utf8', env: {...process.env, PATH: bin + path.delimiter + process.env.PATH, OPENCLAW_STATE_DIR: state, CLAUDE_SCNET_KEY_ENV: key, TASK_TRACE_FILE: trace},
    });
    assert.equal(result.status, 0, result.stderr);
    const data = fs.readFileSync(dotenv, 'utf8');
    assert.match(data, /KEEP_THIS_SETTING=yes/);
    assert.match(data, /SCNET_API_KEY="TEST_TOKEN_NOT_A_REAL_CREDENTIAL"/);
    assert.equal(fs.statSync(dotenv).mode & 0o777, 0o600);
    const backups = fs.readdirSync(state).filter(name => name.startsWith('.env.backup-'));
    assert.equal(backups.length, 1);
    assert.equal(fs.readFileSync(path.join(state, backups[0]), 'utf8'), original);
    const calls = fs.readFileSync(trace, 'utf8').trim().split('\n').map(line => JSON.parse(line));
    assert.deepEqual(calls.map(args => args.slice(0, 3)), [
      ['config', 'set', 'models.providers.scnet'],
      ['config', 'set', 'agents.defaults.models'],
      ['config', 'validate'],
    ]);
    assert.equal(JSON.parse(calls[0][3]).apiKey, '${SCNET_API_KEY}');
    assert.equal(calls.some(args => args[0] === 'models' && args[1] === 'set'), false);
    assert.equal((result.stdout + result.stderr).includes(token), false);
  } finally {fs.rmSync(dir, {recursive: true, force: true});}
});

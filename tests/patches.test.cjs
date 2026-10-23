'use strict';
const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const temp = require('../patches/openclaw-android-temp-fix.cjs');
const copy = require('../patches/openclaw-android-copy-fix.cjs');
const fixture = name => fs.readFileSync(path.join(__dirname, 'fixtures/fs-safe-0.24.2', name), 'utf8');
test('Android temp admission retains the 30 positive and negative policy checks', () => {
  const [owner, child] = temp.buildPatch(fixture('temp-workspace-ownership.js'), fixture('temp-workspace-child-admission.js'));
  assert.equal(temp.verifyPolicy(owner, child), 30);
});
test('patches refuse unknown dependency source bytes', () => {
  assert.throws(() => temp.buildPatch('unexpected', 'unexpected'));
  assert.throws(() => copy.buildPatch('unexpected'));
});
test('clone workaround changes auto only in the selected Android App', () => {
  const source = fixture('copy-root-file-sync.js');
  const patched = copy.buildPatch(source);
  assert.equal(patched.split(copy.AFTER).length, 2);
  assert.equal(patched.replace(copy.AFTER, copy.BEFORE), source);
  const declaration = copy.AFTER.replace('const clone = ', 'result = ');
  const resolveCopyCloneMode = (mode, fallback) => mode ?? fallback;
  for (const [prefix, expected] of [
    ['/data/user/0/com.openclaw.android/files/usr', 'never'],
    ['/data/data/com.openclaw.android/files/usr', 'never'],
    ['/usr/local', 'auto'],
    ['/data/data/com.other.app/files/usr', 'auto'],
  ]) {
    const context = {process: {env: {PREFIX: prefix}}, options: {clone: 'auto'}, resolveCopyCloneMode};
    vm.runInNewContext(declaration, context);
    assert.equal(context.result, expected);
    for (const explicit of ['never', 'always']) {
      context.options.clone = explicit;
      vm.runInNewContext(declaration, context);
      assert.equal(context.result, explicit);
    }
  }
});

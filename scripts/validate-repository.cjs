#!/usr/bin/env node
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const {spawnSync} = require('node:child_process');
const root = path.resolve(__dirname, '..');
const files = [];
function walk(dir) {
  for (const item of fs.readdirSync(dir, {withFileTypes: true})) {
    if (item.name === '.git' || item.name === 'node_modules') continue;
    const absolute = path.join(dir, item.name);
    if (item.isDirectory()) walk(absolute); else if (item.isFile()) files.push(absolute);
  }
}
walk(root);
let js = 0, shell = 0, json = 0, links = 0;
for (const file of files) {
  if (/\.(?:cjs|js)$/.test(file)) {
    const r = spawnSync(process.execPath, ['--check', file], {encoding: 'utf8'});
    if (r.status !== 0) throw new Error(path.relative(root, file) + '\n' + r.stderr);
    js++;
  }
  if (file.endsWith('.sh')) {
    const r = spawnSync('bash', ['-n', file], {encoding: 'utf8'});
    if (r.status !== 0) throw new Error(path.relative(root, file) + '\n' + r.stderr);
    shell++;
  }
  if (file.endsWith('.json')) {JSON.parse(fs.readFileSync(file, 'utf8')); json++;}
  if (file.endsWith('.md')) {
    const text = fs.readFileSync(file, 'utf8');
    for (const match of text.matchAll(/\]\(([^\s)]+)\)/g)) {
      const target = match[1];
      if (/^(?:https?:|mailto:|#)/.test(target)) continue;
      const absolute = path.resolve(path.dirname(file), decodeURIComponent(target.split('#')[0]));
      if (!fs.existsSync(absolute)) throw new Error('Missing link: ' + path.relative(root, file) + ' -> ' + target);
      links++;
    }
  }
}
console.log(`Validated ${js} JS files, ${shell} Bash files, ${json} JSON files and ${links} local Markdown links.`);

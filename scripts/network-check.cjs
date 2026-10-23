#!/usr/bin/env node
'use strict';
// A connectivity probe only: no credential reads, no inference request.
async function main() {
  try {
    const response = await fetch('https://api.scnet.cn/api/llm/anthropic/v1/messages', {
      method: 'POST', headers: {'Content-Type': 'application/json'}, body: '{}',
      signal: AbortSignal.timeout(15000),
    });
    console.log('HTTP状态：', response.status);
    console.log('这里只验证 HTTP 连通性，未验证密钥、模型、额度或推理。');
    await response.body?.cancel();
  } catch (e) {
    console.log('错误：', e.message);
    console.log('底层代码：', e.cause?.code ?? e.code ?? '(无)');
    console.log('底层原因：', e.cause?.message ?? '(无)');
    process.exitCode = 1;
  }
}
if (require.main === module) main();
module.exports = {main};

/**
 * 在真实浏览器（headless Chrome + dev server）里跑和弦 OCR 自测：
 *   node scripts/test-ocr-browser.mjs [端口]
 * 通过 CDP 在页面上下文执行 recognizeChords，验证 worker/wasm/训练数据
 * 的本地加载与行重组逻辑，比 node 环境更贴近 App 实际运行方式。
 */
import { spawn } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const PORT = process.argv[2] ?? '5173';
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const DEBUG_PORT = 9333;

const profile = mkdtempSync(join(tmpdir(), 'chrome-ocr-'));
const chrome = spawn(CHROME, [
  '--headless=new', '--disable-gpu', '--no-first-run', '--no-proxy-server', '--no-default-browser-check',
  `--remote-debugging-port=${DEBUG_PORT}`, `--user-data-dir=${profile}`,
  'about:blank',
], { stdio: 'ignore' });
process.on('exit', () => { try { chrome.kill(); } catch {} });

// 等 DevTools 就绪
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
let targets;
for (let i = 0; i < 40; i += 1) {
  try {
    const response = await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/list`);
    targets = await response.json();
    if (targets.length) break;
  } catch {}
  await wait(500);
}
if (!targets?.length) { console.error('[browser-test] DevTools 未就绪'); process.exit(1); }

const page = targets.find((target) => target.type === 'page');
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });

let nextId = 1;
const pending = new Map();
const events = [];
ws.onmessage = (event) => {
  const message = JSON.parse(event.data);
  if (message.id && pending.has(message.id)) {
    pending.get(message.id)(message);
    pending.delete(message.id);
  } else if (message.method) {
    events.push(message);
  }
};
const send = (method, params) => new Promise((resolve) => {
  const id = nextId++;
  pending.set(id, resolve);
  ws.send(JSON.stringify({ id, method, params }));
});

// 显式导航并等页面真正加载完
await send('Page.enable');
await send('Page.navigate', { url: `http://127.0.0.1:${PORT}/` });
for (let i = 0; i < 40 && !events.some((event) => event.method === 'Page.loadEventFired'); i += 1) await wait(250);
const state = await send('Runtime.evaluate', { expression: 'location.href', returnByValue: true });
console.log(`[browser-test] 已打开：${state.result?.result?.value}`);

const expression = `(async () => {
  const { recognizeChords } = await import('/src/lib/chordOcr.ts');
  const blob = await (await fetch('/chord-sheet-test.png')).blob();
  const result = await recognizeChords(blob);
  return JSON.stringify({ text: result.text, rawPreview: result.rawText.replace(/\\n{2,}/g, '\\n').slice(0, 500) }, null, 2);
})()`;

console.log('[browser-test] 开始识别（首次需加载 wasm，约 10~40 秒）…');
const started = Date.now();
const reply = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
console.log(`[browser-test] 耗时 ${((Date.now() - started) / 1000).toFixed(1)}s`);
if (reply.error) { console.error('[browser-test] CDP 错误:', reply.error); process.exit(1); }
if (reply.result?.exceptionDetails) {
  console.error('[browser-test] 页面执行出错:', JSON.stringify(reply.result.exceptionDetails, null, 2));
  process.exit(1);
}
console.log('=== 识别出的和弦行 ===');
console.log(reply.result.result.value);
ws.close();
chrome.kill();
process.exit(0);

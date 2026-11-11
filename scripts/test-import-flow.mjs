/**
 * 弹唱谱导入全流程自动化验证（headless Chrome + CDP）：
 *   1. 进入 /import，选择「弹唱谱」
 *   2. 向隐藏的文件选择框注入测试图片（public/chord-sheet-test.png）
 *   3. 等和弦识别完成（缩略图徽章消失）
 *   4. 进入第 2 步，填标题，保存
 *   5. 检查谱面页是否自动出现「本谱和弦」条，并截图
 * 用法：node scripts/test-import-flow.mjs [端口] [截图保存路径]
 */
import { spawn } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const PORT = process.argv[2] ?? '5173';
const shotPath = process.argv[3] ?? fileURLToPath(new URL('../.workbuddy/validation/import-flow.png', import.meta.url));
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const DEBUG_PORT = 9335;

const root = fileURLToPath(new URL('../', import.meta.url));
const profile = mkdtempSync(join(tmpdir(), 'chrome-import-'));
const chrome = spawn(CHROME, [
  '--headless=new', '--disable-gpu', '--no-first-run', '--no-proxy-server', '--no-default-browser-check',
  `--remote-debugging-port=${DEBUG_PORT}`, `--user-data-dir=${profile}`,
  '--window-size=390,880',
  'about:blank',
], { stdio: 'ignore' });
process.on('exit', () => { try { chrome.kill(); } catch {} });

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
  } else if (message.method) events.push(message);
};
const send = (method, params) => new Promise((resolve) => {
  const id = nextId++;
  pending.set(id, resolve);
  ws.send(JSON.stringify({ id, method, params }));
});
const evaluate = async (expression) => {
  const reply = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  if (reply.result?.exceptionDetails) throw new Error(JSON.stringify(reply.result.exceptionDetails.exception?.description ?? reply.result.exceptionDetails));
  return reply.result?.result?.value;
};

await send('Page.enable');
await send('Page.navigate', { url: `http://127.0.0.1:${PORT}/import` });
for (let i = 0; i < 40 && !events.some((event) => event.method === 'Page.loadEventFired'); i += 1) await wait(250);
await wait(400);
console.log(`[import-test] 已打开：${await evaluate('location.href')}`);

// 1. 选择弹唱谱
await evaluate(`(() => {
  const card = [...document.querySelectorAll('.type-choice-card')].find((el) => el.textContent.includes('弹唱谱'));
  if (!card) throw new Error('找不到弹唱谱类型卡片');
  card.click();
})()`);
await wait(200);

// 2. 注入测试图片
await evaluate(`(async () => {
  const blob = await (await fetch('/chord-sheet-test.png')).blob();
  const file = new File([blob], '童年弹唱谱.png', { type: 'image/png' });
  const transfer = new DataTransfer();
  transfer.items.add(file);
  const input = document.querySelector('input[type=file]');
  input.files = transfer.files;
  input.dispatchEvent(new Event('change', { bubbles: true }));
})()`);
console.log('[import-test] 已注入测试图片，等待和弦识别…');

// 3. 等识别完成：徽章先出现后消失
const waitUntil = async (predicateSource, label, timeoutMs = 90000) => {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const value = await evaluate(predicateSource);
    if (value) return value;
    await wait(800);
  }
  throw new Error(`等待超时：${label}`);
};

const badge = await waitUntil(`Boolean(document.querySelector('.thumb-ocr'))`, '识别徽章出现', 20000).catch(() => null);
console.log(`[import-test] 徽章：${badge ? await evaluate('document.querySelector(".thumb-ocr")?.textContent') : '（未及捕获）'}`);
await waitUntil(`!document.querySelector('.thumb-ocr')`, '识别完成');

// 4. 进入第 2 步并保存
await evaluate(`(() => {
  const next = [...document.querySelectorAll('button')].find((el) => el.textContent.includes('整理页码'));
  next.click();
})()`);
await wait(400);
const banner = await evaluate(`document.querySelector('.recognition-banner p')?.textContent`);
console.log(`[import-test] 第 2 步汇总：${banner}`);
await evaluate(`(() => {
  const input = document.querySelector('.recognition-meta input');
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
  setter.call(input, '童年');
  input.dispatchEvent(new Event('input', { bubbles: true }));
})()`);
await wait(200);
await evaluate(`(() => {
  const save = [...document.querySelectorAll('button')].find((el) => el.textContent.includes('保存到谱架'));
  save.click();
})()`);
await waitUntil(`location.pathname.startsWith('/score/')`, '跳转到谱面页', 15000);
await wait(600);
console.log(`[import-test] 谱面页：${await evaluate('location.href')}`);

// 5. 检查和弦条
await waitUntil(`Boolean(document.querySelector('.used-chords'))`, '和弦条渲染', 15000).catch(() => {});
const result = await evaluate(`(() => ({
  stripVisible: Boolean(document.querySelector('.used-chords')),
  headText: document.querySelector('.used-chords-head')?.textContent ?? null,
  chordNames: [...document.querySelectorAll('.used-chord > b')].map((el) => el.textContent),
  hasRecognizeButton: [...document.querySelectorAll('button')].some((el) => el.textContent.includes('识别和弦')),
  scrollPages: document.querySelectorAll('.original-scroll-page').length,
}))()`);
console.log('[import-test] 结果：', JSON.stringify(result, null, 2));

// 6. 截图
const meta = await send('Page.getLayoutMetrics');
const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true });
writeFileSync(shotPath, Buffer.from(shot.result.data, 'base64'));
console.log(`[import-test] 截图已保存：${shotPath}（页面高 ${meta.result.contentSize.height}px）`);

ws.close();
chrome.kill();
process.exit(result.stripVisible && result.chordNames.length >= 8 ? 0 : 1);

/**
 * 把 tesseract 运行文件从 node_modules 复制到 public/。
 * worker 与 wasm 跟 tesseract.js 版本绑定，构建时按 package.json 自动取对应版本，
 * 所以它们不进 git（见 .gitignore），dev/build 前都会跑一遍这个脚本。
 * eng.traineddata.gz 与版本无关且改动需要评审，直接提交在 public/tessdata/。
 */
import { copyFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

const files = [
  ['tesseract.js/dist/worker.min.js', 'public/vendor/tesseract/worker.min.js'],
  ['tesseract.js-core/tesseract-core-simd-lstm.wasm.js', 'public/vendor/tesseract/tesseract-core-simd-lstm.wasm.js'],
];

for (const [, target] of files) mkdirSync(join(root, dirname(target)), { recursive: true });

const missing = [];
for (const [from, to] of files) {
  const source = join(root, 'node_modules', from);
  if (!existsSync(source)) { missing.push(from); continue; }
  copyFileSync(source, join(root, to));
}

if (missing.length) {
  console.error('[copy-ocr-assets] 缺少依赖文件，请先执行 npm install：\n  ' + missing.join('\n  '));
  process.exit(1);
}
console.log('[copy-ocr-assets] OK: worker.min.js + tesseract-core-simd-lstm.wasm.js 已就绪');

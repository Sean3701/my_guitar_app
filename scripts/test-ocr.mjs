/**
 * 验证弹唱谱和弦识别（node 版，与 src/lib/chordOcr.ts 同一套逻辑）：
 *   node scripts/test-ocr.mjs [图片路径]
 * 不传图片路径时，用 scripts/fixtures/chord-sheet.png（模拟弹唱谱截图）。
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createWorker } from 'tesseract.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const image = process.argv[2] ?? fileURLToPath(new URL('./fixtures/chord-sheet.png', import.meta.url));
const data = readFileSync(image);
console.log(`[test-ocr] 图片：${image} (${(data.length / 1024).toFixed(0)} KB)`);

const langDir = `${root}node_modules/@tesseract.js-data/eng/4.0.0_best_int/`;

const worker = await createWorker('eng', 1, { langPath: langDir, gzip: true, cacheMethod: 'none' });
await worker.setParameters({ user_defined_dpi: '150' });
const result = await worker.recognize(data, {}, { text: true, blocks: true });
await worker.terminate();

// ===== 以下与 src/lib/chordOcr.ts 保持一致 =====
const CHORD_TOKEN = /\b([A-G](?:#|b)?(?:maj9|maj7|maj|min7|min|dim7|dim|aug|sus4|sus2|sus|add11|add9|m7b5|7sus4|m7|m6|m9|m|13|11|9|7|6|5)?(?:\/[A-G](?:#|b)?)?)\b/g;
const MIN_WORD_CONFIDENCE = 40;
const MIN_ROW_RATIO = 0.6;

const words = [];
for (const block of result.data.blocks ?? []) {
  for (const paragraph of block.paragraphs ?? []) {
    for (const line of paragraph.lines ?? []) {
      for (const word of line.words ?? []) {
        const text = word.text?.replace(/\s+/g, '') ?? '';
        if (!text || !word.bbox || word.confidence < MIN_WORD_CONFIDENCE) continue;
        words.push({ text, x0: word.bbox.x0, y0: word.bbox.y0, height: word.bbox.y1 - word.bbox.y0 });
      }
    }
  }
}

const heights = words.map((word) => word.height).sort((a, b) => a - b);
const medianHeight = heights[Math.floor(heights.length / 2)] || 20;
const threshold = Math.max(8, medianHeight * 0.65);

const rows = [];
for (const word of [...words].sort((a, b) => a.y0 - b.y0 || a.x0 - b.x0)) {
  const row = rows[rows.length - 1];
  if (row && Math.abs(word.y0 - row.y0) <= threshold) row.words.push(word);
  else rows.push({ y0: word.y0, words: [word] });
}

const chordRows = [];
for (const row of rows) {
  const lineText = row.words.sort((a, b) => a.x0 - b.x0).map((word) => word.text).join(' ');
  const tokens = [...lineText.matchAll(CHORD_TOKEN)].map((match) => match[1]);
  const solid = lineText.replace(/\s/g, '');
  const ratio = tokens.length && solid ? tokens.join('').length / solid.length : 0;
  const keep = tokens.length && ratio >= MIN_ROW_RATIO;
  console.log(`${keep ? '✓ 和弦行' : '✗ 丢弃 '} ${ratio.toFixed(2)}  ${JSON.stringify(lineText)}`);
  if (keep) chordRows.push(tokens.join('  '));
}

const unique = [...new Set(chordRows.join(' ').split(/\s+/))];
console.log(`\n[test-ocr] 保留 ${chordRows.length} 个和弦行，识别出 ${unique.length} 个和弦：${unique.join(' ')}`);

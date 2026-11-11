/**
 * 弹唱谱图片的和弦识别。
 *
 * 用 tesseract.js 跑纯英文 LSTM 模型：和弦记号是拉丁字母能被认出来，
 * 中文歌词会被当作噪声丢掉或输出成无意义拉丁串，正好把两类内容分开。
 * worker、wasm、训练数据全部打包在 public 里，离线可用、不依赖网络。
 *
 * 识别流程：recognize 拿到每个词的坐标和置信度 → 按纵向位置把词重组成
 * 「视觉行」（和弦记号浮在歌词上方，排版上是独立的一行，但整页 OCR 常把
 * 两者黏成一行文本）→ 用 chordCoverage 判断哪些行是和弦行 → 只保留和弦行。
 * 这样即使布局分析出错，和弦也不会被歌词吞掉。
 */
import { createWorker, type Worker } from 'tesseract.js';
import { resolveChord } from '../data/chords';
import { chordCoverage } from './chordParse';

const BASE = import.meta.env.BASE_URL || '/';

/** 低于此置信度的词直接丢，避免把噪声算进和弦行 */
const MIN_WORD_CONFIDENCE = 40;
/** 和弦字符至少要占一行的多少比例，才认定这行是和弦行 */
const MIN_ROW_RATIO = 0.6;
/** OCR 前把图片放大到这个宽度，小字号下粗体字母才不会被切成两个字符（C 读成 Cc） */
const OCR_TARGET_WIDTH = 1600;
/** 放大后总像素上限：竖长截图别一次画几十 MB 的画布 */
const OCR_MAX_PIXELS = 12e6;

let workerPromise: Promise<Worker> | null = null;
let progressSink: ((ratio: number) => void) | null = null;

async function getWorker() {
  if (!workerPromise) {
    workerPromise = createWorker('eng', 1, {
      // 三件套都指向本地打包文件，别让它去 CDN 下载
      workerPath: `${BASE}vendor/tesseract/worker.min.js`,
      workerBlobURL: false,
      corePath: `${BASE}vendor/tesseract/tesseract-core-simd-lstm.wasm.js`,
      langPath: `${BASE}tessdata`,
      gzip: true,
      cacheMethod: 'none',
      logger: (message) => {
        if (message.status === 'recognizing text' && progressSink) progressSink(message.progress);
      },
    }).then(async (worker) => {
      // 压缩后的图片没有 DPI 信息，不声明的话 tesseract 会告警并自行猜测
      await worker.setParameters({ user_defined_dpi: '96' });
      return worker;
    });
    workerPromise.catch(() => { workerPromise = null; });
  }
  return workerPromise;
}

/** 用完就释放 wasm 占的内存（几十 MB），下次用时再加载 */
export async function disposeOcr() {
  const promise = workerPromise;
  workerPromise = null;
  progressSink = null;
  await promise?.then((worker) => worker.terminate()).catch(() => {});
}

/**
 * OCR 前的放大预处理。和弦记号在谱子里通常只有 20~40px 高，
 * 直接识别会把粗体字母切成两个（C → Cc、F → FIF），
 * 放大到约 1600px 宽就没有这类问题。已经够宽的图不动，省内存。
 */
async function prepareForOcr(blob: Blob): Promise<Blob> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(blob);
  } catch {
    return blob;
  }
  const { width, height } = bitmap;
  let scale = Math.min(2, Math.max(1, OCR_TARGET_WIDTH / Math.max(width, 1)));
  const pixels = width * scale * height * scale;
  if (pixels > OCR_MAX_PIXELS) scale = Math.sqrt(OCR_MAX_PIXELS / (width * height));
  if (scale <= 1.05) {
    bitmap.close();
    return blob;
  }
  try {
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(width * scale);
    canvas.height = Math.round(height * scale);
    const context = canvas.getContext('2d');
    if (!context) return blob;
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.imageSmoothingQuality = 'high';
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    return await new Promise<Blob>((resolve) => canvas.toBlob((result) => resolve(result ?? blob), 'image/png'));
  } catch {
    return blob;
  } finally {
    bitmap.close();
  }
}

/**
 * 常见 OCR 伪影清洗：开头的重复字母（Cc、GG）压回单个。
 * 但 Bb 本身就是合法的降号和弦根音，所以先试原词，是和弦就不动。
 */
function cleanWord(text: string) {
  if (resolveChord(text)) return text;
  const collapsed = text.replace(/^([A-Ga-g])\1+/i, (_artifact, letter: string) => letter.toUpperCase());
  return collapsed !== text && resolveChord(collapsed) ? collapsed : text;
}

interface OcrWord {
  text: string;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  height: number;
}

/** 展平 OCR 结果并按置信度过滤 */
function collectWords(blocks: { paragraphs?: { lines?: { words?: unknown[] }[] }[] }[]): OcrWord[] {
  const words: OcrWord[] = [];
  for (const block of blocks ?? []) {
    for (const paragraph of block.paragraphs ?? []) {
      for (const line of paragraph.lines ?? []) {
        for (const word of line.words ?? []) {
          const item = word as { text?: string; confidence?: number; bbox?: { x0: number; y0: number; x1: number; y1: number } };
          const text = item.text?.replace(/\s+/g, '') ?? '';
          if (!text || !item.bbox || (item.confidence ?? 0) < MIN_WORD_CONFIDENCE) continue;
          words.push({
            text,
            x0: item.bbox.x0, y0: item.bbox.y0, x1: item.bbox.x1, y1: item.bbox.y1,
            height: item.bbox.y1 - item.bbox.y0,
          });
        }
      }
    }
  }
  return words;
}

/** 按纵向位置把词聚成视觉行：同一行的词顶部基本对齐 */
function groupRows(words: OcrWord[]) {
  if (!words.length) return [];
  const heights = words.map((word) => word.height).sort((a, b) => a - b);
  const medianHeight = heights[Math.floor(heights.length / 2)] || 20;
  const threshold = Math.max(8, medianHeight * 0.65);

  const rows: { y0: number; words: OcrWord[] }[] = [];
  for (const word of [...words].sort((a, b) => a.y0 - b.y0 || a.x0 - b.x0)) {
    const row = rows[rows.length - 1];
    if (row && Math.abs(word.y0 - row.y0) <= threshold) {
      row.words.push(word);
    } else {
      rows.push({ y0: word.y0, words: [word] });
    }
  }
  return rows.map((row) => row.words.sort((a, b) => a.x0 - b.x0));
}

export interface ChordOcrResult {
  /** 识别出的和弦行文本，一行一行排好，直接喂给 extractChords */
  text: string;
  /** 整页 OCR 原始文本，排查识别问题用 */
  rawText: string;
}

/** 识别一张谱子图片里标注的和弦，onProgress 汇报 0~1 的整体进度 */
export async function recognizeChords(image: Blob, onProgress?: (ratio: number) => void): Promise<ChordOcrResult> {
  progressSink = onProgress ?? null;
  try {
    const worker = await getWorker();
    const result = await worker.recognize(await prepareForOcr(image), {}, { text: true, blocks: true });
    const rawText = result.data.text ?? '';

    const words = collectWords(result.data.blocks ?? []);
    const lines: string[] = [];
    for (const row of groupRows(words)) {
      const lineText = row.map((word) => cleanWord(word.text)).join(' ');
      const { tokens, ratio } = chordCoverage(lineText);
      // 大多数 token 出现在相邻行时可看做同一和弦的分裂识别（Am 7 → Am7），先不做合并，交给解析层
      if (!tokens.length || ratio < MIN_ROW_RATIO) continue;
      lines.push(tokens.join('  '));
    }
    return { text: lines.join('\n'), rawText };
  } finally {
    progressSink = null;
  }
}

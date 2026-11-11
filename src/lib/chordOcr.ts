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
import { chordCoverage } from './chordParse';
import { isExactChord } from '../data/chords';

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
 * OCR 伪影清洗。策略：能「精确」解析成和弦的原样保留（Bb、Em7 都是合法记号），
 * 否则逐级尝试清洗：去首尾标点 → 压掉开头重复的同字母（Cc → C，Bb 大小写不同不受影响）
 * → 压掉尾部黏连的小写噪声（Eo → E）。全失败时返回去过标点的词。
 */
function cleanWord(text: string) {
  if (isExactChord(text)) return text;
  const trimmed = text.replace(/^[^A-Za-z0-9#]+|[^A-Za-z0-9#]+$/g, '');
  if (trimmed && isExactChord(trimmed)) return trimmed;
  const collapsed = trimmed.replace(/^([A-G])\1+/, '$1');
  if (collapsed !== trimmed && isExactChord(collapsed)) return collapsed;
  // 尾部小写噪声只在整词不是合法记号时才压掉，保护 Bb、Em 这类
  const coverage = chordCoverage(trimmed);
  const isFullToken = coverage.tokens.length === 1 && coverage.tokens[0] === trimmed;
  if (!isFullToken) {
    const stripped = trimmed.replace(/[a-z]+$/, '');
    if (stripped && stripped !== trimmed && isExactChord(stripped)) return stripped;
  }
  return trimmed || text;
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
    const rows = groupRows(words).map((row) => {
      const lineText = row.map((word) => cleanWord(word.text)).join(' ');
      const { tokens, ratio } = chordCoverage(lineText);
      return { tokens, ratio };
    });
    // 第一个带性质后缀的记号（Em、G7、Csus4…）之前的行都在谱头区：标题、调号、
    // Capo 标记。这一行的乱码（「选调：」读成 EE:）最容易被清洗成单个裸字母，
    // 所以谱头区只保留有 3 个以上记号的行（真前奏行 C G D 这种）。
    const firstAnchored = rows.findIndex(
      (row) => row.ratio >= MIN_ROW_RATIO && row.tokens.some((token) => !/^[A-G][#b]?$/.test(token)),
    );
    const lines: string[] = [];
    for (const [index, row] of rows.entries()) {
      if (!row.tokens.length || row.ratio < MIN_ROW_RATIO) continue;
      // 整行只剩一个裸根音（C、G 这种无后缀单字母）同样不可信
      if (row.tokens.length === 1 && /^[A-G][#b]?$/.test(row.tokens[0])) continue;
      if (index < firstAnchored && row.tokens.length < 3) continue;
      lines.push(row.tokens.join('  '));
    }
    return { text: lines.join('\n'), rawText };
  } finally {
    progressSink = null;
  }
}

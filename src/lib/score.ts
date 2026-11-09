import type { Score, ScoreType } from '../types';

export const uid = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

export function detectTitle(text: string, fileName = '') {
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const labelled = text.match(/(?:歌名|曲名|标题)\s*[:：]?\s*([^\n]{1,30})/i);
  if (labelled) return labelled[1].trim();
  const candidate = lines.find((line) => {
    const clean = line.replace(/[\s|_\-—0-9xX]/g, '');
    return clean.length >= 2 && clean.length <= 20 && !/(六线谱|吉他谱|弹唱谱|第.+页|编配|制谱|演唱|词|曲)/.test(line);
  });
  if (candidate) return candidate;
  const fromFile = fileName.replace(/\.[^.]+$/, '').replace(/[-_](\d+)$/, '');
  // 截图、相机原图的文件名不是歌名，别拿它当默认标题
  return (fromFile && !isCaptureName(fromFile) ? fromFile : '') || '未命名琴谱';
}

/** 手机截图 / 相机 / 微信导出的文件名：长得像 IMG_20261109_144659、Screenshot_2026-11-09-14-46-59-179 这类 */
function isCaptureName(name: string) {
  return /^(img|dsc|pxl|mvimg|screenshot|截屏|截图|微信图片|mmexport|photo|image)/i.test(name)
    || /\d{4}[-_.年]?\d{1,2}[-_.月]?\d{1,2}/.test(name)
    || /\d{6,}/.test(name);
}

/**
 * 从文件名猜页码。只认明确的页码线索，猜不出来就按导入顺序编号：
 * 截图文件常叫 Screenshot_2026-11-09-14-46-59-179.jpg / IMG_20261109_144659.jpg，
 * 末尾的 179、59 是时间戳碎片，当成页码就会出现「第 179 页」这种错号。
 */
export function detectPageNumber(text: string, fallback: number) {
  const name = text.replace(/\.[a-z0-9]{1,5}$/i, '').trim();
  const accept = (raw: string | undefined, max: number) => {
    const value = Number(raw);
    return Number.isFinite(value) && value >= 1 && value <= max ? value : fallback;
  };
  // 明确的「第 N 页」/ page 3 / page_03 / page-3
  const cued = name.match(/第\s*(\d{1,3})\s*页/) || name.match(/\bpage[\s._-]*(\d{1,3})\b/i);
  if (cued) return accept(cued[1], 999);
  // 名字里带完整日期或一长串数字（时间戳、导出 id），后面的数字一律不算页码
  if (isCaptureName(name)) return fallback;
  // 整个文件名就是页码：3 / 03 / 第3页
  const bare = name.match(/^(?:第\s*)?(\d{1,3})(?:\s*页)?$/);
  if (bare) return accept(bare[1], 99);
  // 结尾用分隔符标页码：吉他谱-3 / 曲谱_p3 / song 3
  const tail = name.match(/[-_ ][pP]?(\d{1,3})$/);
  return tail ? accept(tail[1], 99) : fallback;
}

export function createChordDraft(text: string) {
  if (text.trim().length > 20) return text.trim();
  return `[前奏]\n| C  G | Am  Em | F  C | F  G |\n\n[主歌]\nC           G\n在这里输入第一句歌词\nAm          Em\n在这里输入第二句歌词\nF           C\n在这里输入第三句歌词\nF     G     C\n在这里输入第四句歌词`;
}

export function emptyScore(type: ScoreType, title = '未命名琴谱'): Score {
  const now = Date.now();
  return {
    id: uid(), title, artist: '', type, musicalKey: 'C', capo: 0, bpm: type === 'tab' ? 90 : 72,
    timeSignature: '4/4', sections: [], chordText: type === 'chord' ? createChordDraft('') : '',
    sourcePages: [], favorite: false, createdAt: now, updatedAt: now,
  };
}

export function formatDate(timestamp: number) {
  const date = new Date(timestamp);
  const now = new Date();
  const sameYear = date.getFullYear() === now.getFullYear();
  return date.toLocaleDateString('zh-CN', sameYear ? { month: 'short', day: 'numeric' } : { year: 'numeric', month: 'short', day: 'numeric' });
}

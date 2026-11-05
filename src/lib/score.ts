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
  return candidate || fileName.replace(/\.[^.]+$/, '').replace(/[-_](\d+)$/, '') || '未命名琴谱';
}

export function detectPageNumber(text: string, fallback: number) {
  const match = text.match(/(?:第\s*(\d{1,3})\s*页|(?:page|p)\s*[.:-]?\s*(\d{1,3})|^\s*[-—]?\s*(\d{1,3})\s*[-—]?\s*$)/im);
  const fileMatch = match ? null : text.match(/(?:^|[-_ ])(\d{1,3})(?:\.[a-z0-9]+)?$/i);
  return Number(match?.[1] || match?.[2] || match?.[3] || fileMatch?.[1]) || fallback;
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

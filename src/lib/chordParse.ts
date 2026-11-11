import { resolveChord, type ChordResolution } from '../data/chords';

/**
 * 和弦记号。性质按长度从长到短排，正则才会优先吃掉「maj7」而不是「m」。
 * 前后都用 \b 卡住，避免 Baby、Email 这种单词被误认成 B、Em。
 */
const CHORD_TOKEN = /\b([A-G](?:#|b)?(?:maj9|maj7|maj|min7|min|dim7|dim|aug|sus4|sus2|sus|add11|add9|m7b5|7sus4|m7|m6|m9|m|13|11|9|7|6|5)?(?:\/[A-G](?:#|b)?)?)\b/g;

/** 和弦行里允许出现的非和弦字符：小节线、空格、重复记号等 */
const SEPARATORS = /[\s|_:·•\-—–~,，、;；()（）[\]{}<>/\\]/g;

function normalizeText(text: string) {
  return text
    .replace(/[♯＃]/g, '#')
    .replace(/[♭ｂ]/g, 'b')
    .replace(/[／]/g, '/')
    .replace(/[｜]/g, '|')
    // 全角字母数字转半角，OCR 和中文输入法都爱输出全角
    .replace(/[Ａ-Ｚａ-ｚ０-９]/g, (char) => String.fromCharCode(char.charCodeAt(0) - 0xfee0));
}

function tokensOf(line: string) {
  return [...line.matchAll(CHORD_TOKEN)].map((match) => ({ raw: match[1], index: match.index ?? 0 }));
}

/** 整行除了和弦和小节线什么都不剩，才算和弦行 */
export function isChordLine(line: string) {
  const trimmed = line.trim();
  if (!trimmed) return false;
  if (!tokensOf(trimmed).length) return false;
  return trimmed.replace(CHORD_TOKEN, '').replace(SEPARATORS, '').length === 0;
}

export interface UsedChord {
  /** 谱面上写的名字，保留原拼写 */
  name: string;
  /** 出现次数 */
  count: number;
  resolution: ChordResolution;
}

/**
 * 从和弦谱文本里挑出用到的和弦，按首次出现的顺序排列。
 * 优先只认和弦行——歌词里单独一个 A 或 B 不能当成和弦；
 * 整段都找不到和弦行时（OCR 常把谱面吐成连续文字）才退回全文扫描。
 */
export function extractChords(input: string): UsedChord[] {
  const text = normalizeText(input || '');
  const collected: string[] = [];

  for (const line of text.split(/\r?\n/)) {
    if (isChordLine(line)) {
      collected.push(...tokensOf(line).map((token) => token.raw));
      continue;
    }
    // 行内标注：[C] 这种写法夹在歌词里也要认，[前奏] 这种段落名会被解析丢掉
    for (const match of line.matchAll(/[[［]([^\]］\n]{1,12})[\]］]/g)) {
      const inner = match[1].trim();
      if (resolveChord(inner)) collected.push(inner);
    }
  }

  // 没有任何和弦行：退回全文扫描，至少别让整段 OCR 文本白费
  if (!collected.length) {
    collected.push(...tokensOf(text).map((token) => token.raw));
  }

  const used: UsedChord[] = [];
  const seen = new Map<string, UsedChord>();
  for (const raw of collected) {
    const resolution = resolveChord(raw);
    if (!resolution) continue;
    // 同一个和弦的不同写法（F# 与 Gb、CM7 与 Cmaj7）合并成一张指法图
    const key = resolution.entry.name;
    const existing = seen.get(key);
    if (existing) {
      existing.count += 1;
      continue;
    }
    const item: UsedChord = { name: raw, count: 1, resolution };
    seen.set(key, item);
    used.push(item);
  }
  return used;
}

/** 一段文本里出现的和弦名，按首次出现排列，用于「识别到的和弦」这类摘要 */
export const usedChordNames = (text: string) => extractChords(text).map((chord) => chord.name);

import type { ChordPosition } from '../types';
import raw from './chords.json';

/** 和弦性质，决定它在和弦库里的分组 */
export type ChordGroup = 'major' | 'minor' | 'dom7' | 'maj7' | 'm7' | 'sus' | 'add' | 'six' | 'nine' | 'dim' | 'power' | 'slash';

export interface ChordEntry extends ChordPosition {
  name: string;
  group: ChordGroup;
  frets: number[];
  fingers: number[];
  barres: number[];
  baseFret: number;
  /** 根音，如 C# */
  root: string;
  /** 性质后缀，如 m7、sus4，大三和弦为空串 */
  suffix: string;
  /** 低音（斜杠和弦斜杠后的音），没有斜杠时与根音相同 */
  bass: string;
  /** 实际发出的音（低音在前），用于详情页 */
  notes: string[];
  /** 是否用降号记谱，决定音名显示成 A# 还是 Bb */
  flats: boolean;
}

export const CHORD_GROUPS: { key: ChordGroup; label: string; hint: string }[] = [
  { key: 'major', label: '大三和弦', hint: '最基础的 12 个调' },
  { key: 'minor', label: '小三和弦', hint: '带一点忧郁的味道' },
  { key: 'dom7', label: '属七和弦', hint: '回到主和弦的推力' },
  { key: 'maj7', label: '大七和弦', hint: '明亮、松弛' },
  { key: 'm7', label: '小七和弦', hint: '流行歌里最常见' },
  { key: 'sus', label: '挂留和弦', hint: '悬着不落地的听感' },
  { key: 'add', label: '加九和弦', hint: '民谣常用色彩' },
  { key: 'six', label: '六和弦', hint: '老派的甜味' },
  { key: 'nine', label: '九和弦', hint: '更厚的色彩' },
  { key: 'dim', label: '减 / 增和弦', hint: '过渡与紧张感' },
  { key: 'power', label: '强力和弦', hint: '摇滚必备，只要根音和五度' },
  { key: 'slash', label: '斜杠和弦', hint: '指定低音的转位' },
];

const PITCH: Record<string, number> = {
  C: 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, F: 5, 'F#': 6, Gb: 6, G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11,
};
const SHARP_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const FLAT_NAMES = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
/** 空弦音高（6 弦 → 1 弦） */
const OPEN_PC = [4, 9, 2, 7, 11, 4];

/** chords.json 里每条的原始结构 */
interface RawChord {
  name: string;
  group: string;
  frets: number[];
  fingers?: number[];
  barres?: number[];
}

/** 和弦性质 → 相对根音的半音数 */
const INTERVALS: Record<string, number[]> = {
  '': [0, 4, 7],
  m: [0, 3, 7],
  '7': [0, 4, 7, 10],
  maj7: [0, 4, 7, 11],
  m7: [0, 3, 7, 10],
  sus2: [0, 2, 7],
  sus4: [0, 5, 7],
  add9: [0, 2, 4, 7],
  '6': [0, 4, 7, 9],
  m6: [0, 3, 7, 9],
  '9': [0, 2, 4, 7, 10],
  dim: [0, 3, 6],
  dim7: [0, 3, 6, 9],
  m7b5: [0, 3, 6, 10],
  aug: [0, 4, 8],
  '5': [0, 7],
};

/** 只是写法不同、音完全一样的别名：命中这些不算「近似指法」 */
const EXACT_ALIASES: Record<string, string> = {
  major: '', M: '', maj: '', Maj: '',
  minor: 'm', min: 'm', mi: 'm', '-': 'm',
  min7: 'm7', mi7: 'm7', '-7': 'm7', M7: 'maj7', Maj7: 'maj7', 'Δ7': 'maj7', 'Δ': 'maj7',
  dom7: '7', sus: 'sus4', ø: 'm7b5', 'ø7': 'm7b5', '°': 'dim', '°7': 'dim7', o7: 'dim7', '+': 'aug', '6/9': '6', '69': '6',
};

/** 复杂和弦降级到能按出来的简化指法：这些属于近似指法 */
const APPROX_ALIASES: Record<string, string> = {
  '7sus4': 'sus4', '7sus': 'sus4', add2: 'add9', '2': 'sus2', '4': 'sus4', add11: 'sus4',
  madd9: 'm', maj9: 'maj7', M9: 'maj7', '9sus4': 'sus4', '6add9': '6', m6add9: 'm6',
};

function pcName(pc: number, flats: boolean) {
  return (flats ? FLAT_NAMES : SHARP_NAMES)[((pc % 12) + 12) % 12];
}

export interface ParsedChord {
  /** 根音，如 C# */
  root: string;
  /** 原样的性质后缀 */
  quality: string;
  /** 低音，无斜杠时等于根音 */
  bass: string;
  slash: boolean;
}

export function parseChordName(input: string): ParsedChord | null {
  const clean = input
    .replace(/[♯＃]/g, '#')
    .replace(/[♭ｂ]/g, 'b')
    .replace(/\s+/g, '')
    .trim();
  const match = clean.match(/^([A-G](?:#|b)?)(.*)$/);
  if (!match) return null;
  const root = match[1];
  const [quality, bassNote] = match[2].split('/');
  // 低音只认音名，/C 后面跟别的东西（比如排版残留）就当没有
  const bass = bassNote && PITCH[bassNote] !== undefined ? bassNote : root;
  return { root, quality: quality || '', bass, slash: bass !== root };
}

/** 把任意写法的性质归一化，同时说明是不是近似指法 */
function normalizeSuffix(quality: string): { suffix: string; approx: boolean } {
  if (quality in INTERVALS) return { suffix: quality, approx: false };
  if (quality in EXACT_ALIASES) return { suffix: EXACT_ALIASES[quality], approx: false };
  if (quality in APPROX_ALIASES) return { suffix: APPROX_ALIASES[quality], approx: true };
  // maj7#11、7b9 这类：截断到库里有的最长前缀
  const prefixes = Object.keys(INTERVALS)
    .filter((key) => key && quality.startsWith(key))
    .sort((a, b) => b.length - a.length);
  if (prefixes.length) return { suffix: prefixes[0], approx: true };
  if (/^m(?!aj)/.test(quality)) return { suffix: 'm', approx: true };
  if (/^maj/.test(quality)) return { suffix: 'maj7', approx: true };
  if (/^\d/.test(quality)) return { suffix: '7', approx: true };
  return { suffix: '', approx: true };
}

function buildEntry(item: RawChord): ChordEntry {
  const parsed = parseChordName(item.name)!;
  const flats = parsed.root.includes('b') || parsed.bass.includes('b');
  const frets = [...item.frets];
  const positive = frets.filter((fret) => fret > 0);
  // 有开放弦或 1 品就从琴枕开始画，否则从最低的按弦品开始，画面才不会被空白占满
  const baseFret = frets.includes(0) || frets.includes(1) ? 1 : Math.min(...positive);
  return {
    name: item.name,
    group: item.group as ChordGroup,
    frets,
    fingers: item.fingers ? [...item.fingers] : frets.map(() => 0),
    barres: item.barres ? [...item.barres] : [],
    baseFret,
    root: parsed.root,
    suffix: parsed.quality,
    bass: parsed.bass,
    flats,
    notes: frets
      .map((fret, index) => (fret < 0 ? null : pcName(OPEN_PC[index] + fret, flats)))
      .filter((note): note is string => Boolean(note)),
  };
}

export const CHORD_LIST: ChordEntry[] = (raw as RawChord[]).map(buildEntry);

/** 和弦名 → 指法，保留给只关心指法的旧调用 */
export const CHORDS: Record<string, ChordPosition> = Object.fromEntries(
  CHORD_LIST.map((entry) => [entry.name, { frets: entry.frets, fingers: entry.fingers, baseFret: entry.baseFret, barres: entry.barres }]),
);

const BY_NAME = new Map(CHORD_LIST.map((entry) => [entry.name, entry]));

export interface ChordResolution {
  /** 库里对应的指法 */
  entry: ChordEntry;
  position: ChordPosition;
  /** 谱面上写的名字（保留原拼写） */
  name: string;
  /** 库里没有这个和弦，给的是同类简化指法 */
  approx: boolean;
  /** 指法由同类和弦移调得到，不是单独收录的把位 */
  transposed: boolean;
}

/** 指法整体平移，横按和手指数一起走 */
function transpose(entry: ChordEntry, delta: number): ChordPosition {
  const frets = entry.frets.map((fret) => (fret < 0 ? -1 : fret + delta));
  const positive = frets.filter((fret) => fret > 0);
  return {
    frets,
    fingers: [...entry.fingers],
    barres: entry.barres.map((fret) => fret + delta),
    baseFret: frets.includes(0) || frets.includes(1) ? 1 : Math.min(...positive),
  };
}

/**
 * 解析任意和弦名。
 * 命中就直接用；没命中就把同性质、同低音关系的指法移调过来——
 * 这样 Bbsus4、F#dim7 这些没单独收录的和弦也有能按的指法，不会出现「暂无指法」。
 */
export function resolveChord(input: string): ChordResolution | null {
  const parsed = parseChordName(input);
  if (!parsed) return null;
  const { suffix, approx } = normalizeSuffix(parsed.quality);

  const exact = BY_NAME.get(`${parsed.root}${suffix}${parsed.slash ? `/${parsed.bass}` : ''}`);
  if (exact) return { entry: exact, position: exact, name: input, approx, transposed: false };

  const rootPc = PITCH[parsed.root];
  const bassPc = PITCH[parsed.bass];
  const bassInterval = (bassPc - rootPc + 12) % 12;
  let best: { entry: ChordEntry; delta: number; maxFret: number } | null = null;

  for (const entry of CHORD_LIST) {
    if (entry.suffix !== suffix) continue;
    // 斜杠和弦只有低音关系一致才能照搬，否则移调过去低音就错了
    const entryInterval = (PITCH[entry.bass] - PITCH[entry.root] + 12) % 12;
    if (entryInterval !== bassInterval) continue;
    const delta = (rootPc - PITCH[entry.root] + 12) % 12;
    const maxFret = Math.max(...entry.frets.filter((fret) => fret >= 0)) + delta;
    // 超过 12 品就没法用了，宁可退到别的把位
    if (maxFret > 12) continue;
    if (!best || maxFret < best.maxFret) best = { entry, delta, maxFret };
  }
  // 斜杠和弦实在没有同低音关系的样本时，退回普通和弦，至少能按
  if (!best && parsed.slash) {
    const plain = resolveChord(`${parsed.root}${parsed.quality}`);
    if (plain) return { ...plain, name: input, approx: true };
  }
  if (!best) return null;

  return { entry: best.entry, position: transpose(best.entry, best.delta), name: input, approx, transposed: true };
}

/** 兼容旧调用：只要指法 */
export const getChord = (name: string) => resolveChord(name)?.position;

/** 每根弦实际发出的音名，静音返回 null（6 弦 → 1 弦） */
export function fretNoteNames(entry: ChordEntry) {
  return entry.frets.map((fret, index) => (fret < 0 ? null : pcName(OPEN_PC[index] + fret, entry.flats)));
}

/** 某根弦按住某品时的音名，用于指法详情里逐弦说明 */
export function noteNameAt(stringIndex: number, fret: number, flats = false) {
  return pcName(OPEN_PC[stringIndex] + fret, flats);
}

/** 按弦位置描述，例如「1 品横按」「5 品把位」 */
export function positionLabel(position: { baseFret?: number; barres?: number[] }) {
  const barre = position.barres?.[0];
  if (barre) return `${barre} 品横按`;
  if ((position.baseFret ?? 1) > 1) return `${position.baseFret} 品把位`;
  return '开放把位';
}

/** 根音列表，用于和弦库左侧的调性筛选 */
export const ROOTS = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'] as const;

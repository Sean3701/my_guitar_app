export type ScoreType = 'tab' | 'chord';

export interface SourcePage {
  id: string;
  name: string;
  pageNumber: number;
  text: string;
  /** 列表与导入页使用的小图（data URL，几十 KB），原图存在 pageImages 表里 */
  thumbnail?: string;
  /** 旧版本内联的原图，读取时会迁移到 pageImages 表并从记录中移除 */
  dataUrl?: string;
}

export interface TabMeasure {
  id: string;
  chord: string;
  /** Legacy six-string data kept so existing saved scores still open. */
  strings: string[];
  /** Structured notation: fret.string, e.g. 0.1 2.2 (0.3 1.2 2.3)/4. */
  tab?: string;
  /** Space-separated numbered notation, e.g. 0 5 6 1 2 3 2 1. */
  melody?: string;
  /** Space-separated lyric syllables aligned with the melody. */
  lyric?: string;
}

export interface TabNote {
  string: number;
  fret: string;
}

export interface TabBeat {
  notes: TabNote[];
  duration: 1 | 2 | 4 | 8 | 16;
  dotted: boolean;
  technique?: 'h' | 'p' | 's';
}

export interface TabSection {
  id: string;
  name: string;
  measures: TabMeasure[];
}

export interface Score {
  id: string;
  title: string;
  artist: string;
  type: ScoreType;
  musicalKey: string;
  capo: number;
  bpm: number;
  timeSignature: string;
  sections: TabSection[];
  chordText: string;
  sourcePages: SourcePage[];
  favorite: boolean;
  sample?: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface ChordPosition {
  frets: number[];
  fingers?: number[];
  baseFret?: number;
  barres?: number[];
}

export interface ImportPage {
  id: string;
  /** 压缩后的原图，保存时写入 pageImages 表 */
  image: Blob;
  /** 缩略图 data URL，同时用作导入页预览 */
  preview: string;
  name: string;
  pageNumber: number;
  text: string;
  status: 'waiting' | 'reading' | 'done' | 'error';
  progress: number;
}

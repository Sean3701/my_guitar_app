export type ScoreType = 'tab' | 'chord';

export interface SourcePage {
  id: string;
  name: string;
  dataUrl: string;
  pageNumber: number;
  text: string;
}

export interface TabMeasure {
  id: string;
  chord: string;
  strings: string[];
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
  file: File;
  preview: string;
  name: string;
  pageNumber: number;
  text: string;
  status: 'waiting' | 'reading' | 'done' | 'error';
  progress: number;
}

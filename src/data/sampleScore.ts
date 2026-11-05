import type { Score } from '../types';

const asset = (file: string) => `${import.meta.env.BASE_URL}sample/like-a-star/${file}`;

export const sampleScoreId = 'demo-like-a-star';

export interface SamplePageAsset {
  id: string;
  /** 打包在 public 下的整页原图，首次启动时写入 IndexedDB */
  file: string;
  /** 列表/导入页用的小图 */
  thumb: string;
  name: string;
  pageNumber: number;
}

const PAGE_COUNT = 7;

export const samplePages: SamplePageAsset[] = Array.from({ length: PAGE_COUNT }, (_, index) => {
  const number = String(index + 1).padStart(2, '0');
  return {
    id: `${sampleScoreId}-p${index + 1}`,
    file: asset(`page-${number}.jpg`),
    thumb: asset(`thumb-${number}.jpg`),
    name: `Like-a-star谱例-${index + 1}.jpg`,
    pageNumber: index + 1,
  };
});

export function createSampleScore(): Score {
  const now = Date.now();
  return {
    id: sampleScoreId,
    title: 'Like A Star',
    artist: 'Youngsoo Kim',
    type: 'tab',
    // 原谱为 C G D G A D 特殊调弦 + 2 品变调夹，这里按标准调式记录便于显示
    musicalKey: 'C',
    capo: 2,
    bpm: 80,
    timeSignature: '4/4',
    sections: [],
    chordText: '',
    sourcePages: samplePages.map((page) => ({
      id: page.id, name: page.name, pageNumber: page.pageNumber, text: '', thumbnail: page.thumb,
    })),
    favorite: true,
    sample: true,
    createdAt: now,
    updatedAt: now,
  };
}

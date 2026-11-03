import type { Score } from '../types';
import { makeMeasure, uid } from '../lib/score';

const now = Date.now();
const tab = (chord: string, notes: string, melody = '', lyric = '', index = 0) => makeMeasure(chord, index, notes, melody, lyric);

export const demoScores: Score[] = [
  {
    id: 'demo-chengdu', title: '成都', artist: '赵雷 · 编配示例', type: 'tab', musicalKey: 'C', capo: 2, bpm: 90,
    timeSignature: '4/4', sections: [
      { id: uid(), name: '前奏', measures: [
        tab('C', '(x.6 3.5) 2.4 0.3 1.2 0.1 0.3 1.2 2.4', '0 5 6 1 2 3 2 1'),
        tab('Am', '0.5 2.4 2.3 1.2 0.1 1.2 2.3 2.4', '1 2 3 2 1 6 1 -'),
        tab('F', '1.6 3.5 3.4 2.3 1.2 1.1 1.2 2.3', '2 3 5 3 2 1 2 -'),
        tab('G', '3.6 2.5 0.4 0.3 0.2 3.1 0.2 0.3', '2 3 4 3 2 1 2 -'),
      ] },
      { id: uid(), name: '主歌 A', measures: [
        tab('C', '3.5 2.4 0.3 1.2 0.1 0.3 1.2 2.4', '3 3 2 1 6 1 2 -', '轻 轻 拨 响 第 一 根 弦'),
        tab('Am', '0.5 2.4 2.3 1.2 0.1 1.2 2.3 2.4', '3 3 2 1 6 1 2 -', '让 旋 律 慢 慢 向 前'),
        tab('F', '1.6 3.5 3.4 2.3 1.2 1.1 1.2 2.3', '2 2 1 6 1 2 3 -', '和 弦 落 在 指 尖'),
        tab('G', '3.6 2.5 0.4 0.3 0.2 3.1 0.2 0.3', '2 2 1 6 1 2 1 -', '节 拍 留 在 心 里 面'),
        tab('C', '3.5 2.4 0.3 1.2 0.1 0.3 1.2 2.4', '3 3 2 1 6 1 2 -', '反 复 练 习 每 一 小 节'),
        tab('Am', '0.5 2.4 2.3 1.2 0.1 1.2 2.3 2.4', '3 3 2 1 6 1 2 -', '让 音 符 自 然 衔 接'),
        tab('F', '1.6 3.5 3.4 2.3 2h4.3 2.3 1.2 1.1', '2 2 1 6 1 2 3 2', '不 必 着 急 弹 得 多 快'),
        tab('G', '3.6 2.5 0.4 0.3 0.2 3.1 0.2 0.3', '2 2 1 6 1 2 1 -', '清 晰 才 是 关 键'),
      ] },
      { id: uid(), name: '副歌 A', measures: [
        tab('F', '1.6 3.5 3.4 2.3 1.2 1.1 1.2 2.3', '4 4 3 2 1 2 3 -', '保 持 放 松 的 手 型'),
        tab('G', '3.6 2.5 0.4 0.3 0.2 3.1 0.2 0.3', '2 2 1 6 1 2 3 -', '听 清 每 一 个 音'),
        tab('Em', '0.6 2.5 2.4 0.3 0.2 0.1 0.2 0.3', '3 3 2 1 6 1 2 -', '跟 着 节 拍 慢 慢 练'),
        tab('Am', '0.5 2.4 2.3 1.2 0.1 1.2 2.3 2.4', '1 2 3 2 1 6 1 -', '一 遍 比 一 遍 好'),
      ] },
    ],
    chordText: '', sourcePages: [], favorite: true, sample: true, createdAt: now - 2000, updatedAt: now - 2000,
  },
  {
    id: 'demo-evening', title: '晚风练习曲', artist: '拾谱原创示例', type: 'chord', musicalKey: 'C', capo: 0, bpm: 72,
    timeSignature: '4/4', sections: [],
    chordText: `[前奏]\n| C     G | Am    Em | F     C | F     G |\n\n[主歌]\nC                 G\n晚风轻轻翻过 旧窗台\nAm                Em\n把没说完的话 慢慢拆开\nF                 C\n路灯拉长了影子 和期待\nF          G      C\n我抱着吉他 等天亮来\n\n[副歌]\nF           G\n唱一首简单的歌\nEm          Am\n给平凡的生活\nF           C\n每个笨拙的和弦\nF     G       C\n都值得认真弹奏`,
    sourcePages: [], favorite: false, sample: true, createdAt: now - 1000, updatedAt: now - 1000,
  },
];

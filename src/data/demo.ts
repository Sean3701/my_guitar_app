import type { Score } from '../types';

const now = Date.now();

export const demoScores: Score[] = [
  {
    id: 'demo-evening', title: '晚风练习曲', artist: '拾谱原创示例', type: 'chord', musicalKey: 'C', capo: 0, bpm: 72,
    timeSignature: '4/4', sections: [],
    chordText: `[前奏]\n| C     G | Am    Em | F     C | F     G |\n\n[主歌]\nC                 G\n晚风轻轻翻过 旧窗台\nAm                Em\n把没说完的话 慢慢拆开\nF                 C\n路灯拉长了影子 和期待\nF          G      C\n我抱着吉他 等天亮来\n\n[副歌]\nF           G\n唱一首简单的歌\nEm          Am\n给平凡的生活\nF           C\n每个笨拙的和弦\nF     G       C\n都值得认真弹奏`,
    sourcePages: [], favorite: false, sample: true, createdAt: now - 1000, updatedAt: now - 1000,
  },
];

/**
 * 校验 src/data/chords.json 里的指法是否成立。
 * 做法：按标准调弦把每个品的实际音高算出来，跟和弦名对应的组成音比对，
 * 再检查最低音是不是根音（斜杠和弦则是斜杠后的低音）。
 * 跑法：npm run check:chords
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const chords = JSON.parse(readFileSync(join(here, '../src/data/chords.json'), 'utf8'));

const PITCH = { C: 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, F: 5, 'F#': 6, Gb: 6, G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11 };
const NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
/** 空弦音（低 E → 高 E） */
const OPEN = [4, 9, 2, 7, 11, 4];

const QUALITY = {
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

function parseName(name) {
  const [tonic, bass] = name.split('/');
  const root = tonic.match(/^[A-G](?:#|b)?/)[0];
  const suffix = tonic.slice(root.length);
  if (!(suffix in QUALITY)) throw new Error(`未知和弦性质：${name} → "${suffix}"`);
  return {
    root: PITCH[root],
    bass: bass ? PITCH[bass] : PITCH[root],
    pcs: new Set(QUALITY[suffix].map((interval) => (PITCH[root] + interval) % 12)),
  };
}

const problems = [];
const seen = new Map();

for (const chord of chords) {
  const label = chord.name;
  const fail = (message) => problems.push(`${label}: ${message}`);

  if (seen.has(label)) fail(`与 ${seen.get(label)} 重复`);
  seen.set(label, label);

  if (chord.frets.length !== 6) { fail('frets 必须是 6 个'); continue; }
  if (chord.fingers && chord.fingers.length !== 6) fail('fingers 必须是 6 个');
  if (chord.frets.every((fret) => fret < 0)) { fail('六根弦全静音'); continue; }
  if (chord.frets.some((fret) => fret < -1 || fret > 15)) fail(`品位超出范围：${chord.frets.join(',')}`);

  const { root, bass, pcs } = parseName(label);
  // 斜杠和弦的低音本来就可以不是和弦音，单独放行
  const allowed = new Set([...pcs, bass]);

  // 实际按响的音
  const sounding = chord.frets
    .map((fret, string) => (fret < 0 ? null : { string, fret, pc: (OPEN[string] + fret) % 12 }))
    .filter(Boolean);

  for (const note of sounding) {
    if (!allowed.has(note.pc)) {
      fail(`${6 - note.string} 弦 ${note.fret} 品是 ${NAMES[note.pc]}，不属于 ${[...allowed].map((pc) => NAMES[pc]).join(' ')}`);
    }
  }
  if (!sounding.some((note) => note.pc === root)) fail('没有任何一根弦发出根音');

  const lowest = sounding[0];
  if (lowest.pc !== bass) fail(`最低音是 ${NAMES[lowest.pc]}，应为 ${NAMES[bass]}`);

  // 横按：同一品至少压两根弦，且区间内的弦不能被按到更低的位置（横按按不住）
  for (const fret of chord.barres || []) {
    const pressed = chord.frets.filter((value) => value === fret).length;
    if (pressed < 2) fail(`标记了 ${fret} 品横按，但只有 ${pressed} 根弦按在这里`);
  }
  for (const fret of chord.barres || []) {
    const indexes = chord.frets.map((value, index) => (value === fret ? index : -1)).filter((index) => index >= 0);
    const from = Math.min(...indexes);
    const to = Math.max(...indexes);
    for (let index = from; index <= to; index += 1) {
      const value = chord.frets[index];
      if (value !== -1 && value >= fret) continue;
      fail(`${fret} 品横按跨 ${6 - from}~${6 - to} 弦，但 ${6 - index} 弦是 ${value === -1 ? '静音' : `${value} 品`}`);
    }
  }
}

// 每个「根音 + 性质」组合是否覆盖全 12 个调
const coverage = {};
for (const chord of chords) {
  const { root } = parseName(chord.name);
  const target = parseName(chord.name);
  void target;
  const suffix = chord.name.split('/')[0].replace(/^[A-G](?:#|b)?/, '');
  coverage[suffix] ||= new Set();
  coverage[suffix].add(root);
}
console.log('\n=== 各性质覆盖的调 ===');
for (const [suffix, roots] of Object.entries(coverage)) {
  console.log(`${suffix || '大三'}: ${roots.size}/12`);
}

if (problems.length) {
  console.error(`\n发现 ${problems.length} 个问题：`);
  for (const problem of problems) console.error(' - ' + problem);
  process.exit(1);
}
console.log(`\n全部通过：${chords.length} 个和弦指法。`);

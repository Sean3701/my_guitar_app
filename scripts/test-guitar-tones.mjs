import { readFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import createModule from '../public/fasttune/fasttune.js';

const root = resolve(import.meta.dirname, '..');
const module = await createModule({ locateFile: (path) => join(root, 'public', 'fasttune', path) });
const strings = [
  ['6弦 E2', 82.41, 'e2'], ['5弦 A2', 110, 'a2'],
  ['4弦 D3', 146.83, 'd3'], ['3弦 G3', 196, 'g3'],
  ['2弦 B3', 246.94, 'b3'], ['1弦 E4', 329.63, 'e4'],
];

function readWave(name) {
  const data = readFileSync(join(root, 'public', 'audio', `guitar-${name}.wav`));
  let offset = 12, sampleRate = 32000, audio = null;
  while (offset + 8 <= data.length) {
    const id = data.toString('ascii', offset, offset + 4);
    const size = data.readUInt32LE(offset + 4);
    if (id === 'fmt ') sampleRate = data.readUInt32LE(offset + 12);
    if (id === 'data') audio = data.subarray(offset + 8, offset + 8 + size);
    offset += 8 + size + (size % 2);
  }
  if (!audio) throw new Error('Missing WAV data');
  const samples = new Float32Array(audio.length / 2);
  for (let index = 0; index < samples.length; index++) samples[index] = audio.readInt16LE(index * 2) / 32768;
  return { samples, sampleRate };
}

function resample(input, rate) {
  const output = new Float32Array(Math.floor(input.length / rate));
  for (let index = 0; index < output.length; index++) {
    const position = index * rate;
    const left = Math.floor(position);
    const fraction = position - left;
    output[index] = (input[left] || 0) * (1 - fraction) + (input[left + 1] || 0) * fraction;
  }
  return output;
}

let failed = false;
for (const [label, target, sampleName] of strings) {
  const { samples, sampleRate } = readWave(sampleName);
  const adjusted = resample(samples, 1);
  module._ft_init(sampleRate);
  const pointer = module._malloc(adjusted.length * 4);
  module.HEAPF32.set(adjusted, pointer / 4);
  const actual = module._ft_detect(pointer, adjusted.length);
  module._free(pointer);
  module._ft_destroy();
  const cents = 1200 * Math.log2(actual / target);
  const passed = Math.abs(cents) <= 30;
  console.log(`${passed ? 'PASS' : 'FAIL'} ${label}: ${actual.toFixed(2)} Hz / target ${target} Hz / ${cents >= 0 ? '+' : ''}${cents.toFixed(1)} cents`);
  if (!passed) failed = true;
}
if (failed) process.exit(1);

import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

/**
 * 校验 public/audio 里六段标准音采样的实际音高。
 * 用线上同一套 YIN 内核（src/lib/pitch.ts）测量，避免「测试引擎与被测引擎不一致」。
 */

const root = resolve(import.meta.dirname, '..');
const outDir = mkdtempSync(join(tmpdir(), 'tone-test-'));
const bundle = join(outDir, 'pitch.mjs');
execFileSync(process.execPath, [join(root, 'node_modules', 'esbuild', 'bin', 'esbuild'), join(root, 'src', 'lib', 'pitch.ts'), '--bundle', '--format=esm', '--outfile=' + bundle], { stdio: 'inherit' });
const { analyzePitch } = await import(pathToFileURL(bundle).href);

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

let failed = false;
for (const [label, target, sampleName] of strings) {
  const { samples, sampleRate } = readWave(sampleName);
  const { frequency, clarity } = analyzePitch(samples, sampleRate);
  const cents = frequency ? 1200 * Math.log2(frequency / target) : Infinity;
  const passed = Number.isFinite(cents) && Math.abs(cents) <= 10;
  console.log(`${passed ? 'PASS' : 'FAIL'} ${label}: ${frequency ? frequency.toFixed(2) : '未检出'} Hz / target ${target} Hz / ${cents >= 0 ? '+' : ''}${cents.toFixed(1)} cents / clarity ${clarity.toFixed(2)} / ${(samples.length / sampleRate).toFixed(2)}s`);
  if (!passed) failed = true;
}
rmSync(outDir, { recursive: true, force: true });
if (failed) process.exit(1);

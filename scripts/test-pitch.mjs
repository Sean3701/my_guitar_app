import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const root = resolve(import.meta.dirname, '..');
const outDir = mkdtempSync(join(tmpdir(), 'pitch-test-'));
const bundle = join(outDir, 'pitch.mjs');
execFileSync(process.execPath, [join(root, 'node_modules', 'esbuild', 'bin', 'esbuild'), join(root, 'src', 'lib', 'pitch.ts'), '--bundle', '--format=esm', '--outfile=' + bundle], { stdio: 'inherit' });
const { detectPitch } = await import(pathToFileURL(bundle).href);

const STRINGS = [['E2', 82.41], ['A2', 110], ['D3', 146.83], ['G3', 196], ['B3', 246.94], ['E4', 329.63]];
const cents = (a, b) => 1200 * Math.log2(a / b);

/** 合成带泛音、指数衰减的拨弦音 */
function pluck(sampleRate, frequency, length, gains = [1, 0.5, 0.3, 0.15, 0.08]) {
  const samples = new Float32Array(length);
  for (let index = 0; index < length; index++) {
    let value = 0;
    gains.forEach((gain, harmonic) => {
      value += gain * Math.sin(2 * Math.PI * frequency * (harmonic + 1) * index / sampleRate + harmonic * 0.7);
    });
    samples[index] = value * 0.22 * Math.exp(-1.2 * index / length);
  }
  return samples;
}

function noise(sampleRate, length, amplitude = 0.02, seed = 12345) {
  // 固定种子，避免测试结果随机波动
  let state = seed >>> 0;
  const random = () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
  const samples = new Float32Array(length);
  for (let index = 0; index < length; index++) samples[index] = (random() * 2 - 1) * amplitude;
  return samples;
}

let failed = 0;
const check = (label, ok, detail) => {
  if (!ok) failed += 1;
  console.log(`${ok ? 'PASS' : 'FAIL'} ${label} — ${detail}`);
};

for (const sampleRate of [44100, 48000]) {
  for (const [name, frequency] of STRINGS) {
    const detected = detectPitch(pluck(sampleRate, frequency, 8192), sampleRate);
    const error = detected ? cents(detected, frequency) : NaN;
    check(`${sampleRate}Hz ${name} 标准音`, detected !== null && Math.abs(error) <= 1,
      detected ? `${detected.toFixed(2)}Hz 偏差 ${error.toFixed(2)} 音分` : '未检出');
  }
}

// 失谐校验：±20 音分必须如实反映方向与幅度
for (const offset of [-40, -20, 20, 40]) {
  const target = 196 * Math.pow(2, offset / 1200);
  const detected = detectPitch(pluck(48000, target, 8192), 48000);
  const error = detected ? cents(detected, target) : NaN;
  check(`G3 失谐 ${offset >= 0 ? '+' : ''}${offset} 音分`, detected !== null && Math.abs(error - 0) <= 1.5 && Math.sign(cents(detected, 196)) === Math.sign(offset),
    detected ? `检出 ${detected.toFixed(2)}Hz，相对目标偏差 ${error.toFixed(2)} 音分` : '未检出');
}

// 八度鲁棒性：基频很弱、二次谐波很强时不能跳到高八度
{
  const signal = pluck(48000, 82.41, 8192, [0.25, 1, 0.4, 0.2]);
  const detected = detectPitch(signal, 48000);
  const error = detected ? cents(detected, 82.41) : NaN;
  check('E2 基频弱/二倍频强', detected !== null && Math.abs(error) <= 3,
    detected ? `${detected.toFixed(2)}Hz 偏差 ${error.toFixed(2)} 音分` : '未检出');
}

// 静音与白噪声必须不误报
check('静音不误报', detectPitch(new Float32Array(8192), 48000) === null, '返回 null');
check('白噪声不误报', detectPitch(noise(48000, 8192, 0.2), 48000) === null, '返回 null');

// 普通音量下的弱信号仍应检出
{
  const signal = pluck(48000, 146.83, 8192).map((value) => value * 0.12);
  const detected = detectPitch(Float32Array.from(signal), 48000);
  check('弱信号 D3', detected !== null && Math.abs(cents(detected, 146.83)) <= 1.5, detected ? `${detected.toFixed(2)}Hz` : '未检出');
}

// 桌面麦克风实测电平通常很低（关闭自动增益后），必须能在 -50 ~ -60dBFS 工作
for (const [label, gain] of [['-40dBFS', 0.02], ['-50dBFS', 0.0063], ['-58dBFS', 0.0025]]) {
  for (const [name, frequency] of [['E2', 82.41], ['G3', 196], ['E4', 329.63]]) {
    const signal = pluck(48000, frequency, 8192).map((value) => value * gain);
    const detected = detectPitch(Float32Array.from(signal), 48000);
    const error = detected ? cents(detected, frequency) : NaN;
    check(`低电平 ${label} ${name}`, detected !== null && Math.abs(error) <= 2,
      detected ? `${detected.toFixed(2)}Hz 偏差 ${error.toFixed(2)} 音分` : '未检出');
  }
}

// 房间噪声：信噪比约 12dB 时仍应稳定检出
{
  const clean = pluck(48000, 110, 8192);
  const roomNoise = noise(48000, 8192, 0.008, 20261105);
  const mixed = clean.map((value, index) => value * 0.35 + roomNoise[index]);
  const detected = detectPitch(Float32Array.from(mixed), 48000);
  check('带噪 A2（SNR≈20dB）', detected !== null && Math.abs(cents(detected, 110)) <= 2, detected ? `${detected.toFixed(2)}Hz` : '未检出');
}

// 拨弦起音在缓冲后段：分析窗应自动跳到有声音的一段
{
  const signal = new Float32Array(8192);
  signal.set(pluck(48000, 146.83, 3000, [1, 0.5, 0.3]).map((value) => value * 0.5), 5000);
  const detected = detectPitch(signal, 48000);
  check('起音偏后仍可检出', detected !== null && Math.abs(cents(detected, 146.83)) <= 2, detected ? `${detected.toFixed(2)}Hz` : '未检出');
}

rmSync(outDir, { recursive: true, force: true });
console.log(failed ? `\n${failed} 项失败` : '\n全部通过');
process.exit(failed ? 1 : 0);

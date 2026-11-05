/**
 * YIN 基频检测（de Cheveigné & Kawahara, 2002）。
 * 相比原 FastTune/PEF 引擎（实测系统性偏高 +20~25 音分），本实现可直接用合成信号
 * 精确验证，误差可控制在 1 音分内，满足吉他调音 ±5 音分的判定需求。
 *
 * 灵敏度设计：
 * - YIN 的累积均值归一化 d'(τ) 与信号幅度无关，因此不靠放大信号提升灵敏度，
 *   只把"静音门限"压到数字静音级别，安静麦克风也能进算法；
 * - 从整段录音中挑能量最强的子窗做分析，避免分析窗里混入起音前的静音或已衰减的尾部；
 * - 阈值内找不到极小值时退化为全局最小值 + 八度校验，真实现场录音不至于直接判空。
 */

/** 吉他最低音 E2 为 82.41Hz，留出降半音的余量 */
const MIN_FREQUENCY = 70;
/** 最高音 E4 为 329.63Hz，留出升高半音与泛音误判的余量 */
const MAX_FREQUENCY = 400;
/** 参与检测的分析窗长度：48kHz 下约 85ms，覆盖 E2 的 7 个周期，响应也够快 */
const ANALYSIS_SIZE = 4096;
/** 判断发声段时使用的短块长度（48kHz 下约 5ms） */
const BLOCK_SIZE = 256;
/** 数字静音门限（约 -74 dBFS）：只过滤真正的无声，灵敏度交给算法本身 */
const SILENCE_RMS = 2e-4;
/** 周期性上限：归一化差分大于此值视为噪声，不作为音高输出 */
const YIN_FALLBACK = 0.55;

export interface PitchAnalysis {
  /** 未检出时为 null */
  frequency: number | null;
  /** 归一化差分最小值，越小表示周期性越强 */
  clarity: number;
  /** 分析窗的 RMS，用于界面显示输入电平 */
  rms: number;
}

export interface PitchResult {
  frequency: number;
  clarity: number;
}

/** 检测失败（静音 / 噪声 / 超出音域）返回 null */
export function detectPitch(samples: Float32Array, sampleRate: number): number | null {
  return analyzePitch(samples, sampleRate).frequency;
}

/**
 * 从整段录音里截出"真正有声音的一段"。
 * 直接对整段做 YIN 时，起音前的静音或已衰减的尾部会稀释周期性、把频率拉偏。
 * 这里按 256 采样点的短块算 RMS 包络（不能逐样本判断，否则会被每个周期里的过零点打断），
 * 从最响的块向两侧扩张到能量明显回落处，只把发声段交给算法。
 */
function signalWindow(samples: Float32Array): Float32Array {
  const size = samples.length;
  if (size <= ANALYSIS_SIZE) return samples;

  const blockCount = Math.floor(size / BLOCK_SIZE);
  const levels = new Float32Array(blockCount);
  let maxLevel = 0;
  let maxBlock = 0;
  for (let block = 0; block < blockCount; block++) {
    let energy = 0;
    for (let index = block * BLOCK_SIZE; index < (block + 1) * BLOCK_SIZE; index++) {
      energy += samples[index] * samples[index];
    }
    const level = Math.sqrt(energy / BLOCK_SIZE);
    levels[block] = level;
    if (level > maxLevel) { maxLevel = level; maxBlock = block; }
  }
  if (maxLevel <= 0) return samples.subarray(0, ANALYSIS_SIZE);

  const threshold = Math.max(maxLevel * 0.12, SILENCE_RMS);
  let first = maxBlock;
  let last = maxBlock;
  while (first > 0 && levels[first - 1] >= threshold) first--;
  while (last + 1 < blockCount && levels[last + 1] >= threshold) last++;

  let start = first * BLOCK_SIZE;
  let end = Math.min(size, (last + 1) * BLOCK_SIZE);
  // 连续发声（或底噪把整段串起来）时，取以最响处为中心的固定窗，控制计算量
  if (end - start > ANALYSIS_SIZE) {
    start = Math.max(0, Math.min(size - ANALYSIS_SIZE, maxBlock * BLOCK_SIZE - (ANALYSIS_SIZE >> 1)));
    end = start + ANALYSIS_SIZE;
  } else {
    // 块边界是粗糙的，两端可能各混入几十个静音样本；细化到波形有效值处，避免把频率拉偏
    const edge = maxLevel * 0.15;
    const limit = start + BLOCK_SIZE;
    while (start < limit && start < end - 1 && Math.abs(samples[start]) < edge) start++;
    const tail = end - BLOCK_SIZE;
    while (end > tail && end - 1 > start && Math.abs(samples[end - 1]) < edge) end--;
  }
  return samples.subarray(start, end);
}

export function analyzePitch(samples: Float32Array, sampleRate: number): PitchAnalysis {
  const size = samples.length;
  if (size < 1024 || sampleRate <= 0) return { frequency: null, clarity: 1, rms: 0 };

  const window = signalWindow(samples);
  const length = window.length;

  // 去直流后再算能量，避免某些声卡的直流偏置把静音判成有信号
  let mean = 0;
  for (let index = 0; index < length; index++) mean += window[index];
  mean /= length;

  const centered = new Float32Array(length);
  let energy = 0;
  for (let index = 0; index < length; index++) {
    const value = window[index] - mean;
    centered[index] = value;
    energy += value * value;
  }
  const rms = Math.sqrt(energy / length);
  if (rms < SILENCE_RMS) return { frequency: null, clarity: 1, rms };

  const maxLag = Math.min(Math.floor(sampleRate / MIN_FREQUENCY), Math.floor(length / 2) - 1);
  const minLag = Math.max(2, Math.floor(sampleRate / MAX_FREQUENCY));
  const windowSize = length - maxLag;
  if (windowSize < minLag * 2) return { frequency: null, clarity: 1, rms };

  // 1) 差分函数 d(τ)
  const difference = new Float32Array(maxLag + 1);
  for (let lag = 1; lag <= maxLag; lag++) {
    let sum = 0;
    for (let index = 0; index < windowSize; index++) {
      const delta = centered[index] - centered[index + lag];
      sum += delta * delta;
    }
    difference[lag] = sum;
  }

  // 2) 累积均值归一化 d'(τ)，消除能量与包络影响（也因此与音量无关）
  const normalized = new Float32Array(maxLag + 1);
  normalized[0] = 1;
  let runningSum = 0;
  for (let lag = 1; lag <= maxLag; lag++) {
    runningSum += difference[lag];
    normalized[lag] = runningSum > 0 ? (difference[lag] * lag) / runningSum : 1;
  }

  // 3) 取全局最小值作为候选周期
  //    不用"第一个低于阈值的极小值"：现场录音有底噪时，噪声会在真实周期之前造出假极小值，
  //    导致读数偏移几十音分；全局最小 + 八度校正对噪声更稳。
  let bestLag = -1;
  let minimum = Infinity;
  for (let lag = minLag; lag < maxLag; lag++) {
    if (normalized[lag] < minimum) { minimum = normalized[lag]; bestLag = lag; }
  }
  if (bestLag < 0 || minimum > YIN_FALLBACK) return { frequency: null, clarity: minimum, rms };

  // 4) 八度校正：真实周期的 d' 应小于其倍数与约数处的值
  while (bestLag * 2 <= maxLag && normalized[bestLag * 2] < normalized[bestLag] - 0.05) bestLag *= 2;
  while (bestLag >= minLag * 2 && normalized[Math.round(bestLag / 2)] < normalized[bestLag] - 0.05) bestLag = Math.round(bestLag / 2);

  // 5) 抛物线插值，取得亚采样精度的周期
  const previous = normalized[bestLag - 1] ?? normalized[bestLag];
  const current = normalized[bestLag];
  const next = normalized[bestLag + 1] ?? normalized[bestLag];
  const denominator = previous - 2 * current + next;
  const shift = denominator === 0 ? 0 : (0.5 * (previous - next)) / denominator;
  const period = bestLag + Math.max(-0.5, Math.min(0.5, shift));
  if (!Number.isFinite(period) || period <= 0) return { frequency: null, clarity: current, rms };

  const frequency = sampleRate / period;
  if (frequency < MIN_FREQUENCY || frequency > MAX_FREQUENCY) return { frequency: null, clarity: current, rms };
  return { frequency, clarity: current, rms };
}

/** 相对目标频率的音分偏差 */
export const centsBetween = (frequency: number, target: number) => 1200 * Math.log2(frequency / target);

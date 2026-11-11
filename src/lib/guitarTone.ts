import { GUITAR_STRINGS } from '../hooks/useTuner';

/**
 * 六弦采样（public/audio/guitar-*.wav）的实测基频，单位 Hz。
 * 由 `npm run test:guitar-tones` 用调音器同一套 YIN 内核测得，实测偏离标准音 0~8 音分，
 * 播放时仍按 目标/实测 微调 playbackRate，把残余偏差抹掉。
 * 更换音频文件后需要重新测量并更新此表。
 */
const MEASURED_FREQUENCY = [82.78, 110, 146.98, 196.27, 247.07, 329.94];

const SAMPLE_URLS = ['e2', 'a2', 'd3', 'g3', 'b3', 'e4']
  .map((note) => `${import.meta.env.BASE_URL}audio/guitar-${note}.wav`);

const players = new Map<string, HTMLAudioElement>();
let currentPlayer: HTMLAudioElement | null = null;
/** 上一次播放的收尾回调：被新的点击打断时，用它让上一个 Promise 立即结束 */
let currentFinish: (() => void) | null = null;
/** 和弦试听会同时占用六根弦的采样，停声时要一起收掉 */
let chordVoices: HTMLAudioElement[] = [];
let chordTimers: number[] = [];

type PitchPreservingAudio = HTMLAudioElement & {
  mozPreservesPitch?: boolean;
  webkitPreservesPitch?: boolean;
};

function getPlayer(url: string) {
  let player = players.get(url);
  if (!player) {
    player = new Audio(url);
    player.preload = 'auto';
    players.set(url, player);
  }
  return player;
}

/**
 * 提前把六段采样塞进浏览器缓存。
 * 音频只在用户手势里才能播放，但加载/解码没有这个限制，
 * 预先 load 之后第一次点弦按钮就能立刻出声，不用等网络。
 */
export function preloadGuitarTones() {
  for (const url of SAMPLE_URLS) getPlayer(url).load();
}

/** 停掉正在播放的标准音（离开页面时也要调用，避免声音跟着跑到别的页面） */
export function stopGuitarTone() {
  const finish = currentFinish;
  currentFinish = null;
  currentPlayer?.pause();
  currentPlayer = null;
  for (const timer of chordTimers) window.clearTimeout(timer);
  chordTimers = [];
  for (const voice of chordVoices) voice.pause();
  chordVoices = [];
  finish?.();
}

/**
 * 播放某根弦的标准音。
 * 返回的 Promise 在采样播放完、播放失败或被下一次点击打断时结束，
 * 方便界面在发声期间给出反馈。
 */
export function playGuitarTone(stringIndex: number): Promise<void> {
  const url = SAMPLE_URLS[stringIndex];
  const target = GUITAR_STRINGS[stringIndex];
  const measured = MEASURED_FREQUENCY[stringIndex];
  if (!url || !target || !measured) return Promise.resolve();

  // 连续点不同的弦时，上一根弦的声音要立刻停掉，而不是两把琴一起响
  stopGuitarTone();

  const player = getPlayer(url);
  const pitched = player as PitchPreservingAudio;
  // 必须关闭「保持音高」，否则变速会被浏览器做时间伸缩，音准校正失效
  pitched.preservesPitch = false;
  pitched.mozPreservesPitch = false;
  pitched.webkitPreservesPitch = false;
  player.playbackRate = target.frequency / measured;
  player.currentTime = 0;
  player.volume = 0.88;

  return new Promise<void>((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      player.onended = null;
      player.onerror = null;
      if (currentPlayer === player) {
        currentPlayer = null;
        currentFinish = null;
      }
      resolve();
    };

    currentPlayer = player;
    currentFinish = finish;
    player.onended = finish;
    player.onerror = finish;
    // 播放被浏览器拒绝（如自动播放策略）时也要收尾，避免按钮一直停在「发声」状态
    player.play().catch(finish);
  });
}

/**
 * 扫弦试听和弦。
 * 六段采样只有空弦音，靠 playbackRate 把每根弦送到它该在的品上，
 * 再按 30~60ms 的间隔依次发声，听起来就是一次顺扫。
 * frets 顺序与琴弦一致（6 弦 → 1 弦），-1 表示不弹。
 */
export function playChord(frets: number[], options: { strum?: number } = {}): Promise<void> {
  stopGuitarTone();
  const strum = options.strum ?? 52;
  const notes = frets
    .map((fret, index) => ({ fret, index }))
    .filter((note) => note.fret >= 0 && GUITAR_STRINGS[note.index]);
  if (!notes.length) return Promise.resolve();

  const volume = Math.min(0.42, 1.5 / notes.length);
  notes.forEach((note, order) => {
    const player = getPlayer(SAMPLE_URLS[note.index]);
    const pitched = player as PitchPreservingAudio;
    // 关掉保音高，变速才会同时改变音高，这正是移调需要的行为
    pitched.preservesPitch = false;
    pitched.mozPreservesPitch = false;
    pitched.webkitPreservesPitch = false;
    const target = GUITAR_STRINGS[note.index].frequency * 2 ** (note.fret / 12);
    player.playbackRate = target / MEASURED_FREQUENCY[note.index];
    player.volume = volume;
    chordVoices.push(player);
    chordTimers.push(window.setTimeout(() => {
      player.currentTime = 0;
      player.play().catch(() => {});
    }, order * strum));
  });

  // 采样尾音大约 1 秒，按扫弦长度估算一个收尾时间，让界面能恢复按钮状态
  return new Promise((resolve) => {
    chordTimers.push(window.setTimeout(resolve, notes.length * strum + 900));
  });
}

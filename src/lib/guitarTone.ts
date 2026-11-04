import { GUITAR_STRINGS } from '../hooks/useTuner';

/**
 * 六弦采样（public/audio/guitar-*.wav）的实测基频，单位 Hz。
 * 由 `npm run test:guitar-tones` 逐弦测得；采样本身偏离标准音 16~28 音分，
 * 播放时用 playbackRate 校正，避免「标准音」听起来偏高。
 * 更换音频文件后需要重新测量并更新此表。
 */
const MEASURED_FREQUENCY = [83.66, 111.77, 148.72, 197.89, 249.53, 334.35];

const SAMPLE_URLS = ['e2', 'a2', 'd3', 'g3', 'b3', 'e4']
  .map((note) => `${import.meta.env.BASE_URL}audio/guitar-${note}.wav`);

const players = new Map<string, HTMLAudioElement>();
let currentPlayer: HTMLAudioElement | null = null;

type PitchPreservingAudio = HTMLAudioElement & {
  mozPreservesPitch?: boolean;
  webkitPreservesPitch?: boolean;
};

export async function playGuitarTone(stringIndex: number) {
  const url = SAMPLE_URLS[stringIndex];
  const target = GUITAR_STRINGS[stringIndex];
  const measured = MEASURED_FREQUENCY[stringIndex];
  if (!url || !target || !measured) return;

  currentPlayer?.pause();
  let player = players.get(url);
  if (!player) {
    player = new Audio(url);
    player.preload = 'auto';
    players.set(url, player);
  }

  const pitched = player as PitchPreservingAudio;
  // 必须关闭「保持音高」，否则变速会被浏览器做时间伸缩，音准校正失效
  pitched.preservesPitch = false;
  pitched.mozPreservesPitch = false;
  pitched.webkitPreservesPitch = false;
  player.playbackRate = target.frequency / measured;

  player.currentTime = 0;
  player.volume = 0.88;
  currentPlayer = player;
  player.onended = () => { if (currentPlayer === player) currentPlayer = null; };
  await player.play();
}

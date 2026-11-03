import { GUITAR_STRINGS } from '../hooks/useTuner';

const SAMPLE_URLS = ['e2', 'a2', 'd3', 'g3', 'b3', 'e4']
  .map((note) => `/audio/guitar-${note}.wav`);

const players = new Map<string, HTMLAudioElement>();
let currentPlayer: HTMLAudioElement | null = null;

export async function playGuitarTone(stringIndex: number) {
  const url = SAMPLE_URLS[stringIndex];
  if (!url || !GUITAR_STRINGS[stringIndex]) return;

  currentPlayer?.pause();
  let player = players.get(url);
  if (!player) {
    player = new Audio(url);
    player.preload = 'auto';
    players.set(url, player);
  }

  player.currentTime = 0;
  player.volume = 0.88;
  currentPlayer = player;
  player.onended = () => { if (currentPlayer === player) currentPlayer = null; };
  await player.play();
}

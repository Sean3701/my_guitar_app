import { useCallback, useEffect, useRef, useState } from 'react';

export const GUITAR_STRINGS = [
  { name: 'E', octave: 2, frequency: 82.41, label: '6弦' },
  { name: 'A', octave: 2, frequency: 110.0, label: '5弦' },
  { name: 'D', octave: 3, frequency: 146.83, label: '4弦' },
  { name: 'G', octave: 3, frequency: 196.0, label: '3弦' },
  { name: 'B', octave: 3, frequency: 246.94, label: '2弦' },
  { name: 'E', octave: 4, frequency: 329.63, label: '1弦' },
];

function pitchFromBuffer(buffer: Float32Array, sampleRate: number) {
  let rms = 0;
  for (let i = 0; i < buffer.length; i++) rms += buffer[i] * buffer[i];
  rms = Math.sqrt(rms / buffer.length);
  if (rms < 0.012) return null;

  const minLag = Math.floor(sampleRate / 450);
  const maxLag = Math.min(Math.floor(sampleRate / 65), Math.floor(buffer.length / 2));
  let bestLag = -1;
  let bestCorrelation = 0;
  let previousCorrelation = 1;

  for (let lag = minLag; lag <= maxLag; lag++) {
    let correlation = 0;
    let energyA = 0;
    let energyB = 0;
    for (let i = 0; i < buffer.length - lag; i++) {
      correlation += buffer[i] * buffer[i + lag];
      energyA += buffer[i] * buffer[i];
      energyB += buffer[i + lag] * buffer[i + lag];
    }
    const normalized = correlation / Math.sqrt(energyA * energyB || 1);
    if (normalized > 0.88 && normalized > previousCorrelation && normalized > bestCorrelation) {
      bestCorrelation = normalized;
      bestLag = lag;
    }
    previousCorrelation = normalized;
  }
  if (bestLag === -1) return null;

  // Parabolic interpolation makes the detected pitch steadier.
  const at = (lag: number) => {
    let value = 0;
    for (let i = 0; i < buffer.length - lag; i++) value += buffer[i] * buffer[i + lag];
    return value;
  };
  const left = at(bestLag - 1);
  const center = at(bestLag);
  const right = at(bestLag + 1);
  const denominator = 2 * (2 * center - left - right);
  const shift = denominator ? (right - left) / denominator : 0;
  return sampleRate / (bestLag + shift);
}

export function useTuner() {
  const [listening, setListening] = useState(false);
  const [frequency, setFrequency] = useState<number | null>(null);
  const [error, setError] = useState('');
  const contextRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const frameRef = useRef<number | null>(null);

  const stop = useCallback(() => {
    if (frameRef.current) cancelAnimationFrame(frameRef.current);
    streamRef.current?.getTracks().forEach((track) => track.stop());
    void contextRef.current?.close();
    frameRef.current = null;
    streamRef.current = null;
    contextRef.current = null;
    setListening(false);
    setFrequency(null);
  }, []);

  const start = useCallback(async () => {
    setError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
      const context = new AudioContext();
      const analyser = context.createAnalyser();
      analyser.fftSize = 2048;
      context.createMediaStreamSource(stream).connect(analyser);
      const buffer = new Float32Array(analyser.fftSize);
      streamRef.current = stream;
      contextRef.current = context;
      setListening(true);
      let lastUpdate = 0;
      const update = (time: number) => {
        analyser.getFloatTimeDomainData(buffer);
        if (time - lastUpdate > 90) {
          const detected = pitchFromBuffer(buffer, context.sampleRate);
          setFrequency(detected && detected >= 65 && detected <= 450 ? detected : null);
          lastUpdate = time;
        }
        frameRef.current = requestAnimationFrame(update);
      };
      frameRef.current = requestAnimationFrame(update);
    } catch {
      setError('无法使用麦克风。请在浏览器设置中允许麦克风权限后重试。');
      stop();
    }
  }, [stop]);

  useEffect(() => stop, [stop]);
  return { listening, frequency, error, start, stop };
}

export function nearestString(frequency: number) {
  return GUITAR_STRINGS.reduce((best, string, index) => {
    const distance = Math.abs(1200 * Math.log2(frequency / string.frequency));
    return distance < best.distance ? { index, distance } : best;
  }, { index: 0, distance: Infinity }).index;
}

export function pitchName(frequency: number) {
  const names = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];
  const midi = Math.round(69 + 12 * Math.log2(frequency / 440));
  return `${names[(midi + 1200) % 12]}${Math.floor(midi / 12) - 1}`;
}

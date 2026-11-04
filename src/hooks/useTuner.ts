import { useCallback, useEffect, useRef, useState } from 'react';
import { FastTuneClient } from '../lib/fasttune/FastTuneClient';

export const GUITAR_STRINGS = [
  { name: 'E', octave: 2, frequency: 82.41, label: '6弦' },
  { name: 'A', octave: 2, frequency: 110.0, label: '5弦' },
  { name: 'D', octave: 3, frequency: 146.83, label: '4弦' },
  { name: 'G', octave: 3, frequency: 196.0, label: '3弦' },
  { name: 'B', octave: 3, frequency: 246.94, label: '2弦' },
  { name: 'E', octave: 4, frequency: 329.63, label: '1弦' },
];

export type TunerEngineStatus = 'idle' | 'loading' | 'ready' | 'error';

export function useTuner() {
  const [listening, setListening] = useState(false);
  const [frequency, setFrequency] = useState<number | null>(null);
  const [engineStatus, setEngineStatus] = useState<TunerEngineStatus>('idle');
  const [error, setError] = useState('');
  const contextRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const frameRef = useRef<number | null>(null);
  const engineRef = useRef<FastTuneClient | null>(null);

  const stop = useCallback(() => {
    if (frameRef.current) cancelAnimationFrame(frameRef.current);
    streamRef.current?.getTracks().forEach((track) => track.stop());
    engineRef.current?.dispose();
    void contextRef.current?.close();
    frameRef.current = null;
    streamRef.current = null;
    engineRef.current = null;
    contextRef.current = null;
    setListening(false);
    setFrequency(null);
    setEngineStatus('idle');
  }, []);

  const start = useCallback(async () => {
    setError('');
    setEngineStatus('loading');
    const context = new AudioContext();
    const engine = new FastTuneClient();
    contextRef.current = context;
    engineRef.current = engine;
    engine.onFrequency = (detected) => setFrequency(detected && detected >= 55 && detected <= 450 ? detected : null);
    engine.onError = (message) => {
      console.error('FastTune runtime error', message);
      stop();
      setError('调音引擎运行异常，请重新开启麦克风。');
    };

    try {
      await context.resume();
      await engine.init(context.sampleRate);
      setEngineStatus('ready');
    } catch (cause) {
      console.error('FastTune initialization failed', cause);
      stop();
      setEngineStatus('error');
      setError('FastTune 调音引擎加载失败，请检查网络后重试。');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
      const analyser = context.createAnalyser();
      analyser.fftSize = 4096;
      context.createMediaStreamSource(stream).connect(analyser);
      const buffer = new Float32Array(analyser.fftSize);
      streamRef.current = stream;
      setListening(true);
      let lastUpdate = 0;
      const update = (time: number) => {
        analyser.getFloatTimeDomainData(buffer);
        if (time - lastUpdate > 100) {
          engine.detect(buffer);
          lastUpdate = time;
        }
        frameRef.current = requestAnimationFrame(update);
      };
      frameRef.current = requestAnimationFrame(update);
    } catch {
      stop();
      setError('无法使用麦克风。请在浏览器设置中允许麦克风权限后重试。');
    }
  }, [stop]);

  useEffect(() => stop, [stop]);
  return { listening, frequency, error, engineStatus, start, stop };
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

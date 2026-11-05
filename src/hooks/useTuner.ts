import { useCallback, useEffect, useRef, useState } from 'react';
import { PitchClient } from '../lib/pitch-client';

export const GUITAR_STRINGS = [
  { name: 'E', octave: 2, frequency: 82.41, label: '6弦' },
  { name: 'A', octave: 2, frequency: 110.0, label: '5弦' },
  { name: 'D', octave: 3, frequency: 146.83, label: '4弦' },
  { name: 'G', octave: 3, frequency: 196.0, label: '3弦' },
  { name: 'B', octave: 3, frequency: 246.94, label: '2弦' },
  { name: 'E', octave: 4, frequency: 329.63, label: '1弦' },
];

export type TunerEngineStatus = 'idle' | 'loading' | 'ready' | 'error';

export type AudioInput = { deviceId: string; label: string };

/** 上一次检出后保持显示的时长：拨弦是间断的，短暂丢失不应让界面来回闪烁 */
const HOLD_MS = 600;

/**
 * 打开麦克风。关掉会改变音色/电平的处理链，保留最原始的琴声；
 * deviceId 为空时用系统默认输入。
 */
function openMicStream(deviceId: string) {
  return navigator.mediaDevices.getUserMedia({
    audio: {
      ...(deviceId ? { deviceId: { exact: deviceId } } : {}),
      echoCancellation: false,
      noiseSuppression: false,
      autoGainControl: false,
      channelCount: 1,
    },
  });
}

/** 之前选中的设备被拔掉或被占用时，浏览器会抛这两类错误 */
function isDeviceMissing(cause: unknown) {
  const name = (cause as DOMException | null)?.name;
  return name === 'OverconstrainedError' || name === 'NotFoundError' || name === 'NotReadableError';
}

export function useTuner() {
  const [listening, setListening] = useState(false);
  const [frequency, setFrequency] = useState<number | null>(null);
  const [level, setLevel] = useState(0);
  const [engineStatus, setEngineStatus] = useState<TunerEngineStatus>('idle');
  const [error, setError] = useState('');
  const [devices, setDevices] = useState<AudioInput[]>([]);
  const [deviceId, setDeviceId] = useState('');
  const contextRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const frameRef = useRef<number | null>(null);
  const engineRef = useRef<PitchClient | null>(null);
  const historyRef = useRef<number[]>([]);
  const lastHitRef = useRef(0);
  /** start() 里要读最新的设备选择，但不想把它变成依赖，所以再存一份 ref */
  const deviceIdRef = useRef('');
  const listeningRef = useRef(false);

  /** 列出输入设备。没授权前浏览器只给空 label，此时退回「麦克风 N」占位 */
  const refreshDevices = useCallback(async () => {
    if (!navigator.mediaDevices?.enumerateDevices) return;
    try {
      const all = await navigator.mediaDevices.enumerateDevices();
      const inputs = all
        .filter((device) => device.kind === 'audioinput')
        .map((device, index) => ({ deviceId: device.deviceId, label: device.label || `麦克风 ${index + 1}` }));
      setDevices(inputs);
    } catch (cause) {
      console.error('Enumerate audio inputs failed', cause);
    }
  }, []);

  const stop = useCallback(() => {
    if (frameRef.current) cancelAnimationFrame(frameRef.current);
    streamRef.current?.getTracks().forEach((track) => track.stop());
    engineRef.current?.dispose();
    void contextRef.current?.close();
    frameRef.current = null;
    streamRef.current = null;
    engineRef.current = null;
    contextRef.current = null;
    historyRef.current = [];
    lastHitRef.current = 0;
    listeningRef.current = false;
    setListening(false);
    setFrequency(null);
    setLevel(0);
    setEngineStatus('idle');
  }, []);

  const start = useCallback(async () => {
    setError('');
    setEngineStatus('loading');
    const context = new AudioContext();
    const engine = new PitchClient();
    contextRef.current = context;
    engineRef.current = engine;
    // 取近 5 次检测的中位数，抑制拨弦瞬间的抖动与偶发误检；短暂丢帧时保持上一次读数
    engine.onSample = ({ frequency: detected, rms }) => {
      setLevel(rms);
      if (detected) {
        lastHitRef.current = performance.now();
        const history = [...historyRef.current, detected].slice(-5);
        historyRef.current = history;
        const sorted = [...history].sort((a, b) => a - b);
        setFrequency(sorted[Math.floor(sorted.length / 2)]);
        return;
      }
      if (performance.now() - lastHitRef.current > HOLD_MS) {
        historyRef.current = [];
        setFrequency(null);
      }
    };
    engine.onError = (message) => {
      console.error('Pitch engine runtime error', message);
      stop();
      setError('调音引擎运行异常，请重新开启麦克风。');
    };

    try {
      await context.resume();
      await engine.init(context.sampleRate);
      setEngineStatus('ready');
    } catch (cause) {
      console.error('Pitch engine initialization failed', cause);
      stop();
      setEngineStatus('error');
      setError('调音引擎初始化失败，请刷新页面后重试。');
      return;
    }

    const acquireStream = async (): Promise<MediaStream | null> => {
      try {
        return await openMicStream(deviceIdRef.current);
      } catch (cause) {
        // 之前挑的设备被拔掉或被别的程序占用了：退回系统默认设备再试一次
        if (!deviceIdRef.current || !isDeviceMissing(cause)) {
          console.error('Failed to open microphone', cause);
          return null;
        }
        deviceIdRef.current = '';
        setDeviceId('');
        try {
          return await openMicStream('');
        } catch (again) {
          console.error('Failed to open default microphone', again);
          return null;
        }
      }
    };

    const stream = await acquireStream();
    if (!stream) {
      stop();
      setError('无法使用麦克风。请在浏览器设置中允许麦克风权限后重试。');
      return;
    }

    try {
      const analyser = context.createAnalyser();
      // 8192 采样点（48kHz 下约 170ms）可覆盖低音 E2 的十余个周期，检测时再从中挑最强子窗
      analyser.fftSize = 8192;
      context.createMediaStreamSource(stream).connect(analyser);
      const buffer = new Float32Array(analyser.fftSize);
      streamRef.current = stream;
      listeningRef.current = true;
      setListening(true);
      // 授权之后 label 才可读，此时刷新设备列表下拉里才有真名字
      void refreshDevices();
      let lastUpdate = 0;
      const update = (time: number) => {
        analyser.getFloatTimeDomainData(buffer);
        // 70ms 一次：比一帧一检更跟手，同时保证低音弦有足够能量累积
        if (time - lastUpdate > 70) {
          engine.detect(buffer);
          lastUpdate = time;
        }
        frameRef.current = requestAnimationFrame(update);
      };
      frameRef.current = requestAnimationFrame(update);
    } catch (cause) {
      console.error('Failed to attach microphone stream', cause);
      stop();
      setError('无法使用麦克风。请在浏览器设置中允许麦克风权限后重试。');
    }
  }, [refreshDevices, stop]);

  /** 换麦克风：记住选择，正在调音的话用新设备重开一次音频链路 */
  const selectDevice = useCallback((nextId: string) => {
    deviceIdRef.current = nextId;
    setDeviceId(nextId);
    if (listeningRef.current) {
      stop();
      void start();
    }
  }, [start, stop]);

  useEffect(() => {
    void refreshDevices();
    const media = navigator.mediaDevices;
    if (!media?.addEventListener) return;
    // 插拔耳机/麦克风时刷新列表，免得下拉停在已经消失的设备上
    const onChange = () => { void refreshDevices(); };
    media.addEventListener('devicechange', onChange);
    return () => media.removeEventListener('devicechange', onChange);
  }, [refreshDevices]);

  useEffect(() => stop, [stop]);
  return { listening, frequency, level, error, engineStatus, devices, deviceId, selectDevice, start, stop };
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

/// <reference lib="webworker" />
import { analyzePitch } from './pitch';

let sampleRate = 48000;

self.onmessage = (event: MessageEvent) => {
  try {
    if (event.data.type === 'init') {
      sampleRate = Number(event.data.sampleRate) || 48000;
      self.postMessage({ type: 'ready' });
      return;
    }
    if (event.data.type === 'detect') {
      const samples = new Float32Array(event.data.buffer as ArrayBuffer);
      const result = analyzePitch(samples, sampleRate);
      self.postMessage({
        type: 'frequency',
        frequency: result.frequency ?? 0,
        clarity: result.clarity,
        rms: result.rms,
      });
    }
  } catch (error) {
    self.postMessage({ type: 'error', message: error instanceof Error ? error.message : 'Pitch detection error' });
  }
};

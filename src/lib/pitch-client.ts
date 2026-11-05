export interface PitchSample {
  frequency: number | null;
  /** 归一化差分，越小越可靠 */
  clarity: number;
  /** 输入信号 RMS，用于界面显示麦克风电平 */
  rms: number;
}

/** Worker 封装：把基频检测放到独立线程，主线程只负责采样与渲染 */
export class PitchClient {
  private worker: Worker;
  private busy = false;
  onSample: ((sample: PitchSample) => void) | null = null;
  onError: ((message: string) => void) | null = null;

  constructor() {
    this.worker = new Worker(new URL('./pitch-worker.ts', import.meta.url), { type: 'module' });
  }

  init(sampleRate: number) {
    return new Promise<void>((resolve, reject) => {
      this.worker.onmessage = (event) => {
        if (event.data.type === 'ready') resolve();
        if (event.data.type === 'frequency') {
          this.busy = false;
          this.onSample?.({
            frequency: event.data.frequency > 0 ? event.data.frequency : null,
            clarity: Number(event.data.clarity) || 1,
            rms: Number(event.data.rms) || 0,
          });
        }
        if (event.data.type === 'error') {
          // 任何阶段出错都必须解锁，否则后续检测会被永久丢弃
          this.busy = false;
          const error = new Error(event.data.message);
          reject(error);
          this.onError?.(event.data.message);
        }
      };
      this.worker.onerror = (event) => {
        this.busy = false;
        reject(new Error(event.message || 'Pitch worker failed'));
        this.onError?.(event.message || 'Pitch worker failed');
      };
      this.worker.postMessage({ type: 'init', sampleRate });
    });
  }

  detect(samples: Float32Array) {
    if (this.busy) return;
    this.busy = true;
    const copy = samples.slice();
    this.worker.postMessage({ type: 'detect', buffer: copy.buffer }, [copy.buffer]);
  }

  dispose() {
    this.worker.terminate();
    this.onSample = null;
    this.onError = null;
  }
}

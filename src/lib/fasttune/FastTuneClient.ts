export class FastTuneClient {
  private worker: Worker;
  private busy = false;
  onFrequency: ((frequency: number | null) => void) | null = null;
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
          this.onFrequency?.(event.data.frequency > 0 ? event.data.frequency : null);
        }
        if (event.data.type === 'error') {
          // 无论初始化还是检测阶段出错都要解锁，否则后续检测会被永久丢弃
          this.busy = false;
          const error = new Error(event.data.message);
          reject(error);
          this.onError?.(event.data.message);
        }
      };
      this.worker.onerror = (event) => {
        this.busy = false;
        reject(new Error(event.message || 'FastTune Worker failed'));
        this.onError?.(event.message || 'FastTune Worker failed');
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
    this.onFrequency = null;
    this.onError = null;
  }
}

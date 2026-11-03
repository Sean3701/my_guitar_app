export class FastTuneClient {
  private worker: Worker;
  private busy = false;
  onFrequency: ((frequency: number | null) => void) | null = null;

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
        if (event.data.type === 'error') reject(new Error(event.data.message));
      };
      this.worker.onerror = (event) => reject(new Error(event.message || 'FastTune Worker failed'));
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
  }
}

/// <reference lib="webworker" />

interface FastTuneModule {
  HEAPF32: Float32Array;
  _ft_init(sampleRate: number): number;
  _ft_detect(pointer: number, length: number): number;
  _ft_destroy(): void;
  _malloc(size: number): number;
  _free(pointer: number): void;
}

let engine: FastTuneModule | null = null;
let pointer = 0;
let capacity = 0;
// 子路径部署时 wasm/glue 位于 <base>fasttune/ 下
const engineBase = `${import.meta.env.BASE_URL}fasttune/`;

self.onmessage = async (event: MessageEvent) => {
  try {
    if (event.data.type === 'init') {
      const factoryPath = `${engineBase}fasttune.js`;
      // Load the prebuilt public glue untouched; bundlers must not rewrite this import.
      const loadPublicModule = new Function('path', 'return import(path)') as (path: string) => Promise<{ default: (options: object) => Promise<FastTuneModule> }>;
      const { default: createModule } = await loadPublicModule(factoryPath);
      engine = await createModule({ locateFile: (path: string) => `${engineBase}${path}` });
      if (engine._ft_init(event.data.sampleRate) !== 0) throw new Error('FastTune initialization failed');
      self.postMessage({ type: 'ready' });
      return;
    }
    if (event.data.type === 'detect' && engine) {
      const samples = new Float32Array(event.data.buffer as ArrayBuffer);
      let rms = 0;
      for (let index = 0; index < samples.length; index++) rms += samples[index] * samples[index];
      rms = Math.sqrt(rms / samples.length);
      if (rms < 0.008) {
        self.postMessage({ type: 'frequency', frequency: 0 });
        return;
      }
      if (capacity < samples.length) {
        if (pointer) engine._free(pointer);
        capacity = samples.length;
        pointer = engine._malloc(capacity * 4);
      }
      engine.HEAPF32.set(samples, pointer / 4);
      const frequency = engine._ft_detect(pointer, samples.length);
      self.postMessage({ type: 'frequency', frequency });
    }
  } catch (error) {
    self.postMessage({ type: 'error', message: error instanceof Error ? error.message : 'FastTune engine error' });
  }
};

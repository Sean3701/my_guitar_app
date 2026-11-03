import { readFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import createModule from '../public/fasttune/fasttune.js';

const root = resolve(import.meta.dirname, '..');
const module = await createModule({ locateFile: (path) => join(root, 'public', 'fasttune', path) });

function readWave(path) {
  const data = readFileSync(path);
  if (data.toString('ascii', 0, 4) !== 'RIFF' || data.toString('ascii', 8, 12) !== 'WAVE') throw new Error('Not a RIFF/WAVE file');
  let offset = 12;
  let format = 1, channels = 1, sampleRate = 32000, bits = 16, audio = null;
  while (offset + 8 <= data.length) {
    const id = data.toString('ascii', offset, offset + 4);
    const size = data.readUInt32LE(offset + 4);
    const start = offset + 8;
    if (id === 'fmt ') {
      format = data.readUInt16LE(start);
      channels = data.readUInt16LE(start + 2);
      sampleRate = data.readUInt32LE(start + 4);
      bits = data.readUInt16LE(start + 14);
    } else if (id === 'data') audio = data.subarray(start, start + size);
    offset = start + size + (size % 2);
  }
  if (!audio) throw new Error('Missing audio data');
  const bytesPerSample = bits / 8;
  const frameCount = Math.floor(audio.length / (bytesPerSample * channels));
  const samples = new Float32Array(frameCount);
  for (let frame = 0; frame < frameCount; frame++) {
    let value = 0;
    for (let channel = 0; channel < channels; channel++) {
      const index = (frame * channels + channel) * bytesPerSample;
      if (format === 3 && bits === 32) value += audio.readFloatLE(index);
      else if (format === 1 && bits === 16) value += audio.readInt16LE(index) / 32768;
      else if (format === 1 && bits === 8) value += (audio.readUInt8(index) - 128) / 128;
      else throw new Error(`Unsupported WAV format ${format}/${bits}`);
    }
    samples[frame] = value / channels;
  }
  return { samples, sampleRate };
}

let failed = false;
for (const expected of [82, 146, 329]) {
  const { samples, sampleRate } = readWave(join(root, 'native', 'fasttune', 'test', 'audio', `${expected}.wav`));
  if (module._ft_init(sampleRate) !== 0) throw new Error('FastTune initialization failed');
  const pointer = module._malloc(samples.length * 4);
  module.HEAPF32.set(samples, pointer / 4);
  const actual = module._ft_detect(pointer, samples.length);
  module._free(pointer);
  module._ft_destroy();
  const error = Math.abs(actual - expected);
  const passed = error <= Math.max(2, expected * 0.015);
  console.log(`${passed ? 'PASS' : 'FAIL'} ${expected}.wav: ${actual.toFixed(2)} Hz (expected about ${expected} Hz)`);
  if (!passed) failed = true;
}
if (failed) process.exit(1);

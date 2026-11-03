import { createWorker, type Worker } from 'tesseract.js';

let workerPromise: Promise<Worker> | null = null;
let progressHandler: ((progress: number) => void) | undefined;

function getWorker() {
  if (!workerPromise) {
    workerPromise = createWorker(['chi_sim', 'eng'], 1, {
      logger: (message) => {
        if (message.status === 'recognizing text') progressHandler?.(message.progress);
      },
    });
  }
  return workerPromise;
}

export async function recognizeImage(image: string, onProgress?: (progress: number) => void) {
  progressHandler = onProgress;
  const worker = await getWorker();
  const result = await worker.recognize(image);
  progressHandler = undefined;
  return result.data.text;
}

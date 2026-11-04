/** 导入图片的压缩与缩略图生成。原图控制在 2000px 长边，缩略图 520px。 */
const MAX_EDGE = 2000;
const THUMB_EDGE = 520;

interface Decoded {
  image: CanvasImageSource;
  width: number;
  height: number;
  release: () => void;
}

function loadHtmlImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.decoding = 'async';
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('图片解码失败'));
    image.src = src;
  });
}

async function decode(source: Blob | string): Promise<Decoded> {
  if (typeof source !== 'string' && typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(source);
      return { image: bitmap, width: bitmap.width, height: bitmap.height, release: () => bitmap.close() };
    } catch {
      // 部分浏览器对 HEIC 等格式不支持 createImageBitmap，回退到 <img>
    }
  }
  const url = typeof source === 'string' ? source : URL.createObjectURL(source);
  const image = await loadHtmlImage(url);
  return {
    image,
    width: image.naturalWidth,
    height: image.naturalHeight,
    release: () => { if (typeof source !== 'string') URL.revokeObjectURL(url); },
  };
}

function drawToCanvas(image: CanvasImageSource, width: number, height: number, maxEdge: number) {
  const scale = Math.min(1, maxEdge / Math.max(width, height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));
  const context = canvas.getContext('2d');
  if (!context) throw new Error('当前浏览器不支持 canvas 压缩');
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.imageSmoothingQuality = 'high';
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas;
}

function toBlob(canvas: HTMLCanvasElement, quality: number) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('图片压缩失败'))), 'image/jpeg', quality);
  });
}

export interface PreparedImage {
  /** 压缩后的原图，写入 pageImages 表 */
  image: Blob;
  /** 缩略图 data URL，用于列表与导入预览 */
  preview: string;
}

export async function prepareImage(source: Blob | string, maxEdge = MAX_EDGE, thumbEdge = THUMB_EDGE): Promise<PreparedImage> {
  const decoded = await decode(source);
  try {
    const full = drawToCanvas(decoded.image, decoded.width, decoded.height, maxEdge);
    const thumb = drawToCanvas(decoded.image, decoded.width, decoded.height, thumbEdge);
    const image = await toBlob(full, 0.85);
    const preview = thumb.toDataURL('image/jpeg', 0.7);
    return { image, preview };
  } finally {
    decoded.release();
  }
}

import { openDB } from 'idb';
import type { Score, SourcePage } from '../types';
import { demoScores } from '../data/demo';
import { createSampleScore, samplePages, sampleScoreId } from '../data/sampleScore';
import { prepareImage } from './image';

const DB_NAME = 'shipu-guitar';
const DB_VERSION = 2;
const SAMPLE_SCORE_KEY = 'shipu-sample-like-a-star-v1';
const SAMPLE_IMAGE_KEY = 'shipu-sample-like-a-star-images-v1';

const dbPromise = openDB(DB_NAME, DB_VERSION, {
  upgrade(db) {
    if (!db.objectStoreNames.contains('scores')) db.createObjectStore('scores', { keyPath: 'id' });
    // 原图与谱面元数据分开存放，列表页不再反序列化大图
    if (!db.objectStoreNames.contains('pageImages')) db.createObjectStore('pageImages');
  },
});

/** 把旧版本内联在 SourcePage.dataUrl 里的原图搬到 pageImages，并补上缩略图 */
async function migrateInlineImages(scores: Score[]): Promise<Score[]> {
  const inline = scores.flatMap((score) => score.sourcePages.filter((page) => page.dataUrl));
  if (!inline.length) return scores;

  const db = await dbPromise;
  const thumbnails = new Map<string, string>();
  for (const page of inline) {
    try {
      const prepared = await prepareImage(page.dataUrl!);
      await db.put('pageImages', prepared.image, page.id);
      thumbnails.set(page.id, prepared.preview);
    } catch (error) {
      console.error('迁移琴谱图片失败', page.name, error);
    }
  }

  const migrated = scores.map((score) => ({
    ...score,
    sourcePages: score.sourcePages.map((page): SourcePage => {
      if (!page.dataUrl) return page;
      const { dataUrl: _legacy, ...rest } = page;
      return { ...rest, thumbnail: rest.thumbnail || thumbnails.get(page.id) };
    }),
  }));
  for (const score of migrated) await db.put('scores', score);
  return migrated;
}

/** 示例琴谱的原图打包在 public 里，首次启动写入 IndexedDB，之后离线也能翻看 */
async function cacheSamplePages(): Promise<void> {
  const db = await dbPromise;
  for (const page of samplePages) {
    if (await db.get('pageImages', page.id)) continue;
    const response = await fetch(page.file);
    if (!response.ok) throw new Error(`示例图片加载失败：${page.file} (${response.status})`);
    await db.put('pageImages', await response.blob(), page.id);
  }
}

export async function getScores(): Promise<Score[]> {
  const db = await dbPromise;
  if (!localStorage.getItem('shipu-initialized')) {
    for (const score of demoScores) await db.put('scores', score);
    localStorage.setItem('shipu-initialized', 'true');
  }
  let scores = await db.getAll('scores') as Score[];
  if (!localStorage.getItem('shipu-image-only-v1')) {
    for (const demo of demoScores) {
      const existing = scores.find((score) => score.id === demo.id);
      if (!existing || existing.sample) await db.put('scores', { ...demo, favorite: existing?.favorite ?? demo.favorite });
    }
    // 六线谱只保留原图查看：清掉没有原图的旧示例，避免打开空白谱
    const demoIds = new Set([...demoScores.map((demo) => demo.id), sampleScoreId]);
    for (const score of scores) {
      if (score.sample && !demoIds.has(score.id)) await db.delete('scores', score.id);
    }
    localStorage.setItem('shipu-image-only-v1', 'true');
    scores = await db.getAll('scores') as Score[];
  }

  // 内置示例《Like A Star》：只注入一次，用户自己删掉后不再自动回来
  if (!localStorage.getItem(SAMPLE_SCORE_KEY)) {
    const imagesReady = await cacheSamplePages().then(() => true).catch((error) => {
      console.warn('示例琴谱图片缓存失败，下次启动会重试', error);
      return false;
    });
    if (imagesReady) localStorage.setItem(SAMPLE_IMAGE_KEY, 'true');
    if (!scores.some((score) => score.id === sampleScoreId)) await db.put('scores', createSampleScore());
    localStorage.setItem(SAMPLE_SCORE_KEY, 'true');
    scores = await db.getAll('scores') as Score[];
  } else if (!localStorage.getItem(SAMPLE_IMAGE_KEY)) {
    // 上次图片没缓存成功（例如首次启动时离线），这里补一次
    cacheSamplePages().then(() => localStorage.setItem(SAMPLE_IMAGE_KEY, 'true')).catch(() => {});
  }

  scores = await migrateInlineImages(scores);
  return scores.sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function saveScore(score: Score) {
  const db = await dbPromise;
  await db.put('scores', { ...score, updatedAt: Date.now() });
}

export async function getPageImage(id: string): Promise<Blob | undefined> {
  const db = await dbPromise;
  return await db.get('pageImages', id) as Blob | undefined;
}

export async function getPageImages(ids: string[]): Promise<Record<string, Blob>> {
  const db = await dbPromise;
  const found: Record<string, Blob> = {};
  await Promise.all(ids.map(async (id) => {
    const blob = await db.get('pageImages', id) as Blob | undefined;
    if (blob) found[id] = blob;
  }));
  return found;
}

export async function savePageImages(entries: Array<[string, Blob]>) {
  if (!entries.length) return;
  const db = await dbPromise;
  const tx = db.transaction('pageImages', 'readwrite');
  await Promise.all(entries.map(([id, image]) => tx.store.put(image, id)));
  await tx.done;
}

export async function deletePageImages(ids: string[]) {
  if (!ids.length) return;
  const db = await dbPromise;
  const tx = db.transaction('pageImages', 'readwrite');
  await Promise.all(ids.map((id) => tx.store.delete(id)));
  await tx.done;
}

export async function deleteScore(id: string) {
  const db = await dbPromise;
  const score = await db.get('scores', id) as Score | undefined;
  await deletePageImages(score?.sourcePages.map((page) => page.id) ?? []);
  await db.delete('scores', id);
}

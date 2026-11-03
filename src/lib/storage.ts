import { openDB } from 'idb';
import type { Score } from '../types';
import { demoScores } from '../data/demo';

const dbPromise = openDB('shipu-guitar', 1, {
  upgrade(db) {
    db.createObjectStore('scores', { keyPath: 'id' });
  },
});

export async function getScores(): Promise<Score[]> {
  const db = await dbPromise;
  if (!localStorage.getItem('shipu-initialized')) {
    for (const score of demoScores) await db.put('scores', score);
    localStorage.setItem('shipu-initialized', 'true');
  }
  let scores = await db.getAll('scores') as Score[];
  if (!localStorage.getItem('shipu-readable-tab-v1')) {
    for (const demo of demoScores) {
      const existing = scores.find((score) => score.id === demo.id);
      if (!existing || existing.sample) await db.put('scores', { ...demo, favorite: existing?.favorite ?? demo.favorite });
    }
    localStorage.setItem('shipu-readable-tab-v1', 'true');
    scores = await db.getAll('scores') as Score[];
  }
  return scores.sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function saveScore(score: Score) {
  const db = await dbPromise;
  await db.put('scores', { ...score, updatedAt: Date.now() });
}

export async function deleteScore(id: string) {
  const db = await dbPromise;
  await db.delete('scores', id);
}

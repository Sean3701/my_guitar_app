import type { TabBeat, TabMeasure, TabNote } from '../types';

const durations = new Set([1, 2, 4, 8, 16]);

function parseNote(token: string): { notes: TabNote[]; technique?: TabBeat['technique'] } | null {
  const match = token.match(/^(?:(\d+)([hps]))?(x|\d+)\.([1-6])$/i);
  if (!match) return null;
  const [, firstFret, technique, fret, stringValue] = match;
  const string = Number(stringValue);
  const notes = firstFret
    ? [{ string, fret: firstFret }, { string, fret }]
    : [{ string, fret: fret.toLowerCase() }];
  return { notes, technique: technique as TabBeat['technique'] | undefined };
}

/** Parse a compact, human-readable subset inspired by alphaTex. */
export function parseTabNotation(source = ''): TabBeat[] {
  const tokens = source.match(/\([^)]*\)(?:\/(?:1|2|4|8|16)(?:\.)?)?|\S+/g) || [];
  const beats: TabBeat[] = [];

  for (const rawToken of tokens) {
    if (rawToken === '|') continue;
    if (/^[-~]$/.test(rawToken)) {
      beats.push({ notes: [], duration: 8, dotted: false });
      continue;
    }
    const durationMatch = rawToken.match(/\/(1|2|4|8|16)(\.?)$/);
    const durationValue = Number(durationMatch?.[1] || 8);
    const duration = (durations.has(durationValue) ? durationValue : 8) as TabBeat['duration'];
    const dotted = Boolean(durationMatch?.[2]);
    const body = rawToken.replace(/\/(1|2|4|8|16)(\.?)$/, '').replace(/^\(/, '').replace(/\)$/, '');
    const noteTokens = body.trim().split(/\s+/).filter(Boolean);
    const notes: TabNote[] = [];
    let technique: TabBeat['technique'];

    for (const noteToken of noteTokens) {
      const parsed = parseNote(noteToken);
      if (!parsed) continue;
      notes.push(...parsed.notes);
      technique = parsed.technique || technique;
    }
    if (notes.length) beats.push({ notes, duration, dotted, technique });
  }
  return beats;
}

function legacyBeats(measure: TabMeasure): TabBeat[] {
  const columns = Math.max(8, ...measure.strings.map((line) => line.length));
  return Array.from({ length: columns }, (_, column) => {
    const notes = measure.strings.flatMap((line, stringIndex) => {
      const fret = line[column];
      if (!fret || fret === '-' || fret === '—') return [];
      return [{ string: stringIndex + 1, fret: fret.toLowerCase() }];
    });
    return { notes, duration: 8 as const, dotted: false };
  });
}

export function getMeasureBeats(measure: TabMeasure): TabBeat[] {
  return measure.tab?.trim() ? parseTabNotation(measure.tab) : legacyBeats(measure);
}

export function getMeasureTabText(measure: TabMeasure) {
  if (measure.tab !== undefined) return measure.tab;
  return legacyBeats(measure).map((beat) => {
    if (!beat.notes.length) return '-';
    const notes = beat.notes.map((note) => `${note.fret}.${note.string}`).join(' ');
    return beat.notes.length > 1 ? `(${notes})` : notes;
  }).join(' ');
}

export function beatWeight(beat: TabBeat) {
  return (4 / beat.duration) * (beat.dotted ? 1.5 : 1);
}

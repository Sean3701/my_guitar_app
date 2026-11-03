import test from 'node:test';
import assert from 'node:assert/strict';
import { getMeasureBeats, getMeasureTabText, parseTabNotation } from '../src/lib/tab.ts';
import { createTabDraft } from '../src/lib/score.ts';

test('parses fret.string notes, chords, durations and muted strings', () => {
  const beats = parseTabNotation('0.1 2.2 (0.3 1.2 2.3)/4 x.6/8 10.1/2.');
  assert.equal(beats.length, 5);
  assert.deepEqual(beats.map((beat) => beat.duration), [8, 8, 4, 8, 2]);
  assert.equal(beats[4].dotted, true);
  assert.deepEqual(beats[2].notes.map((note) => note.fret), ['0', '1', '2']);
  assert.deepEqual(beats[3].notes[0], { string: 6, fret: 'x' });
  assert.equal(beats[4].notes[0].fret, '10');
});

test('parses hammer-on, pull-off and slide as two connected notes', () => {
  for (const [token, technique] of [['2h4.3', 'h'], ['4p2.3', 'p'], ['2s4.3', 's']]) {
    const [beat] = parseTabNotation(token);
    assert.equal(beat.technique, technique);
    assert.deepEqual(beat.notes.map((note) => note.fret), technique === 'p' ? ['4', '2'] : ['2', '4']);
    assert.ok(beat.notes.every((note) => note.string === 3));
  }
});

test('preserves rests and ignores malformed tokens without losing valid notes', () => {
  const beats = parseTabNotation('- 0.1 nope 3.9 ~ 1.2');
  assert.equal(beats.length, 4);
  assert.deepEqual(beats.map((beat) => beat.notes.length), [0, 1, 0, 1]);
  assert.deepEqual(beats.filter((beat) => beat.notes.length).map((beat) => beat.notes[0].string), [1, 2]);
});

test('converts legacy six-string measures into eight rhythmic positions', () => {
  const beats = getMeasureBeats({
    id: 'legacy', chord: 'C',
    strings: ['0---3---', '1---1---', '0-------', '2-------', '3---3---', 'x-------'],
  });
  assert.equal(beats.length, 8);
  assert.equal(beats[0].notes.length, 6);
  assert.deepEqual(beats[4].notes.map((note) => note.fret), ['3', '1', '3']);
  assert.ok(beats.every((beat) => beat.duration === 8));
});

test('serializes legacy measures into the new editable format', () => {
  const text = getMeasureTabText({ id: 'legacy', chord: 'Am', strings: ['0-------', '1-------', '2-------', '2-------', '0-------', 'x-------'] });
  assert.equal(text, '(0.1 1.2 2.3 2.4 0.5 x.6) - - - - - - -');
});

test('text drafts preserve sections and chords without inventing finger patterns', () => {
  const sections = createTabDraft('[前奏]\nC G Am\n[主歌]\nF C');
  assert.deepEqual(sections.map((section) => section.name), ['前奏', '主歌']);
  assert.deepEqual(sections.map((section) => section.measures.length), [3, 2]);
  assert.ok(sections.flatMap((section) => section.measures).every((measure) => measure.tab === '- - - - - - - -'));
});

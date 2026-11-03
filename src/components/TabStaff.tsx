import type { CSSProperties } from 'react';
import type { TabBeat, TabMeasure, TabSection } from '../types';
import { beatWeight, getMeasureBeats } from '../lib/tab';
import ChordDiagram from './ChordDiagram';

interface Props {
  sections: TabSection[];
  showDiagrams?: boolean;
  showMelody?: boolean;
  timeSignature?: string;
  musicalKey?: string;
  onChordClick?: (chord: string) => void;
}

interface PositionedBeat {
  beat: TabBeat;
  x: number;
}

const WIDTH = 760;
const LEFT = 46;
const RIGHT = 748;
const STAFF_TOP = 26;
const STRING_GAP = 14;
const STAFF_BOTTOM = STAFF_TOP + STRING_GAP * 5;
const STEM_BOTTOM = 116;
const MELODY_Y = 151;
const LYRIC_Y = 178;
const HEIGHT = 196;

function chunkMeasures(measures: TabMeasure[]) {
  const rows: TabMeasure[][] = [];
  for (let index = 0; index < measures.length; index += 2) rows.push(measures.slice(index, index + 2));
  return rows;
}

function positionBeats(measure: TabMeasure, start: number, width: number): PositionedBeat[] {
  const beats = getMeasureBeats(measure);
  const total = beats.reduce((sum, beat) => sum + beatWeight(beat), 0) || 1;
  const inset = Math.min(27, width * 0.09);
  const usable = width - inset * 2;
  let elapsed = 0;
  return beats.map((beat) => {
    const x = start + inset + (elapsed / total) * usable;
    elapsed += beatWeight(beat);
    return { beat, x };
  });
}

function BeatNotes({ positioned }: { positioned: PositionedBeat }) {
  const { beat, x } = positioned;
  if (!beat.notes.length) return <text className="tab-rest" x={x} y={STAFF_TOP + 43} textAnchor="middle">·</text>;

  if (beat.technique && beat.notes.length === 2) {
    const [first, second] = beat.notes;
    const y = STAFF_TOP + (first.string - 1) * STRING_GAP;
    return (
      <g>
        <path className="technique-slur" d={`M ${x - 10} ${y - 6} Q ${x} ${y - 15} ${x + 10} ${y - 6}`} />
        <text className="technique-label" x={x} y={y - 12} textAnchor="middle">{beat.technique}</text>
        <text className="tab-fret" x={x - 9} y={y + 5} textAnchor="middle">{first.fret}</text>
        <text className="tab-fret" x={x + 9} y={y + 5} textAnchor="middle">{second.fret}</text>
      </g>
    );
  }

  return (
    <g>
      {beat.notes.map((note, index) => {
        const y = STAFF_TOP + (note.string - 1) * STRING_GAP;
        return <text className={`tab-fret ${note.fret === 'x' ? 'muted' : ''}`} key={`${note.string}-${index}`} x={x} y={y + 5} textAnchor="middle">{note.fret === 'x' ? '×' : note.fret}</text>;
      })}
    </g>
  );
}

function Rhythm({ positions }: { positions: PositionedBeat[] }) {
  return (
    <g className="rhythm-layer">
      {positions.map(({ beat, x }, index) => {
        if (!beat.notes.length || beat.duration === 1) return null;
        const next = positions[index + 1];
        const canBeam = beat.duration >= 8 && next?.beat.notes.length && next.beat.duration >= 8;
        return (
          <g key={index}>
            <line className="note-stem" x1={x + 7} y1={STAFF_BOTTOM + 2} x2={x + 7} y2={STEM_BOTTOM} />
            {canBeam && <line className="note-beam" x1={x + 7} y1={STEM_BOTTOM} x2={next.x + 7} y2={STEM_BOTTOM} />}
            {canBeam && beat.duration === 16 && next.beat.duration === 16 && <line className="note-beam" x1={x + 7} y1={STEM_BOTTOM + 5} x2={next.x + 7} y2={STEM_BOTTOM + 5} />}
            {!canBeam && beat.duration >= 8 && <path className="note-flag" d={`M ${x + 7} ${STEM_BOTTOM} q 12 4 8 12`} />}
            {beat.dotted && <circle className="rhythm-dot" cx={x + 13} cy={STAFF_BOTTOM + 7} r="1.8" />}
          </g>
        );
      })}
    </g>
  );
}

function MeasureNotation({ measure, start, width, index }: { measure: TabMeasure; start: number; width: number; index: number }) {
  const positions = positionBeats(measure, start, width);
  const melody = measure.melody?.trim().split(/\s+/).filter(Boolean) || [];
  const lyric = measure.lyric?.trim().split(/\s+/).filter(Boolean) || [];
  const inset = Math.min(27, width * 0.09);
  const alignedX = (itemIndex: number, itemCount: number) => positions[itemIndex]?.x
    ?? start + inset + (itemIndex / Math.max(1, itemCount - 1)) * (width - inset * 2);

  return (
    <g>
      <text className="measure-number" x={start + 5} y={15}>{index + 1}</text>
      <Rhythm positions={positions} />
      {positions.map((positioned, beatIndex) => <BeatNotes key={beatIndex} positioned={positioned} />)}
      {melody.map((token, tokenIndex) => <text className="jianpu-token" key={`m-${tokenIndex}`} x={alignedX(tokenIndex, melody.length)} y={MELODY_Y} textAnchor="middle">{token}</text>)}
      {lyric.map((token, tokenIndex) => <text className="lyric-token" key={`l-${tokenIndex}`} x={alignedX(tokenIndex, lyric.length)} y={LYRIC_Y} textAnchor="middle">{token}</text>)}
    </g>
  );
}

export default function TabStaff({ sections, showDiagrams = true, showMelody = true, timeSignature = '4/4', musicalKey = 'C', onChordClick }: Props) {
  const [beatsPerBar, beatUnit] = timeSignature.split('/');

  return (
    <div className={`tab-sections readable-tab ${showMelody ? '' : 'hide-melody'}`}>
      {sections.length > 1 && <nav className="section-nav" aria-label="琴谱段落导航">
        {sections.map((section) => <button key={section.id} onClick={() => document.getElementById(`score-section-${section.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>{section.name}</button>)}
      </nav>}
      {sections.map((section) => (
        <section className="tab-section" id={`score-section-${section.id}`} key={section.id}>
          <div className="section-heading"><span>{section.name}</span><small>{section.measures.length} 小节</small><i /></div>
          <div className="notation-paper">
            {chunkMeasures(section.measures).map((row, rowIndex) => {
              const measureWidth = (RIGHT - LEFT) / row.length;
              return (
                <div className={`notation-system ${row.length === 1 ? 'single' : ''}`} key={`${section.id}-${rowIndex}`}>
                  <div className="notation-chord-row" style={{ '--measure-count': row.length } as CSSProperties}>
                    {row.map((measure) => showDiagrams ? (
                      <button className="notation-chord" key={measure.id} onClick={() => onChordClick?.(measure.chord)} aria-label={`查看 ${measure.chord} 和弦`}>
                        <ChordDiagram name={measure.chord} compact />
                      </button>
                    ) : <div className="notation-chord-name" key={measure.id}>{measure.chord}</div>)}
                  </div>
                  <svg className="notation-svg" viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-label={`${section.name}，第 ${rowIndex * 2 + 1} 到 ${rowIndex * 2 + row.length} 小节`}>
                    {rowIndex === 0 && <g className="time-signature"><text x="20" y={STAFF_TOP + 25} textAnchor="middle">{beatsPerBar}</text><text x="20" y={STAFF_TOP + 51} textAnchor="middle">{beatUnit}</text></g>}
                    {Array.from({ length: 6 }, (_, stringIndex) => <line className="staff-line" key={stringIndex} x1={LEFT} y1={STAFF_TOP + stringIndex * STRING_GAP} x2={RIGHT} y2={STAFF_TOP + stringIndex * STRING_GAP} />)}
                    <line className="bar-line" x1={LEFT} y1={STAFF_TOP} x2={LEFT} y2={STAFF_BOTTOM} />
                    {row.map((measure, measureIndex) => {
                      const start = LEFT + measureIndex * measureWidth;
                      const end = start + measureWidth;
                      const globalIndex = rowIndex * 2 + measureIndex;
                      const isLast = rowIndex === Math.ceil(section.measures.length / 2) - 1 && measureIndex === row.length - 1;
                      return (
                        <g key={measure.id}>
                          <line className="bar-line" x1={end} y1={STAFF_TOP} x2={end} y2={STAFF_BOTTOM} />
                          {isLast && <line className="final-bar-line" x1={end - 5} y1={STAFF_TOP} x2={end - 5} y2={STAFF_BOTTOM} />}
                          <MeasureNotation measure={measure} start={start} width={measureWidth} index={globalIndex} />
                        </g>
                      );
                    })}
                    {rowIndex === 0 && showMelody && <text className="key-signature" x="2" y={MELODY_Y - 20}>1={musicalKey}</text>}
                  </svg>
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}

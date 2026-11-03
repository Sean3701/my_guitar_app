import { Fragment } from 'react';
import { uid } from '../lib/score';

interface Props {
  text: string;
  onChordClick: (chord: string) => void;
  selectedChord?: string;
}

const chordPattern = /[A-G](?:#|b)?(?:maj7|m7|m6|m|sus2|sus4|add9|dim|aug|7|6|9)?/g;
const isChordLine = (line: string) => {
  const matches = line.match(chordPattern);
  if (!matches?.length) return false;
  return line.replace(chordPattern, '').replace(/[\s|_—\-().\d/]/g, '').length === 0;
};

export default function ChordSheet({ text, onChordClick, selectedChord }: Props) {
  const lines = text.split(/\r?\n/);
  return (
    <div className="chord-sheet">
      {lines.map((line, index) => {
        const section = line.trim().match(/^\[(.+)\]$/);
        if (section) return <div className="chord-section-title" key={index}><span>{section[1]}</span><i /></div>;
        if (!isChordLine(line)) {
          if (line.trim() && (index === 0 || !isChordLine(lines[index - 1] || ''))) return <div className="lyric-line plain" key={index}>{line}</div>;
          return null;
        }
        const chords = [...line.matchAll(chordPattern)];
        const next = lines[index + 1] || '';
        const hasLyric = next.trim() && !isChordLine(next) && !/^\[/.test(next.trim());
        const bars = line.replace(chordPattern, '');
        return (
          <div className={`chord-lyric-line ${hasLyric ? '' : 'instrumental'}`} key={index}>
            <div className="chord-row">
              {chords.map((match, chordIndex) => (
                <button
                  key={`${match.index}-${chordIndex}`}
                  style={{ left: `${match.index || 0}ch` }}
                  className={selectedChord === match[0] ? 'selected' : ''}
                  onClick={() => onChordClick(match[0])}
                >{match[0]}</button>
              ))}
            </div>
            <div className="lyric-line">{hasLyric ? next : bars}</div>
          </div>
        );
      })}
    </div>
  );
}

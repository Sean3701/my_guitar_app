import { getChord } from '../data/chords';

interface Props {
  name: string;
  compact?: boolean;
  showName?: boolean;
}

export default function ChordDiagram({ name, compact = false, showName = true }: Props) {
  const chord = getChord(name);
  if (!chord) return <div className={`chord-diagram unknown ${compact ? 'compact' : ''}`}><b>{name}</b><span>暂无指法</span></div>;
  const baseFret = chord.baseFret || 1;
  const left = 22;
  const stringGap = 12;
  const top = 29;
  const fretGap = 14;
  const dotY = (fret: number) => top + (fret - baseFret + 0.5) * fretGap;
  const barre = chord.barres?.[0];
  const barreStrings = barre ? chord.frets.map((fret, index) => ({ fret, index })).filter((item) => item.fret === barre) : [];
  const barreStart = barreStrings.length ? Math.min(...barreStrings.map((item) => item.index)) : 0;
  const barreEnd = barreStrings.length ? Math.max(...barreStrings.map((item) => item.index)) : 5;

  return (
    <div className={`chord-diagram ${compact ? 'compact' : ''}`}>
      {showName && <strong>{name}</strong>}
      <svg viewBox="0 0 104 108" role="img" aria-label={`${name} 和弦指法图`}>
        {chord.frets.map((fret, index) => (
          <text key={`mark-${index}`} x={left + index * stringGap} y="14" textAnchor="middle" className="fret-mark">
            {fret === -1 ? '×' : fret === 0 ? '○' : ''}
          </text>
        ))}
        {baseFret === 1 && <line x1={left - 2} y1={top} x2={left + 5 * stringGap + 2} y2={top} className="nut" />}
        {Array.from({ length: 6 }, (_, index) => (
          <line key={`v-${index}`} x1={left + index * stringGap} y1={top} x2={left + index * stringGap} y2={top + 5 * fretGap} className="grid-line" />
        ))}
        {Array.from({ length: 6 }, (_, index) => (
          <line key={`h-${index}`} x1={left} y1={top + index * fretGap} x2={left + 5 * stringGap} y2={top + index * fretGap} className="grid-line" />
        ))}
        {baseFret > 1 && <text x="7" y={top + 11} className="base-fret">{baseFret}品</text>}
        {barre && <line x1={left + barreStart * stringGap} y1={dotY(barre)} x2={left + barreEnd * stringGap} y2={dotY(barre)} className="barre" />}
        {chord.frets.map((fret, index) => {
          if (fret <= 0 || fret === barre) return null;
          return (
            <g key={`dot-${index}`}>
              <circle cx={left + index * stringGap} cy={dotY(fret)} r="5.2" className="finger-dot" />
              {!!chord.fingers?.[index] && <text x={left + index * stringGap} y={dotY(fret) + 2.3} textAnchor="middle" className="finger-number">{chord.fingers[index]}</text>}
            </g>
          );
        })}
        {['6', '5', '4', '3', '2', '1'].map((label, index) => <text key={label} x={left + index * stringGap} y="106" textAnchor="middle" className="string-label">{label}</text>)}
      </svg>
    </div>
  );
}

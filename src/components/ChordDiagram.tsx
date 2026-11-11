import { resolveChord, type ChordResolution } from '../data/chords';

interface Props {
  name: string;
  /** 已经解析好的结果，避免重复解析 */
  resolution?: ChordResolution | null;
  showName?: boolean;
  compact?: boolean;
  width?: number;
  /** 指法图下方的说明，如把位或组成音 */
  caption?: string;
}

// 版式常量：6 弦 × 5 品，坐标固定，缩放交给 CSS
const W = 118;
const H = 124;
const LEFT = 27;
const GAP = 14;
const TOP = 32;
const FRET = 15;

const stringX = (index: number) => LEFT + index * GAP;
const fretY = (fret: number, baseFret: number) => TOP + (fret - baseFret + 0.5) * FRET;

export default function ChordDiagram({ name, resolution, showName = true, compact = false, width, caption }: Props) {
  const data = resolution === undefined ? resolveChord(name) : resolution;
  if (!data) {
    return (
      <div className={`chord-diagram unknown ${compact ? 'compact' : ''}`}>
        <strong>{name}</strong>
        <span>暂无指法</span>
      </div>
    );
  }

  const { frets, fingers, barres } = data.position;
  const baseFret = data.position.baseFret ?? 1;
  const barreFret = barres?.[0];
  const barreSpan = barreFret ? frets.map((fret, index) => (fret === barreFret ? index : -1)).filter((index) => index >= 0) : [];
  // 只有真的横跨两根以上弦才画横按，单弦按的还画成圆点
  const hasBarre = barreSpan.length >= 2;
  const barreFrom = hasBarre ? Math.min(...barreSpan) : 0;
  const barreTo = hasBarre ? Math.max(...barreSpan) : 0;

  return (
    <div
      className={`chord-diagram ${compact ? 'compact' : ''}`}
      style={width ? { width } : undefined}
    >
      {showName && <strong>{name}</strong>}
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${name} 和弦指法图`}>
        {frets.map((fret, index) => (
          <text key={`mark-${index}`} x={stringX(index)} y={TOP - 11} textAnchor="middle" className="fret-mark">
            {fret === -1 ? '×' : fret === 0 ? '○' : ''}
          </text>
        ))}

        {/* 琴枕只在第一把位加粗，高把位用细线加「N品」标注 */}
        <line
          x1={stringX(0) - 1}
          y1={TOP}
          x2={stringX(5) + 1}
          y2={TOP}
          className={baseFret === 1 ? 'nut' : 'grid-line'}
        />
        {baseFret > 1 && (
          <text x={LEFT - 5} y={TOP + 10} textAnchor="end" className="base-fret">{baseFret}品</text>
        )}

        {Array.from({ length: 6 }, (_, index) => (
          <line key={`v-${index}`} x1={stringX(index)} y1={TOP} x2={stringX(index)} y2={TOP + 5 * FRET} className="grid-line" />
        ))}
        {Array.from({ length: 6 }, (_, index) => (
          <line key={`h-${index}`} x1={stringX(0)} y1={TOP + index * FRET} x2={stringX(5)} y2={TOP + index * FRET} className="grid-line" />
        ))}

        {hasBarre && (
          <rect
            x={stringX(barreFrom) - 4.5}
            y={fretY(barreFret!, baseFret) - 4.5}
            width={stringX(barreTo) - stringX(barreFrom) + 9}
            height={9}
            rx={4.5}
            className="barre"
          />
        )}

        {frets.map((fret, index) => {
          if (fret <= 0) return null;
          if (hasBarre && fret === barreFret) {
            // 横按只在与按弦位置重合的两端标手指号，中间留白更干净
            const finger = fingers?.[index];
            if (!finger || (index !== barreFrom && index !== barreTo)) return null;
            return (
              <text key={`finger-${index}`} x={stringX(index)} y={fretY(fret, baseFret) + 2.2} textAnchor="middle" className="finger-number">
                {finger}
              </text>
            );
          }
          return (
            <g key={`dot-${index}`}>
              <circle cx={stringX(index)} cy={fretY(fret, baseFret)} r="4.8" className="finger-dot" />
              {!!fingers?.[index] && (
                <text x={stringX(index)} y={fretY(fret, baseFret) + 2.2} textAnchor="middle" className="finger-number">
                  {fingers[index]}
                </text>
              )}
            </g>
          );
        })}

        {['6', '5', '4', '3', '2', '1'].map((label, index) => (
          <text key={label} x={stringX(index)} y={TOP + 5 * FRET + 13} textAnchor="middle" className="string-label">{label}</text>
        ))}
      </svg>
      {caption && <small className="chord-caption">{caption}</small>}
    </div>
  );
}

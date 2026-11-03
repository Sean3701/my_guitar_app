import type { TabSection } from '../types';
import ChordDiagram from './ChordDiagram';

interface Props {
  sections: TabSection[];
  showDiagrams?: boolean;
  onChordClick?: (chord: string) => void;
}

export default function TabStaff({ sections, showDiagrams = true, onChordClick }: Props) {
  return (
    <div className="tab-sections">
      {sections.map((section) => (
        <section className="tab-section" key={section.id}>
          <div className="section-heading"><span>{section.name}</span><i /></div>
          <div className="tab-scroll">
            <div className="tab-string-labels" aria-hidden="true">
              {['e', 'B', 'G', 'D', 'A', 'E'].map((label) => <span key={label}>{label}</span>)}
            </div>
            <div className="tab-measures">
              {section.measures.map((measure) => (
                <div className="tab-measure" key={measure.id}>
                  {showDiagrams ? (
                    <button className="measure-chord" onClick={() => onChordClick?.(measure.chord)} aria-label={`查看 ${measure.chord} 和弦`}>
                      <ChordDiagram name={measure.chord} compact />
                    </button>
                  ) : <div className="measure-chord-name">{measure.chord}</div>}
                  <div className="measure-strings">
                    {measure.strings.map((string, stringIndex) => (
                      <div className="tab-string" key={stringIndex}>
                        <div className="tab-tokens">
                          {string.padEnd(8, '-').slice(0, 12).split('').map((token, tokenIndex) => (
                            <span key={tokenIndex}>{token === '-' || token === '—' ? '' : token}</span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      ))}
    </div>
  );
}

import { useEffect, useState } from 'react';
import { Volume2, X } from 'lucide-react';
import ChordDiagram from './ChordDiagram';
import { noteNameAt, positionLabel, resolveChord } from '../data/chords';
import { playChord, stopGuitarTone } from '../lib/guitarTone';

interface Props {
  name: string;
  /** 在谱子里出现的次数，和弦库打开时不传 */
  count?: number;
  onClose: () => void;
}

export default function ChordDetailSheet({ name, count, onClose }: Props) {
  const resolution = resolveChord(name);
  const [playing, setPlaying] = useState(false);

  // Esc 关闭 + 锁住背景滚动；离开时把试听声音掐掉，别让它跟着跑
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = previous;
      stopGuitarTone();
    };
  }, []);

  const listen = () => {
    if (!resolution || playing) return;
    setPlaying(true);
    playChord(resolution.position.frets).then(() => setPlaying(false));
  };

  if (!resolution) {
    return (
      <div className="chord-detail-overlay" role="dialog" aria-modal="true" onClick={onClose}>
        <div className="chord-detail-panel" onClick={(event) => event.stopPropagation()}>
          <div className="chord-detail-head"><h2>{name}</h2><button className="icon-button" aria-label="关闭" onClick={onClose}><X size={20} /></button></div>
          <p className="chord-detail-empty">这个和弦暂未收录指法，可以换个写法试试。</p>
        </div>
      </div>
    );
  }

  const { entry, position } = resolution;
  const strings = position.frets.map((fret, index) => ({
    label: `${6 - index} 弦`,
    detail: fret < 0 ? '不弹' : fret === 0 ? '空弦' : `${fret} 品`,
    note: fret < 0 ? null : noteNameAt(index, fret, entry.flats),
    muted: fret < 0,
  }));

  return (
    <div className="chord-detail-overlay" role="dialog" aria-modal="true" aria-label={`${name} 和弦指法`} onClick={onClose}>
      <div className="chord-detail-panel" onClick={(event) => event.stopPropagation()}>
        <div className="chord-detail-head">
          <div>
            <span className="eyebrow">和弦指法</span>
            <h2>{name}</h2>
          </div>
          <button className="icon-button" aria-label="关闭" onClick={onClose}><X size={20} /></button>
        </div>

        <div className="chord-detail-body">
          <ChordDiagram name={name} resolution={resolution} showName={false} width={148} />
          <div className="chord-detail-info">
            <p className="chord-detail-meta">{positionLabel(position)}</p>
            <div className="chord-note-chips">
              {entry.notes.map((note, index) => <span key={`${note}-${index}`}>{note}</span>)}
            </div>
            <div className="chord-detail-tags">
              {resolution.transposed && <span className="chord-tag">移调指法</span>}
              {resolution.approx && <span className="chord-tag">简化指法</span>}
              {resolution.entry.bass !== resolution.entry.root && <span className="chord-tag">低音 {resolution.entry.bass}</span>}
              {count ? <span className="chord-tag">谱中出现 {count} 次</span> : null}
            </div>
            <button className={`soft-button chord-listen ${playing ? 'active' : ''}`} onClick={listen} disabled={playing}>
              <Volume2 size={15} />{playing ? '正在响…' : '试听扫弦'}
            </button>
          </div>
        </div>

        <div className="chord-string-list">
          {strings.map((item) => (
            <div className={`chord-string ${item.muted ? 'muted' : ''}`} key={item.label}>
              <span>{item.label}</span>
              <b>{item.detail}</b>
              <i>{item.note || '—'}</i>
            </div>
          ))}
        </div>
        <p className="chord-legend">○ 空弦　× 不弹　数字是按弦手指（1 食指 · 2 中指 · 3 无名指 · 4 小指）</p>
      </div>
    </div>
  );
}

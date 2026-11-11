import { useEffect, useMemo, useRef } from 'react';
import ChordDiagram from './ChordDiagram';
import { extractChords } from '../lib/chordParse';

interface Props {
  /** 谱面文本：弹唱谱的和弦文本，或 OCR 识别出的原谱文字 */
  text: string;
  selected?: string;
  onSelect: (name: string) => void;
  onOpen?: (name: string, count: number) => void;
}

/**
 * 谱子下方固定的和弦条：把这份谱子里用到的和弦全部画成指法图。
 * 谱面里点到某个和弦时，对应的小图会自动滚到中间。
 */
export default function UsedChordStrip({ text, selected, onSelect, onOpen }: Props) {
  const chords = useMemo(() => extractChords(text), [text]);
  const rowRef = useRef<HTMLDivElement | null>(null);
  const activeRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    const row = rowRef.current;
    const target = activeRef.current;
    if (!row || !target) return;
    // 只滚这一条，别让整个页面跟着跳
    row.scrollTo({ left: target.offsetLeft - row.clientWidth / 2 + target.clientWidth / 2, behavior: 'smooth' });
  }, [selected, chords.length]);

  if (!chords.length) return null;

  return (
    <section className="used-chords" aria-label="本谱用到的和弦">
      <div className="used-chords-head">
        <b>本谱和弦</b>
        <span>共 {chords.length} 个 · 点开可看大图</span>
      </div>
      <div className="used-chords-row" ref={rowRef}>
        {chords.map((chord) => {
          const active = selected === chord.name;
          return (
            <button
              key={chord.resolution.entry.name}
              ref={active ? activeRef : undefined}
              className={`used-chord ${active ? 'active' : ''}`}
              onClick={() => {
                onSelect(chord.name);
                onOpen?.(chord.name, chord.count);
              }}
            >
              <ChordDiagram name={chord.name} resolution={chord.resolution} showName={false} compact />
              <b>{chord.name}</b>
            </button>
          );
        })}
      </div>
    </section>
  );
}

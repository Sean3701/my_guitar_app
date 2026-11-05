import { useState } from 'react';
import { Eye, Plus } from 'lucide-react';
import type { Score } from '../types';
import ChordSheet from './ChordSheet';

interface Props {
  initialScore: Score;
  onSave: (score: Score) => void;
  saving?: boolean;
}

export default function ScoreEditor({ initialScore, onSave, saving }: Props) {
  const [draft, setDraft] = useState<Score>(() => structuredClone(initialScore));
  const [preview, setPreview] = useState(false);
  const [selectedChord, setSelectedChord] = useState('C');
  const update = <K extends keyof Score>(key: K, value: Score[K]) => setDraft((old) => ({ ...old, [key]: value }));

  return (
    <div className="score-editor">
      <div className="editor-toolbar">
        <div><span className="eyebrow">弹唱谱编辑</span><h2>调整琴谱</h2></div>
        <button className={`soft-button ${preview ? 'active' : ''}`} onClick={() => setPreview(!preview)}><Eye size={17} />{preview ? '继续编辑' : '预览效果'}</button>
      </div>
      <div className="metadata-form">
        <label className="wide"><span>歌名</span><input value={draft.title} onChange={(event) => update('title', event.target.value)} placeholder="请输入歌名" /></label>
        <label className="wide"><span>音乐人</span><input value={draft.artist} onChange={(event) => update('artist', event.target.value)} placeholder="选填" /></label>
        <label><span>调式</span><select value={draft.musicalKey} onChange={(event) => update('musicalKey', event.target.value)}>{['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'].map((key) => <option key={key}>{key}</option>)}</select></label>
        <label><span>变调夹</span><select value={draft.capo} onChange={(event) => update('capo', Number(event.target.value))}>{Array.from({ length: 13 }, (_, index) => <option value={index} key={index}>{index === 0 ? '不使用' : `${index} 品`}</option>)}</select></label>
        <label><span>速度 BPM</span><input type="number" min="30" max="240" value={draft.bpm} onChange={(event) => update('bpm', Number(event.target.value))} /></label>
        <label><span>拍号</span><select value={draft.timeSignature} onChange={(event) => update('timeSignature', event.target.value)}>{['4/4', '3/4', '6/8', '2/4'].map((value) => <option key={value}>{value}</option>)}</select></label>
      </div>

      {preview ? (
        <div className="editor-preview"><ChordSheet text={draft.chordText} onChordClick={setSelectedChord} selectedChord={selectedChord} /></div>
      ) : (
        <div className="chord-editor">
          <div className="editor-tip">和弦写在歌词上一行，用空格对齐；段落用 <b>[主歌]</b> 标记。保存后点击和弦即可看指法。</div>
          <textarea value={draft.chordText} onChange={(event) => update('chordText', event.target.value)} spellCheck={false} aria-label="弹唱谱文本" />
          <button className="secondary-button full" onClick={() => update('chordText', `${draft.chordText}\n\n[新段落]\nC           G\n在这里输入歌词`)}><Plus size={17} />添加段落</button>
        </div>
      )}
      <div className="editor-save-bar"><span>确认无误后保存到谱架</span><button className="primary-button" disabled={saving || !draft.title.trim()} onClick={() => onSave({ ...draft, title: draft.title.trim() })}>{saving ? '正在保存…' : '确认并保存'}</button></div>
    </div>
  );
}

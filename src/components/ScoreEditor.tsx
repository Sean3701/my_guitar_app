import { useState } from 'react';
import { Eye, Plus, Trash2 } from 'lucide-react';
import type { Score } from '../types';
import { makeMeasure, uid } from '../lib/score';
import TabStaff from './TabStaff';
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

  const updateMeasure = (sectionId: string, measureId: string, field: 'chord' | 'strings', value: string | string[]) => {
    update('sections', draft.sections.map((section) => section.id !== sectionId ? section : {
      ...section, measures: section.measures.map((measure) => measure.id === measureId ? { ...measure, [field]: value } : measure),
    }));
  };

  return (
    <div className="score-editor">
      <div className="editor-toolbar">
        <div><span className="eyebrow">人工校对</span><h2>调整琴谱</h2></div>
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
        <div className="editor-preview">
          {draft.type === 'tab' ? <TabStaff sections={draft.sections} showDiagrams={false} /> : <ChordSheet text={draft.chordText} onChordClick={setSelectedChord} selectedChord={selectedChord} />}
        </div>
      ) : draft.type === 'tab' ? (
        <div className="tab-editor">
          <div className="editor-tip">每格代表一个弦上位置；<b>0</b> 为空弦，<b>×</b> 为不弹，<b>-</b> 为留白。可连续输入多个位置。</div>
          {draft.sections.map((section) => (
            <section className="edit-section" key={section.id}>
              <div className="edit-section-title"><input value={section.name} onChange={(event) => update('sections', draft.sections.map((item) => item.id === section.id ? { ...item, name: event.target.value } : item))} /><span>{section.measures.length} 小节</span></div>
              <div className="measure-edit-list">
                {section.measures.map((measure, measureIndex) => (
                  <div className="measure-edit-card" key={measure.id}>
                    <div className="measure-edit-head"><span>第 {measureIndex + 1} 小节</span><input className="chord-input" value={measure.chord} onChange={(event) => updateMeasure(section.id, measure.id, 'chord', event.target.value)} aria-label="和弦" /><button onClick={() => update('sections', draft.sections.map((item) => item.id === section.id ? { ...item, measures: item.measures.filter((entry) => entry.id !== measure.id) } : item))} aria-label="删除小节"><Trash2 size={15} /></button></div>
                    <div className="string-edit-grid">
                      {measure.strings.map((string, stringIndex) => <label key={stringIndex}><span>{['1弦 e', '2弦 B', '3弦 G', '4弦 D', '5弦 A', '6弦 E'][stringIndex]}</span><input value={string} maxLength={12} onChange={(event) => {
                        const strings = [...measure.strings]; strings[stringIndex] = event.target.value.toLowerCase().replace(/[^0-9xhpb\/\\-]/g, ''); updateMeasure(section.id, measure.id, 'strings', strings);
                      }} /></label>)}
                    </div>
                  </div>
                ))}
              </div>
              <button className="add-measure" onClick={() => update('sections', draft.sections.map((item) => item.id === section.id ? { ...item, measures: [...item.measures, makeMeasure('C', item.measures.length)] } : item))}><Plus size={16} />添加小节</button>
            </section>
          ))}
          <button className="secondary-button full" onClick={() => update('sections', [...draft.sections, { id: uid(), name: `段落 ${draft.sections.length + 1}`, measures: [makeMeasure('C')] }])}><Plus size={17} />添加段落</button>
        </div>
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

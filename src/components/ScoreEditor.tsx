import { useState } from 'react';
import { Copy, Eye, Plus, Trash2 } from 'lucide-react';
import type { Score, TabMeasure } from '../types';
import { emptyMeasure, uid } from '../lib/score';
import { getMeasureBeats, getMeasureTabText } from '../lib/tab';
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

  const updateMeasure = (sectionId: string, measureId: string, field: 'chord' | 'tab' | 'melody' | 'lyric', value: string) => {
    update('sections', draft.sections.map((section) => section.id !== sectionId ? section : {
      ...section, measures: section.measures.map((measure) => measure.id === measureId ? { ...measure, [field]: value } : measure),
    }));
  };

  const duplicateMeasure = (sectionId: string, measure: TabMeasure) => {
    update('sections', draft.sections.map((section) => {
      if (section.id !== sectionId) return section;
      const index = section.measures.findIndex((item) => item.id === measure.id);
      const measures = [...section.measures];
      measures.splice(index + 1, 0, { ...structuredClone(measure), id: uid() });
      return { ...section, measures };
    }));
  };

  return (
    <div className="score-editor">
      <div className="editor-toolbar">
        <div><span className="eyebrow">结构化记谱</span><h2>调整琴谱</h2></div>
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
          {draft.type === 'tab' ? <TabStaff sections={draft.sections} timeSignature={draft.timeSignature} musicalKey={draft.musicalKey} /> : <ChordSheet text={draft.chordText} onChordClick={setSelectedChord} selectedChord={selectedChord} />}
        </div>
      ) : draft.type === 'tab' ? (
        <div className="tab-editor">
          <details className="notation-guide">
            <summary>新记谱格式说明<span>简单、可读、可完整编辑</span></summary>
            <div className="notation-guide-body">
              <code>0.1 2.2 (0.3 1.2 2.3)/4 2h4.3 -</code>
              <ul>
                <li><b>品位.弦序</b>：<code>0.1</code> 是 1 弦空弦，<code>12.2</code> 是 2 弦 12 品。</li>
                <li><b>括号同时弹</b>：<code>(0.1 1.2 2.3)</code> 表示三个音一起弹。</li>
                <li><b>时值与技巧</b>：默认八分音符，<code>/4</code> 是四分音符；<code>h</code> 击弦、<code>p</code> 勾弦、<code>s</code> 滑弦，<code>-</code> 休止。</li>
                <li><b>简谱和歌词</b>：用空格分开，会按六线谱的位置自动对齐。</li>
              </ul>
            </div>
          </details>
          {draft.sections.map((section) => (
            <section className="edit-section" key={section.id}>
              <div className="edit-section-title"><input value={section.name} onChange={(event) => update('sections', draft.sections.map((item) => item.id === section.id ? { ...item, name: event.target.value } : item))} /><span>{section.measures.length} 小节</span></div>
              <div className="measure-edit-list">
                {section.measures.map((measure, measureIndex) => (
                  <div className="measure-edit-card" key={measure.id}>
                    <div className="measure-edit-head">
                      <span>第 {measureIndex + 1} 小节 · {getMeasureBeats(measure).length} 个节奏位置</span>
                      <input className="chord-input" value={measure.chord} onChange={(event) => updateMeasure(section.id, measure.id, 'chord', event.target.value)} aria-label="和弦" />
                      <button onClick={() => duplicateMeasure(section.id, measure)} aria-label="复制小节"><Copy size={15} /></button>
                      <button onClick={() => update('sections', draft.sections.map((item) => item.id === section.id ? { ...item, measures: item.measures.filter((entry) => entry.id !== measure.id) } : item))} aria-label="删除小节"><Trash2 size={15} /></button>
                    </div>
                    <div className="notation-edit-fields">
                      <label><span>六线谱</span><input className="tab-notation-input" value={getMeasureTabText(measure)} onChange={(event) => updateMeasure(section.id, measure.id, 'tab', event.target.value)} placeholder="例如 0.1 2.2 0.3 2h4.3" spellCheck={false} /></label>
                      <label><span>简谱</span><input value={measure.melody || ''} onChange={(event) => updateMeasure(section.id, measure.id, 'melody', event.target.value)} placeholder="例如 0 5 6 1 2 3 2 1" spellCheck={false} /></label>
                      <label><span>歌词 <small>选填</small></span><input value={measure.lyric || ''} onChange={(event) => updateMeasure(section.id, measure.id, 'lyric', event.target.value)} placeholder="用 空 格 分 开 每 个 字" /></label>
                    </div>
                  </div>
                ))}
              </div>
              <button className="add-measure" onClick={() => update('sections', draft.sections.map((item) => item.id === section.id ? { ...item, measures: [...item.measures, emptyMeasure(item.measures.at(-1)?.chord || 'C')] } : item))}><Plus size={16} />添加小节</button>
            </section>
          ))}
          <button className="secondary-button full" onClick={() => update('sections', [...draft.sections, { id: uid(), name: `段落 ${draft.sections.length + 1}`, measures: [emptyMeasure('C')] }])}><Plus size={17} />添加段落</button>
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

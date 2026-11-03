import { useRef, useState } from 'react';
import { ArrowDown, ArrowLeft, ArrowUp, Check, ChevronDown, FileImage, FileMusic, ImagePlus, LoaderCircle, Music2, ScanText, Trash2, X } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import type { ImportPage as ImportPageItem, Score, ScoreType } from '../types';
import { createChordDraft, createTabDraft, detectPageNumber, detectTitle, emptyScore, fileToDataUrl, uid } from '../lib/score';
import { recognizeImage } from '../lib/ocr';
import { saveScore } from '../lib/storage';
import ScoreEditor from '../components/ScoreEditor';

export default function ImportPage() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const type: ScoreType = params.get('type') === 'chord' ? 'chord' : 'tab';
  const inputRef = useRef<HTMLInputElement>(null);
  const titleEdited = useRef(false);
  const [step, setStep] = useState(1);
  const [pages, setPages] = useState<ImportPageItem[]>([]);
  const [title, setTitle] = useState('');
  const [artist, setArtist] = useState('');
  const [running, setRunning] = useState(false);
  const [draft, setDraft] = useState<Score | null>(null);
  const [saving, setSaving] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [expandedText, setExpandedText] = useState<string | null>(null);

  const addFiles = async (files: File[]) => {
    const images = files.filter((file) => file.type.startsWith('image/'));
    if (!images.length) return;
    const additions: ImportPageItem[] = await Promise.all(images.map(async (file, index) => ({
      id: uid(), file, preview: await fileToDataUrl(file), name: file.name,
      pageNumber: detectPageNumber(file.name, pages.length + index + 1), text: '', status: 'waiting', progress: 0,
    })));
    setPages((old) => [...old, ...additions]);
    if (!title && !titleEdited.current) setTitle(detectTitle('', images[0].name));
  };

  const patchPage = (id: string, patch: Partial<ImportPageItem>) => setPages((old) => old.map((page) => page.id === id ? { ...page, ...patch } : page));

  const startRecognition = async () => {
    if (!pages.length || running) return;
    setStep(2);
    setRunning(true);
    for (const page of pages) {
      patchPage(page.id, { status: 'reading', progress: 0 });
      try {
        const text = await recognizeImage(page.preview, (progress) => patchPage(page.id, { progress }));
        const number = detectPageNumber(text, page.pageNumber);
        patchPage(page.id, { text, status: 'done', pageNumber: number, progress: 1 });
        if (page.id === pages[0].id && !titleEdited.current) setTitle(detectTitle(text, page.name));
      } catch {
        patchPage(page.id, { status: 'error', progress: 0 });
      }
    }
    setPages((old) => [...old].sort((a, b) => a.pageNumber - b.pageNumber));
    setRunning(false);
  };

  const movePage = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= pages.length) return;
    setPages((old) => {
      const next = [...old];
      [next[index], next[target]] = [next[target], next[index]];
      return next.map((page, pageIndex) => ({ ...page, pageNumber: pageIndex + 1 }));
    });
  };

  const generateDraft = () => {
    const sorted = [...pages].sort((a, b) => a.pageNumber - b.pageNumber);
    const combinedText = sorted.map((page) => page.text).join('\n');
    const score = emptyScore(type, title.trim() || '未命名琴谱');
    score.artist = artist.trim();
    score.sourcePages = sorted.map((page) => ({ id: page.id, name: page.name, dataUrl: page.preview, pageNumber: page.pageNumber, text: page.text }));
    if (type === 'tab') score.sections = createTabDraft(combinedText);
    else score.chordText = createChordDraft(combinedText);
    setDraft(score);
    setStep(3);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSave = async (score: Score) => {
    setSaving(true);
    await saveScore(score);
    navigate(`/score/${score.id}`, { replace: true });
  };

  return (
    <div className="page import-page">
      <header className="sub-header"><button className="icon-button" onClick={() => step > 1 ? setStep(step - 1) : navigate('/')}><ArrowLeft size={21} /></button><div><h1>导入琴谱</h1><p>图片识别后，由你确认再保存</p></div><span className="header-spacer" /></header>
      <div className="stepper">
        {[['1', '添加图片'], ['2', '识别校对'], ['3', '生成保存']].map(([number, label], index) => <div key={number} className={`${step === index + 1 ? 'active' : ''} ${step > index + 1 ? 'complete' : ''}`}><span>{step > index + 1 ? <Check size={14} /> : number}</span><b>{label}</b>{index < 2 && <i />}</div>)}
      </div>

      {step === 1 && <>
        <div className="score-type-switch"><button className={type === 'tab' ? 'active' : ''} onClick={() => setParams({ type: 'tab' })}><FileMusic size={18} />六线谱</button><button className={type === 'chord' ? 'active' : ''} onClick={() => setParams({ type: 'chord' })}><Music2 size={18} />弹唱谱</button></div>
        <section className={`upload-zone ${dragging ? 'dragging' : ''}`} onDragOver={(event) => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={(event) => { event.preventDefault(); setDragging(false); addFiles([...event.dataTransfer.files]); }} onClick={() => inputRef.current?.click()}>
          <input ref={inputRef} type="file" accept="image/*" multiple hidden onChange={(event) => { addFiles([...(event.target.files || [])]); event.target.value = ''; }} />
          <span className="upload-illustration"><ImagePlus size={30} /><i /><i /><i /></span>
          <h2>选择{type === 'tab' ? '六线谱' : '弹唱谱'}图片</h2><p>支持多页导入，可一次选择多张</p><button className="secondary-button">从相册或文件中选择</button>
        </section>
        <div className="photo-tips"><b>识别更清晰的小技巧</b><span>图片摆正、光线均匀，页码和歌名尽量完整</span></div>
        {pages.length > 0 && <section className="selected-pages"><div className="list-section-title"><h2>已选择 {pages.length} 页</h2><button onClick={() => inputRef.current?.click()}>继续添加</button></div><div className="page-thumbnail-grid">{pages.map((page, index) => <div className="page-thumbnail" key={page.id}><img src={page.preview} alt={page.name} /><span>第 {index + 1} 张</span><button onClick={() => setPages((old) => old.filter((item) => item.id !== page.id))}><X size={14} /></button></div>)}</div></section>}
        <div className="bottom-action"><button className="primary-button full" disabled={!pages.length} onClick={startRecognition}><ScanText size={18} />开始识别 {pages.length ? `${pages.length} 页` : ''}</button></div>
      </>}

      {step === 2 && <>
        <div className={`recognition-banner ${running ? '' : 'finished'}`}><span>{running ? <LoaderCircle className="spin" size={20} /> : <Check size={20} />}</span><div><b>{running ? '正在识别图片文字…' : '图片识别已完成'}</b><p>{running ? '首次识别需要加载中文模型，请稍等' : '请检查歌名、页码和识别文本'}</p></div></div>
        <section className="recognition-meta"><label><span>歌名</span><input value={title} onChange={(event) => { titleEdited.current = true; setTitle(event.target.value); }} placeholder="输入歌名" /></label><label><span>音乐人</span><input value={artist} onChange={(event) => setArtist(event.target.value)} placeholder="选填" /></label></section>
        <section className="review-pages"><div className="list-section-title"><h2>页面顺序</h2><span>保存前请逐页确认</span></div>{pages.map((page, index) => <article className="review-page" key={page.id}>
          <img src={page.preview} alt={`第${page.pageNumber}页`} />
          <div className="review-page-main"><div className="review-page-title"><b>{page.name}</b><span className={`ocr-status ${page.status}`}>{page.status === 'reading' ? `${Math.round(page.progress * 100)}%` : page.status === 'done' ? '已识别' : page.status === 'error' ? '识别失败' : '待识别'}</span></div>
            {page.status === 'reading' && <div className="ocr-progress"><i style={{ width: `${page.progress * 100}%` }} /></div>}
            <label className="page-number-field">页码<input type="number" min="1" value={page.pageNumber} onChange={(event) => patchPage(page.id, { pageNumber: Number(event.target.value) })} /></label>
            <button className="text-review-toggle" onClick={() => setExpandedText(expandedText === page.id ? null : page.id)}>查看识别文本<ChevronDown size={14} /></button>
          </div>
          <div className="page-order-actions"><button disabled={index === 0} onClick={() => movePage(index, -1)}><ArrowUp size={15} /></button><button disabled={index === pages.length - 1} onClick={() => movePage(index, 1)}><ArrowDown size={15} /></button><button onClick={() => setPages((old) => old.filter((item) => item.id !== page.id))}><Trash2 size={15} /></button></div>
          {expandedText === page.id && <textarea className="ocr-text" value={page.text} onChange={(event) => patchPage(page.id, { text: event.target.value })} placeholder="可在这里补充或修正识别文本" />}
        </article>)}</section>
        <div className="ocr-notice"><FileImage size={18} /><p>六线、指法等图形内容无法仅靠文字 OCR 完整还原。下一步会生成可编辑草稿，请对照原图调整。</p></div>
        <div className="bottom-action"><button className="primary-button full" disabled={running || !pages.length || !title.trim()} onClick={generateDraft}>生成可编辑琴谱</button></div>
      </>}

      {step === 3 && draft && <ScoreEditor initialScore={draft} onSave={handleSave} saving={saving} />}
    </div>
  );
}

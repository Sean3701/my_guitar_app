import { useRef, useState } from 'react';
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Check, FileImage, FileMusic, ImagePlus, Music2, Trash2, X } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import type { ImportPage as ImportPageItem, ScoreType } from '../types';
import { detectPageNumber, detectTitle, emptyScore, fileToDataUrl, uid } from '../lib/score';
import { saveScore } from '../lib/storage';

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
  const [saving, setSaving] = useState(false);
  const [dragging, setDragging] = useState(false);

  const addFiles = async (files: File[]) => {
    const images = files.filter((file) => file.type.startsWith('image/'));
    if (!images.length) return;
    const additions: ImportPageItem[] = await Promise.all(images.map(async (file, index) => ({
      id: uid(), file, preview: await fileToDataUrl(file), name: file.name,
      pageNumber: detectPageNumber(file.name, pages.length + index + 1), text: '', status: 'done', progress: 1,
    })));
    setPages((old) => [...old, ...additions]);
    if (!title && !titleEdited.current) setTitle(detectTitle('', images[0].name));
  };

  const patchPage = (id: string, patch: Partial<ImportPageItem>) => setPages((old) => old.map((page) => page.id === id ? { ...page, ...patch } : page));

  const movePage = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= pages.length) return;
    setPages((old) => {
      const next = [...old];
      [next[index], next[target]] = [next[target], next[index]];
      return next.map((page, pageIndex) => ({ ...page, pageNumber: pageIndex + 1 }));
    });
  };

  const preparePages = () => {
    if (!pages.length) return;
    setStep(2);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const saveImportedScore = async () => {
    if (!title.trim() || !pages.length || saving) return;
    setSaving(true);
    const sorted = [...pages].sort((a, b) => a.pageNumber - b.pageNumber);
    const score = emptyScore(type, title.trim());
    score.artist = artist.trim();
    score.sections = [];
    score.chordText = '';
    score.sourcePages = sorted.map((page) => ({ id: page.id, name: page.name, dataUrl: page.preview, pageNumber: page.pageNumber, text: '' }));
    try {
      await saveScore(score);
      navigate(`/score/${score.id}?view=original`, { replace: true });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="page import-page">
      <header className="sub-header"><button className="icon-button" aria-label="返回" onClick={() => step > 1 ? setStep(step - 1) : navigate('/')}><ArrowLeft size={21} /></button><div><h1>导入琴谱图片</h1><p>只做原图整理，不进行文字识别</p></div><span className="header-spacer" /></header>
      <div className="stepper">
        {[['1', '添加图片'], ['2', '信息与页码']].map(([number, label], index) => <div key={number} className={`${step === index + 1 ? 'active' : ''} ${step > index + 1 ? 'complete' : ''}`}><span>{step > index + 1 ? <Check size={14} /> : number}</span><b>{label}</b>{index < 1 && <i />}</div>)}
      </div>

      {step === 1 && <>
        <div className="score-type-switch"><button className={type === 'tab' ? 'active' : ''} onClick={() => setParams({ type: 'tab' })}><FileMusic size={18} />六线谱</button><button className={type === 'chord' ? 'active' : ''} onClick={() => setParams({ type: 'chord' })}><Music2 size={18} />弹唱谱</button></div>
        <section className={`upload-zone ${dragging ? 'dragging' : ''}`} onDragOver={(event) => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={(event) => { event.preventDefault(); setDragging(false); addFiles([...event.dataTransfer.files]); }} onClick={() => inputRef.current?.click()}>
          <input ref={inputRef} type="file" accept="image/*" multiple hidden onChange={(event) => { addFiles([...(event.target.files || [])]); event.target.value = ''; }} />
          <span className="upload-illustration"><ImagePlus size={30} /><i /><i /><i /></span>
          <h2>选择{type === 'tab' ? '六线谱' : '弹唱谱'}图片</h2><p>支持多页导入，图片内容将原样保留</p><button className="secondary-button">从相册或文件中选择</button>
        </section>
        <div className="photo-tips"><b>导入后只需整理页面</b><span>填写歌曲名称，确认每页页码和顺序，即可保存到谱架</span></div>
        {pages.length > 0 && <section className="selected-pages"><div className="list-section-title"><h2>已选择 {pages.length} 页</h2><button onClick={() => inputRef.current?.click()}>继续添加</button></div><div className="page-thumbnail-grid">{pages.map((page, index) => <div className="page-thumbnail" key={page.id}><img src={page.preview} alt={page.name} /><span>第 {index + 1} 张</span><button aria-label={`移除 ${page.name}`} onClick={(event) => { event.stopPropagation(); setPages((old) => old.filter((item) => item.id !== page.id)); }}><X size={14} /></button></div>)}</div></section>}
        <div className="bottom-action"><button className="primary-button full" disabled={!pages.length} onClick={preparePages}>填写信息与整理页码<ArrowRight size={18} /></button></div>
      </>}

      {step === 2 && <>
        <div className="recognition-banner finished"><span><Check size={20} /></span><div><b>{pages.length} 页图片已就绪</b><p>不会识别、转写或修改图片内容</p></div></div>
        <section className="recognition-meta"><label><span>歌曲名称</span><input autoFocus value={title} onChange={(event) => { titleEdited.current = true; setTitle(event.target.value); }} placeholder="请输入歌曲名称" /></label><label><span>音乐人</span><input value={artist} onChange={(event) => setArtist(event.target.value)} placeholder="选填" /></label></section>
        <section className="review-pages"><div className="list-section-title"><h2>页码与顺序</h2><span>可直接修改页码，或用箭头排序</span></div>{pages.map((page, index) => <article className="review-page" key={page.id}>
          <img src={page.preview} alt={`第${page.pageNumber}页`} />
          <div className="review-page-main"><div className="review-page-title"><b>{page.name}</b><span className="ocr-status done">原图</span></div>
            <label className="page-number-field">页码<input type="number" min="1" value={page.pageNumber} onChange={(event) => patchPage(page.id, { pageNumber: Math.max(1, Number(event.target.value)) })} onBlur={() => setPages((old) => [...old].sort((a, b) => a.pageNumber - b.pageNumber))} /></label>
          </div>
          <div className="page-order-actions"><button disabled={index === 0} onClick={() => movePage(index, -1)} aria-label="上移一页"><ArrowUp size={15} /></button><button disabled={index === pages.length - 1} onClick={() => movePage(index, 1)} aria-label="下移一页"><ArrowDown size={15} /></button><button onClick={() => setPages((old) => old.filter((item) => item.id !== page.id))} aria-label="移除图片"><Trash2 size={15} /></button></div>
        </article>)}</section>
        <div className="ocr-notice"><FileImage size={18} /><p>保存后可直接翻看原始琴谱，支持单页翻页和连续滚动。若页码相同，将保持当前排列顺序。</p></div>
        <div className="bottom-action"><button className="primary-button full" disabled={saving || !pages.length || !title.trim()} onClick={saveImportedScore}><Check size={18} />{saving ? '正在保存…' : '保存到谱架'}</button></div>
      </>}
    </div>
  );
}

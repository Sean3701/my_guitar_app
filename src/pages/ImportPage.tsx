import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Check, ChevronLeft, ChevronRight, FileImage, FileMusic, ImagePlus, Music2, Trash2, X } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import type { ImportPage as ImportPageItem, ScoreType } from '../types';
import { detectPageNumber, detectTitle, emptyScore, uid } from '../lib/score';
import { savePageImages, saveScore } from '../lib/storage';
import { prepareImage } from '../lib/image';

export default function ImportPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  // 类型不再有默认值：进来先让用户自己选，避免把弹唱谱存成六线谱
  const [type, setType] = useState<ScoreType | null>(() => {
    const initial = params.get('type');
    return initial === 'chord' || initial === 'tab' ? initial : null;
  });
  const inputRef = useRef<HTMLInputElement>(null);
  const titleEdited = useRef(false);
  const [step, setStep] = useState(1);
  const [pages, setPages] = useState<ImportPageItem[]>([]);
  const [title, setTitle] = useState('');
  const [artist, setArtist] = useState('');
  const [saving, setSaving] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [notice, setNotice] = useState('');
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  const typeLabel = type === 'tab' ? '六线谱' : type === 'chord' ? '弹唱谱' : '';

  const pickType = (next: ScoreType) => {
    if (next === type) return;
    setType(next);
    setNotice('');
  };

  // 没选类型时不让直接开相册，先把「要导入哪种谱子」这一步问清楚
  const openPicker = () => {
    if (!type) {
      setNotice('请先选择要导入的谱子类型，再添加图片');
      return;
    }
    inputRef.current?.click();
  };

  // 大图查看：Esc 关闭、左右键翻页，打开时锁定背景滚动
  useEffect(() => {
    if (viewerIndex === null) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setViewerIndex(null);
      if (event.key === 'ArrowLeft') setViewerIndex((index) => index === null ? index : Math.max(0, index - 1));
      if (event.key === 'ArrowRight') setViewerIndex((index) => index === null ? index : Math.min(pages.length - 1, index + 1));
    };
    window.addEventListener('keydown', onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = previousOverflow; };
  }, [viewerIndex, pages.length]);

  // 原图是 Blob，转成 object URL 展示，并在关闭/切换时释放
  const viewerUrl = useMemo(() => viewerIndex === null || !pages[viewerIndex] ? null : URL.createObjectURL(pages[viewerIndex].image), [viewerIndex, pages]);
  useEffect(() => () => { if (viewerUrl) URL.revokeObjectURL(viewerUrl); }, [viewerUrl]);

  const addFiles = async (files: File[]) => {
    const images = files.filter((file) => file.type.startsWith('image/'));
    if (!images.length) return;
    setNotice('');
    const additions: ImportPageItem[] = [];
    let failed = 0;
    // 已经用掉的页码不再重复分配，否则后面排序会把新增页插到前面
    const used = new Set(pages.map((page) => page.pageNumber));
    // 逐张压缩，避免多张大图同时解码占满内存
    for (const [index, file] of images.entries()) {
      try {
        const prepared = await prepareImage(file);
        let pageNumber = detectPageNumber(file.name, pages.length + index + 1);
        while (used.has(pageNumber)) pageNumber += 1;
        used.add(pageNumber);
        additions.push({
          id: uid(), image: prepared.image, preview: prepared.preview, name: file.name,
          pageNumber, text: '', status: 'done', progress: 1,
        });
      } catch (error) {
        failed += 1;
        console.error('图片处理失败', file.name, error);
      }
    }
    if (failed) setNotice(`${failed} 张图片无法读取，已跳过`);
    if (!additions.length) return;
    setPages((old) => [...old, ...additions]);
    if (!title && !titleEdited.current) setTitle(detectTitle('', additions[0].name));
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
    if (!type || !title.trim() || !pages.length || saving) return;
    setSaving(true);
    setNotice('');
    const sorted = [...pages].sort((a, b) => a.pageNumber - b.pageNumber);
    try {
      await savePageImages(sorted.map((page) => [page.id, page.image]));
      const score = emptyScore(type, title.trim());
      score.artist = artist.trim();
      score.sections = [];
      score.chordText = '';
      score.sourcePages = sorted.map((page) => ({
        id: page.id, name: page.name, pageNumber: page.pageNumber, text: '', thumbnail: page.preview,
      }));
      await saveScore(score);
      navigate(`/score/${score.id}`, { replace: true });
    } catch (error) {
      console.error('保存琴谱失败', error);
      setNotice('保存失败：本地存储空间可能不足，请减少页数后重试。');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="page import-page">
      <header className="sub-header"><button className="icon-button" aria-label="返回" onClick={() => step > 1 ? setStep(step - 1) : navigate('/')}><ArrowLeft size={21} /></button><div><h1>导入琴谱图片</h1><p>先选谱子类型，再添加原图</p></div><span className="header-spacer" /></header>
      <div className="stepper">
        {[['1', '类型与图片'], ['2', '信息与页码']].map(([number, label], index) => <div key={number} className={`${step === index + 1 ? 'active' : ''} ${step > index + 1 ? 'complete' : ''}`}><span>{step > index + 1 ? <Check size={14} /> : number}</span><b>{label}</b>{index < 1 && <i />}</div>)}
      </div>
      {notice && <p className="import-notice">{notice}</p>}

      {step === 1 && <>
        <section className="type-choice" role="radiogroup" aria-label="谱子类型">
          <button type="button" role="radio" aria-checked={type === 'tab'} className={`type-choice-card ${type === 'tab' ? 'selected' : ''}`} onClick={() => pickType('tab')}>
            <span className="type-choice-icon"><FileMusic size={20} /></span>
            <b>六线谱</b>
            <small>六条线记指法，导入后按原图看谱</small>
          </button>
          <button type="button" role="radio" aria-checked={type === 'chord'} className={`type-choice-card ${type === 'chord' ? 'selected' : ''}`} onClick={() => pickType('chord')}>
            <span className="type-choice-icon chord"><Music2 size={20} /></span>
            <b>弹唱谱</b>
            <small>和弦配歌词，同样先看原图</small>
          </button>
        </section>
        <section className={`upload-zone ${dragging ? 'dragging' : ''} ${type ? '' : 'locked'}`} onDragOver={(event) => { event.preventDefault(); if (type) setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={(event) => { event.preventDefault(); setDragging(false); if (!type) { setNotice('请先选择要导入的谱子类型，再添加图片'); return; } addFiles([...event.dataTransfer.files]); }} onClick={openPicker}>
          <input ref={inputRef} type="file" accept="image/*" multiple hidden onChange={(event) => { addFiles([...(event.target.files || [])]); event.target.value = ''; }} />
          <span className="upload-illustration"><ImagePlus size={30} /><i /><i /><i /></span>
          <h2>{type ? `选择${typeLabel}图片` : '先选择上方的谱子类型'}</h2><p>{type ? '支持多页导入，图片内容将原样保留' : '六线谱和弹唱谱的看谱方式不同，选好再添加图片'}</p><button className="secondary-button" disabled={!type}>从相册或文件中选择</button>
        </section>
        <div className="photo-tips"><b>导入后只需整理页面</b><span>填写歌曲名称，确认每页页码和顺序，即可保存到谱架</span></div>
        {pages.length > 0 && <section className="selected-pages"><div className="list-section-title"><h2>已选择 {pages.length} 页</h2><button onClick={() => inputRef.current?.click()}>继续添加</button></div><div className="page-thumbnail-grid">{pages.map((page, index) => <div className="page-thumbnail" key={page.id}><img src={page.preview} alt={page.name} /><span>第 {index + 1} 张</span><button aria-label={`移除 ${page.name}`} onClick={(event) => { event.stopPropagation(); setPages((old) => old.filter((item) => item.id !== page.id)); }}><X size={14} /></button></div>)}</div></section>}
        <div className="bottom-action"><button className="primary-button full" disabled={!pages.length} onClick={preparePages}>填写信息与整理页码<ArrowRight size={18} /></button></div>
      </>}

      {step === 2 && <>
        <div className="recognition-banner finished"><span><Check size={20} /></span><div><b>{pages.length} 页{typeLabel}图片已就绪</b><p>不会识别、转写或修改图片内容</p></div><button type="button" className="banner-edit" onClick={() => setStep(1)}>改类型</button></div>
        <section className="recognition-meta"><label><span>歌曲名称</span><input autoFocus value={title} onChange={(event) => { titleEdited.current = true; setTitle(event.target.value); }} placeholder="请输入歌曲名称" /></label><label><span>音乐人</span><input value={artist} onChange={(event) => setArtist(event.target.value)} placeholder="选填" /></label></section>
        <section className="review-pages"><div className="list-section-title"><h2>页码与顺序</h2><span>可直接修改页码，或用箭头排序</span></div>{pages.map((page, index) => <article className="review-page" key={page.id}>
          <button type="button" className="review-page-img" onClick={() => setViewerIndex(index)} aria-label={`查看第${page.pageNumber}页大图`}>
            <img src={page.preview} alt={`第${page.pageNumber}页`} />
          </button>
          <div className="review-page-main"><div className="review-page-title"><b>{page.name}</b><span className="ocr-status done">原图</span></div>
            <label className="page-number-field">页码<input type="number" min="1" value={page.pageNumber} onChange={(event) => patchPage(page.id, { pageNumber: Math.max(1, Number(event.target.value)) })} onBlur={() => setPages((old) => [...old].sort((a, b) => a.pageNumber - b.pageNumber))} /></label>
          </div>
          <div className="page-order-actions"><button disabled={index === 0} onClick={() => movePage(index, -1)} aria-label="上移一页"><ArrowUp size={15} /></button><button disabled={index === pages.length - 1} onClick={() => movePage(index, 1)} aria-label="下移一页"><ArrowDown size={15} /></button><button onClick={() => setPages((old) => old.filter((item) => item.id !== page.id))} aria-label="移除图片"><Trash2 size={15} /></button></div>
        </article>)}</section>
        <div className="ocr-notice"><FileImage size={18} /><p>保存后可直接翻看原始琴谱，支持单页翻页和连续滚动。若页码相同，将保持当前排列顺序。</p></div>
        <div className="bottom-action"><button className="primary-button full" disabled={saving || !pages.length || !title.trim() || !type} onClick={saveImportedScore}><Check size={18} />{saving ? '正在保存…' : '保存到谱架'}</button></div>
      </>}

      {viewerIndex !== null && pages[viewerIndex] && (
        <div className="img-viewer" role="dialog" aria-modal="true" aria-label="查看大图" onClick={() => setViewerIndex(null)}>
          <button type="button" className="img-viewer-close" aria-label="关闭大图" onClick={() => setViewerIndex(null)}><X size={20} /></button>
          <img src={viewerUrl ?? undefined} alt={`第${pages[viewerIndex].pageNumber}页原图`} onClick={(event) => event.stopPropagation()} />
          <div className="img-viewer-bar" onClick={(event) => event.stopPropagation()}>
            <button type="button" disabled={viewerIndex === 0} onClick={() => setViewerIndex(viewerIndex - 1)} aria-label="上一张"><ChevronLeft size={20} /></button>
            <span>{viewerIndex + 1} / {pages.length}</span>
            <button type="button" disabled={viewerIndex === pages.length - 1} onClick={() => setViewerIndex(viewerIndex + 1)} aria-label="下一张"><ChevronRight size={20} /></button>
          </div>
        </div>
      )}
    </div>
  );
}

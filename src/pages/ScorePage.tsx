import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ChevronLeft, ChevronRight, Edit3, FileImage, FileText, Heart, ImageOff, MoreHorizontal, Play, ScanText, Trash2, X } from 'lucide-react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import type { Score } from '../types';
import { deleteScore, getPageImages, getScores, saveScore } from '../lib/storage';
import { usePageImages } from '../hooks/usePageImages';
import { disposeOcr, recognizeChords } from '../lib/chordOcr';
import ChordSheet from '../components/ChordSheet';
import ChordDetailSheet from '../components/ChordDetailSheet';
import UsedChordStrip from '../components/UsedChordStrip';
import ScoreEditor from '../components/ScoreEditor';
import ZoomableScore from '../components/ZoomableScore';

export default function ScorePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [score, setScore] = useState<Score | null>(null);
  const [editing, setEditing] = useState(false);
  // 用户手动切换过的看谱方式；为空时按「有原图就先看原图」推导，避免首帧闪一下格式谱
  const [modeOverride, setModeOverride] = useState<'formatted' | 'original' | null>(null);
  const [selectedChord, setSelectedChord] = useState('C');
  const [detailChord, setDetailChord] = useState<{ name: string; count: number } | null>(null);
  const [pageIndex, setPageIndex] = useState(0);
  const [originalLayout, setOriginalLayout] = useState<'paged' | 'scroll'>(() => localStorage.getItem('shipu-original-layout') === 'paged' ? 'paged' : 'scroll');
  const [menuOpen, setMenuOpen] = useState(false);
  const [visiblePage, setVisiblePage] = useState(0);
  const [zooming, setZooming] = useState(false);
  const [ocrStatus, setOcrStatus] = useState<string | null>(null);
  const viewParam = searchParams.get('view');

  useEffect(() => { getScores().then((scores) => setScore(scores.find((item) => item.id === id) || null)); }, [id]);
  useEffect(() => { setPageIndex(0); setModeOverride(null); }, [score?.id]);

  // 六线谱没有格式谱；弹唱谱有和弦文本时可以先看原图、再切到格式谱对照
  const hasFormattedScore = score?.type === 'chord' && Boolean(score.chordText.trim());
  const hasSourcePages = (score?.sourcePages.length ?? 0) > 0;
  // 两种谱子都先落在导入的原图上，只有明确要看格式谱、或这份谱子压根没有原图时才用格式谱
  const defaultMode: 'formatted' | 'original' = viewParam === 'formatted' && hasFormattedScore
    ? 'formatted'
    : hasSourcePages ? 'original' : 'formatted';
  const mode = modeOverride ?? defaultMode;
  const setMode = (next: 'formatted' | 'original') => setModeOverride(next);

  const pageIds = useMemo(() => {
    if (!score) return [];
    if (originalLayout === 'scroll') return score.sourcePages.map((page) => page.id);
    const current = score.sourcePages[pageIndex];
    return current ? [current.id] : [];
  }, [score, originalLayout, pageIndex]);
  const pageUrls = usePageImages(pageIds);
  const showOriginal = hasSourcePages && mode === 'original';

  // 这份谱子里出现的和弦：弹唱谱取和弦文本，图片谱取识别出的原谱文字，
  // 两种来源都不用手动挑，扫描一遍就是「本谱和弦」
  const chordSourceText = useMemo(
    () => [score?.chordText ?? '', ...(score?.sourcePages.map((page) => page.text) ?? [])].filter(Boolean).join('\n'),
    [score],
  );

  // 滚动模式下用屏幕中线判断当前看到第几页，省掉压在谱面上的页码标签
  useEffect(() => {
    if (originalLayout !== 'scroll' || !showOriginal) return;
    const nodes = Array.from(document.querySelectorAll<HTMLElement>('.original-scroll-page'));
    if (!nodes.length) return;
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const index = nodes.indexOf(entry.target as HTMLElement);
        if (index >= 0) setVisiblePage(index);
      }
    }, { rootMargin: '-47% 0px -48% 0px' });
    nodes.forEach((node) => observer.observe(node));
    return () => observer.disconnect();
  }, [originalLayout, showOriginal, score?.sourcePages.length]);

  if (!score) return <div className="loading-state page"><span className="loading-ring" />正在翻开琴谱…</div>;

  const currentPage = score.sourcePages[pageIndex];
  const currentPageUrl = currentPage ? pageUrls[currentPage.id] : undefined;

  const toggleFavorite = async () => {
    const next = { ...score, favorite: !score.favorite };
    setScore(next); await saveScore(next);
  };
  const remove = async () => {
    if (!window.confirm(`确定删除《${score.title}》吗？此操作无法撤销。`)) return;
    await deleteScore(score.id); navigate('/');
  };
  const updateScore = async (next: Score) => { await saveScore(next); setScore(next); setEditing(false); };
  const changeOriginalLayout = (layout: 'paged' | 'scroll') => {
    setOriginalLayout(layout);
    setZooming(false);
    localStorage.setItem('shipu-original-layout', layout);
  };

  // 重新识别全部页的和弦：在本地跑 OCR，把结果写回琴谱。
  // 已有识别文本的页也会重跑——识别算法升级后，老谱子靠这个按钮就能跟上
  const recognizeMissingPages = async () => {
    if (!score || ocrStatus) return;
    const targets = score.sourcePages;
    if (!targets.length) return;
    setOcrStatus('准备识别…');
    try {
      const images = await getPageImages(targets.map((page) => page.id));
      const nextPages = [...score.sourcePages];
      for (const [index, target] of targets.entries()) {
        const blob = images[target.id];
        if (!blob) continue;
        const result = await recognizeChords(blob, (ratio) => setOcrStatus(`第 ${index + 1} 页 ${Math.round(ratio * 100)}%`));
        const pageIndex = nextPages.findIndex((page) => page.id === target.id);
        if (pageIndex >= 0) nextPages[pageIndex] = { ...nextPages[pageIndex], text: result.text };
      }
      await updateScore({ ...score, sourcePages: nextPages });
    } catch (error) {
      console.error('识别和弦失败', error);
    } finally {
      setOcrStatus(null);
      void disposeOcr();
    }
  };

  // 弹唱谱的「本谱和弦」条：原图模式下也要有，格式谱模式下放在和弦文本上方
  const chordStrip = (place: 'above' | 'below') => (
    <UsedChordStrip
      key={place}
      text={chordSourceText}
      selected={selectedChord}
      onSelect={setSelectedChord}
      onOpen={(name, count) => setDetailChord({ name, count })}
    />
  );

  return (
    <div className="score-page">
      <header className="score-header"><button className="icon-button" aria-label={editing ? '关闭编辑' : '返回首页'} onClick={() => editing ? setEditing(false) : navigate('/')}>{editing ? <X size={21} /> : <ArrowLeft size={21} />}</button><div><h1>{score.title}</h1><p>{score.artist || '未知音乐人'}</p></div><button className={`icon-button ${score.favorite ? 'favorite' : ''}`} onClick={toggleFavorite}><Heart size={20} fill={score.favorite ? 'currentColor' : 'none'} /></button><div className="more-wrap"><button className="icon-button" onClick={() => setMenuOpen(!menuOpen)}><MoreHorizontal size={22} /></button>{menuOpen && <div className="more-menu">{hasFormattedScore && <button onClick={() => { setEditing(true); setMenuOpen(false); }}><Edit3 size={16} />编辑琴谱</button>}<button className="danger" onClick={remove}><Trash2 size={16} />删除琴谱</button></div>}</div></header>
      {editing ? <div className="page embedded-editor"><ScoreEditor initialScore={score} onSave={updateScore} /></div> : <>
        <div className="score-content page">
          {hasFormattedScore ? <div className="score-properties"><button><b>{score.musicalKey} 调</b><span>{score.capo ? `夹 ${score.capo} 品` : '原调指法'}</span></button><i /><button><b>{score.bpm}</b><span>拍速 · {score.timeSignature}</span></button><i /><button><b>{score.type === 'tab' ? '六线谱' : '弹唱谱'}</b><span>{score.sample ? '示例' : '我的琴谱'}</span></button>{score.sourcePages.length > 0 && <button className={`original-toggle ${mode === 'original' ? 'active' : ''}`} onClick={() => setMode(mode === 'original' ? 'formatted' : 'original')}>{mode === 'original' ? <FileText size={17} /> : <FileImage size={17} />}{mode === 'original' ? '看格式谱' : '看原图'}</button>}</div> : <div className="image-score-summary"><FileImage size={18} /><span>{score.type === 'tab' ? '六线谱' : '弹唱谱'}原始图片</span><b>{score.sourcePages.length ? `共 ${score.sourcePages.length} 页` : '暂无原图'}</b>{score.type === 'chord' && score.sourcePages.length > 0 && <button className="summary-action" onClick={recognizeMissingPages} disabled={Boolean(ocrStatus)}>{ocrStatus ? `${ocrStatus}…` : <><ScanText size={13} />{score.sourcePages.some((page) => page.text) ? '重新识别' : '识别和弦'}</>}</button>}</div>}

          {showOriginal ? <>
            {/* 滚动模式把和弦条钉在上方：读到哪儿都能看到指法；单页模式放原图下方 */}
            {score.type === 'chord' && originalLayout === 'scroll' && chordStrip('above')}
            <div className={`original-viewer ${originalLayout}`}>
            <div className="original-toolbar">
              <div className="original-view-mode" aria-label="原图查看模式">
                <button className={originalLayout === 'scroll' ? 'active' : ''} onClick={() => changeOriginalLayout('scroll')}>滚动看图</button>
                <button className={originalLayout === 'paged' ? 'active' : ''} onClick={() => changeOriginalLayout('paged')}>单页翻页</button>
              </div>
              {zooming
                ? <span className="original-page-count">双击还原</span>
                : originalLayout === 'scroll'
                  ? <span className="original-page-count">{Math.min(visiblePage + 1, score.sourcePages.length)} / {score.sourcePages.length}</span>
                  : <span className="original-page-count">双击放大</span>}
            </div>
            {originalLayout === 'paged' ? <>
              {currentPageUrl
                ? <ZoomableScore key={currentPage?.id} src={currentPageUrl} alt={`原谱第${pageIndex + 1}页`} eager onZoomChange={setZooming} onSwipe={(direction) => setPageIndex((index) => Math.max(0, Math.min(score.sourcePages.length - 1, index + direction)))} />
                : <div className="original-placeholder"><span className="loading-ring" />正在打开第 {pageIndex + 1} 页…</div>}
              <div className="original-page-controls"><button disabled={pageIndex === 0} onClick={() => setPageIndex(pageIndex - 1)}><ChevronLeft size={18} /></button><span>{pageIndex + 1} / {score.sourcePages.length}</span><button disabled={pageIndex === score.sourcePages.length - 1} onClick={() => setPageIndex(pageIndex + 1)}><ChevronRight size={18} /></button></div>
            </> : <div className="original-scroll-pages">{score.sourcePages.map((page, index) => <figure className="original-scroll-page" key={page.id}>{pageUrls[page.id] ? <ZoomableScore src={pageUrls[page.id]} alt={`原谱第${page.pageNumber}页`} eager={index === 0} onZoomChange={setZooming} /> : <div className="original-placeholder"><span className="loading-ring" />正在打开第 {page.pageNumber} 页…</div>}</figure>)}</div>}
            </div>
            {/* 单页翻页：和弦条放在这一页原图的下方 */}
            {score.type === 'chord' && originalLayout === 'paged' && chordStrip('below')}
          </> : hasFormattedScore ? <>
            <UsedChordStrip
              text={chordSourceText}
              selected={selectedChord}
              onSelect={setSelectedChord}
              onOpen={(name, count) => setDetailChord({ name, count })}
            />
            <ChordSheet text={score.chordText} onChordClick={setSelectedChord} selectedChord={selectedChord} />
          </> : <div className="empty-image-state"><ImageOff size={30} /><h3>这份琴谱还没有原图</h3><p>重新导入谱子图片后，就能在这里翻看原谱。</p></div>}
          {hasFormattedScore && mode === 'formatted' && <div className="playback-preview"><span className="play-icon"><Play size={20} fill="currentColor" /></span><div><b>自动弹奏与实时跟谱</b><p>播放引擎和位置指示器将在下一版接入</p></div><span>已预留</span></div>}
        </div>
        <div className="score-bottom-bar">{hasFormattedScore && <button onClick={() => setEditing(true)}><Edit3 size={18} />编辑</button>}<button onClick={toggleFavorite} className={score.favorite ? 'favorite' : ''}><Heart size={18} fill={score.favorite ? 'currentColor' : 'none'} />收藏</button>{hasFormattedScore && hasSourcePages ? <button className="primary-button" onClick={() => setMode(mode === 'original' ? 'formatted' : 'original')}>{mode === 'original' ? <FileText size={18} /> : <FileImage size={18} />}{mode === 'original' ? '看格式谱' : '对照原谱'}</button> : <button className="primary-button" onClick={() => navigate('/')}><ArrowLeft size={18} />返回谱架</button>}</div>
      </>}
      {detailChord && <ChordDetailSheet name={detailChord.name} count={detailChord.count} onClose={() => setDetailChord(null)} />}
    </div>
  );
}

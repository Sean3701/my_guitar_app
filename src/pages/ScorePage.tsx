import { useEffect, useState } from 'react';
import { ArrowLeft, ChevronLeft, ChevronRight, Edit3, FileImage, Heart, MoreHorizontal, Play, Trash2, X } from 'lucide-react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import type { Score } from '../types';
import { deleteScore, getScores, saveScore } from '../lib/storage';
import ChordDiagram from '../components/ChordDiagram';
import ChordSheet from '../components/ChordSheet';
import TabStaff from '../components/TabStaff';
import ScoreEditor from '../components/ScoreEditor';

export default function ScorePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [score, setScore] = useState<Score | null>(null);
  const [editing, setEditing] = useState(false);
  const [mode, setMode] = useState<'formatted' | 'original'>(searchParams.get('view') === 'original' ? 'original' : 'formatted');
  const [selectedChord, setSelectedChord] = useState('C');
  const [pageIndex, setPageIndex] = useState(0);
  const [originalLayout, setOriginalLayout] = useState<'paged' | 'scroll'>(() => localStorage.getItem('shipu-original-layout') === 'scroll' ? 'scroll' : 'paged');
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => { getScores().then((scores) => setScore(scores.find((item) => item.id === id) || null)); }, [id]);
  if (!score) return <div className="loading-state page"><span className="loading-ring" />正在翻开琴谱…</div>;

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
    localStorage.setItem('shipu-original-layout', layout);
  };

  return (
    <div className="score-page">
      <header className="score-header"><button className="icon-button" onClick={() => editing ? setEditing(false) : navigate(-1)}>{editing ? <X size={21} /> : <ArrowLeft size={21} />}</button><div><h1>{score.title}</h1><p>{score.artist || '未知音乐人'}</p></div><button className={`icon-button ${score.favorite ? 'favorite' : ''}`} onClick={toggleFavorite}><Heart size={20} fill={score.favorite ? 'currentColor' : 'none'} /></button><div className="more-wrap"><button className="icon-button" onClick={() => setMenuOpen(!menuOpen)}><MoreHorizontal size={22} /></button>{menuOpen && <div className="more-menu"><button onClick={() => { setEditing(true); setMenuOpen(false); }}><Edit3 size={16} />编辑琴谱</button><button className="danger" onClick={remove}><Trash2 size={16} />删除琴谱</button></div>}</div></header>
      {editing ? <div className="page embedded-editor"><ScoreEditor initialScore={score} onSave={updateScore} /></div> : <>
        <div className="score-content page">
          <div className="score-properties"><button><b>{score.musicalKey} 调</b><span>{score.capo ? `夹 ${score.capo} 品` : '原调指法'}</span></button><i /><button><b>{score.bpm}</b><span>拍速 · {score.timeSignature}</span></button><i /><button><b>{score.type === 'tab' ? '六线谱' : '弹唱谱'}</b><span>{score.sample ? '示例' : '我的琴谱'}</span></button>{score.sourcePages.length > 0 && <button className={`original-toggle ${mode === 'original' ? 'active' : ''}`} onClick={() => setMode(mode === 'original' ? 'formatted' : 'original')}><FileImage size={17} />{mode === 'original' ? '看格式谱' : '看原图'}</button>}</div>

          {mode === 'original' && score.sourcePages.length ? <div className={`original-viewer ${originalLayout}`}>
            <div className="original-view-mode" aria-label="原图查看模式">
              <button className={originalLayout === 'paged' ? 'active' : ''} onClick={() => changeOriginalLayout('paged')}>单页翻页</button>
              <button className={originalLayout === 'scroll' ? 'active' : ''} onClick={() => changeOriginalLayout('scroll')}>滚动看图</button>
            </div>
            {originalLayout === 'paged' ? <>
              <img className="original-paged-image" src={score.sourcePages[pageIndex]?.dataUrl} alt={`原谱第${pageIndex + 1}页`} />
              <div className="original-page-controls"><button disabled={pageIndex === 0} onClick={() => setPageIndex(pageIndex - 1)}><ChevronLeft size={18} /></button><span>{pageIndex + 1} / {score.sourcePages.length}</span><button disabled={pageIndex === score.sourcePages.length - 1} onClick={() => setPageIndex(pageIndex + 1)}><ChevronRight size={18} /></button></div>
            </> : <div className="original-scroll-pages">{score.sourcePages.map((page, index) => <figure className="original-scroll-page" key={page.id}><img src={page.dataUrl} alt={`原谱第${page.pageNumber}页`} loading={index === 0 ? 'eager' : 'lazy'} /><figcaption>第 {page.pageNumber} 页</figcaption></figure>)}</div>}
          </div> : <>
            {score.type === 'chord' && <div className="selected-chord-panel"><div><span>和弦指法</span><b>{selectedChord}</b><small>点击谱中和弦可切换</small></div><ChordDiagram name={selectedChord} showName={false} /></div>}
            {score.type === 'tab' ? <TabStaff sections={score.sections} onChordClick={setSelectedChord} /> : <ChordSheet text={score.chordText} onChordClick={setSelectedChord} selectedChord={selectedChord} />}
          </>}
          {score.type === 'tab' && mode === 'formatted' && <div className="tab-chord-dock"><span>当前和弦</span><ChordDiagram name={selectedChord} compact /><small>点击谱上和弦图可切换</small></div>}
          <div className="playback-preview"><span className="play-icon"><Play size={20} fill="currentColor" /></span><div><b>自动弹奏与实时跟谱</b><p>播放引擎和位置指示器将在下一版接入</p></div><span>已预留</span></div>
        </div>
        <div className="score-bottom-bar"><button onClick={() => setEditing(true)}><Edit3 size={18} />编辑</button><button onClick={toggleFavorite} className={score.favorite ? 'favorite' : ''}><Heart size={18} fill={score.favorite ? 'currentColor' : 'none'} />收藏</button><button className="primary-button" onClick={() => setMode(mode === 'original' ? 'formatted' : 'original')} disabled={!score.sourcePages.length}><FileImage size={18} />{mode === 'original' ? '返回琴谱' : '对照原谱'}</button></div>
      </>}
    </div>
  );
}

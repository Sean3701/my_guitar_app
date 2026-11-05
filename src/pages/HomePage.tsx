import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, FileImage, FileMusic, Guitar, Heart, ImagePlus, Music2, Search, SlidersHorizontal, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { getScores } from '../lib/storage';
import { formatDate } from '../lib/score';
import type { Score, ScoreType } from '../types';

type Filter = 'all' | ScoreType | 'favorite';

// 六线谱只保留导入的原图；弹唱谱没有文本时同样是原图模式
const isImageOnly = (score: Score) => score.sourcePages.length > 0 && (score.type === 'tab' || !score.chordText.trim());

export default function HomePage() {
  const navigate = useNavigate();
  const [scores, setScores] = useState<Score[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);

  useEffect(() => { getScores().then(setScores).finally(() => setLoading(false)); }, []);

  const filtered = useMemo(() => scores.filter((score) => {
    const typeMatch = filter === 'all' || (filter === 'favorite' ? score.favorite : score.type === filter);
    const queryMatch = !query || `${score.title}${score.artist}`.toLowerCase().includes(query.toLowerCase());
    return typeMatch && queryMatch;
  }), [scores, filter, query]);

  return (
    <div className="page home-page">
      <header className="home-header">
        <div className="mobile-brand"><span className="brand-mark"><Guitar size={22} /></span><b>拾谱</b></div>
        <div className="home-greeting"><span>我的琴谱</span><h1>今天，想弹哪一首？</h1></div>
        <button className="icon-button search-trigger" onClick={() => setSearchOpen(!searchOpen)} aria-label="搜索"><Search size={21} /></button>
      </header>
      {searchOpen && <div className="search-box"><Search size={18} /><input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索歌名或音乐人" /><button onClick={() => { setQuery(''); setSearchOpen(false); }}><X size={17} /></button></div>}

      <section className="import-shortcuts">
        <button onClick={() => navigate('/import?type=tab')}>
          <span className="shortcut-icon tab-icon"><FileMusic size={24} /></span>
          <span><b>导入六线谱</b><small>多页原图导入，按页码整理</small></span>
          <ArrowRight size={18} />
        </button>
        <button onClick={() => navigate('/import?type=chord')}>
          <span className="shortcut-icon chord-icon"><ImagePlus size={24} /></span>
          <span><b>导入弹唱谱</b><small>保留原始图片，清晰翻看</small></span>
          <ArrowRight size={18} />
        </button>
      </section>

      <div className="library-heading"><div><h2>谱架</h2><span>{scores.length} 份琴谱</span></div><button aria-label="筛选"><SlidersHorizontal size={18} /></button></div>
      <div className="filter-tabs">
        {([['all', '全部'], ['tab', '六线谱'], ['chord', '弹唱谱'], ['favorite', '收藏']] as [Filter, string][]).map(([value, label]) => (
          <button key={value} onClick={() => setFilter(value)} className={filter === value ? 'active' : ''}>{label}</button>
        ))}
      </div>

      {loading ? <div className="loading-state"><span className="loading-ring" />正在整理谱架…</div> : (
        <div className="score-list">
          {filtered.map((score) => (
            <article className="score-card" key={score.id} onClick={() => navigate(`/score/${score.id}${isImageOnly(score) ? '?view=original' : ''}`)}>
              <div className={`score-cover ${score.type}`}>
                {score.type === 'tab' ? <div className="mini-tab">{Array.from({ length: 6 }, (_, index) => <i key={index} />)}<b>3</b><b>0</b><b>×</b></div> : <div className="mini-chords"><span>C</span><span>G</span><span>Am</span><i /><i /></div>}
                <span className="score-type-badge">{score.type === 'tab' ? '六线谱' : '弹唱谱'}</span>
              </div>
              <div className="score-info">
                <div className="score-title-row"><h3>{score.title}</h3>{score.favorite && <Heart size={14} fill="currentColor" />}</div>
                <p>{score.artist || '未知音乐人'}</p>
                <div className="score-meta">{isImageOnly(score) ? <><span>原始图片</span><i /><span>共 {score.sourcePages.length} 页</span></> : <><span>{score.musicalKey} 调</span><i />{score.capo > 0 ? <span>变调夹 {score.capo} 品</span> : <span>无需变调夹</span>}<i /><span>♩ {score.bpm}</span></>}</div>
                <div className="score-card-foot"><small>{score.sample ? '示例琴谱' : `更新于 ${formatDate(score.updatedAt)}`}</small></div>
                {score.sourcePages.length > 0 && !isImageOnly(score) && <div className="score-entry-actions"><button onClick={(event) => { event.stopPropagation(); navigate(`/score/${score.id}?view=original`); }}><FileImage size={15} />查看原图</button></div>}
              </div>
              <ArrowRight className="card-arrow" size={18} aria-hidden />
            </article>
          ))}
          {!filtered.length && <div className="empty-state"><Music2 size={34} /><h3>这里还没有琴谱</h3><p>导入几张清晰的琴谱照片，开始整理吧。</p><button className="primary-button" onClick={() => navigate('/import')}>导入第一份琴谱</button></div>}
        </div>
      )}
      <p className="local-note">琴谱保存在本机，离线也能翻看</p>
    </div>
  );
}

import { useMemo, useState } from 'react';
import { Search, X } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import ChordDiagram from '../components/ChordDiagram';
import ChordDetailSheet from '../components/ChordDetailSheet';
import { CHORD_GROUPS, CHORD_LIST, ROOTS, positionLabel, type ChordGroup } from '../data/chords';

type CategoryKey = 'all' | 'major' | 'minor' | 'seven' | 'color' | 'other';

const CATEGORIES: { key: CategoryKey; label: string; groups: ChordGroup[] | null }[] = [
  { key: 'all', label: '全部', groups: null },
  { key: 'major', label: '大三', groups: ['major'] },
  { key: 'minor', label: '小三', groups: ['minor'] },
  { key: 'seven', label: '七和弦', groups: ['dom7', 'maj7', 'm7', 'nine'] },
  { key: 'color', label: '挂留加音', groups: ['sus', 'add', 'six'] },
  { key: 'other', label: '其他', groups: ['dim', 'power', 'slash'] },
];

export default function ChordsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [category, setCategory] = useState<CategoryKey>('all');
  const [root, setRoot] = useState<string>('all');
  const [query, setQuery] = useState('');
  // 支持 /chords?chord=Am 直接打开某个和弦，方便从别处跳过来
  const detail = searchParams.get('chord');
  const openDetail = (name: string) => setSearchParams(name ? { chord: name } : {}, { replace: true });

  const keyword = query.trim().toLowerCase().replace(/\s/g, '');

  const sections = useMemo(() => {
    const groups = CATEGORIES.find((item) => item.key === category)?.groups ?? null;
    return CHORD_GROUPS
      .filter((group) => !groups || groups.includes(group.key))
      .map((group) => ({
        ...group,
        items: CHORD_LIST.filter((chord) => chord.group === group.key
          && (root === 'all' || chord.root === root)
          && (!keyword || chord.name.toLowerCase().includes(keyword))),
      }))
      .filter((section) => section.items.length > 0);
  }, [category, root, keyword]);

  const total = sections.reduce((sum, section) => sum + section.items.length, 0);

  return (
    <div className="page chords-page">
      <header className="chords-header">
        <span className="eyebrow">和弦库</span>
        <h1>常用和弦指法</h1>
        <p>{CHORD_LIST.length} 个把位 · 点开看按弦位置和组成音，也能试听扫弦</p>
      </header>

      <div className="chords-search">
        <Search size={17} />
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜和弦，例如 Am、F#m7、Cadd9" aria-label="搜索和弦" />
        {query && <button onClick={() => setQuery('')} aria-label="清空搜索"><X size={16} /></button>}
      </div>

      <div className="filter-tabs chord-categories">
        {CATEGORIES.map((item) => (
          <button key={item.key} className={category === item.key ? 'active' : ''} onClick={() => setCategory(item.key)}>{item.label}</button>
        ))}
      </div>

      <div className="root-chips" role="group" aria-label="按根音筛选">
        <button className={root === 'all' ? 'active' : ''} onClick={() => setRoot('all')}>全部调</button>
        {ROOTS.map((note) => (
          <button key={note} className={root === note ? 'active' : ''} onClick={() => setRoot(note)}>{note}</button>
        ))}
      </div>

      {total === 0 ? (
        <div className="empty-state">
          <Search size={30} />
          <h3>没有找到这个和弦</h3>
          <p>试试只输入根音，比如输入 A 就能看到所有 A 开头的和弦。</p>
          <button className="secondary-button" onClick={() => { setQuery(''); setRoot('all'); setCategory('all'); }}>清空筛选</button>
        </div>
      ) : (
        <div className="chord-sections">
          {sections.map((section) => (
            <section className="chord-section" key={section.key}>
              <div className="section-heading">
                <span>{section.label}</span>
                <small>{section.items.length} 个</small>
                <i />
                <em>{section.hint}</em>
              </div>
              <div className="chord-grid">
                {section.items.map((chord) => (
                  <button className="chord-card" key={chord.name} onClick={() => openDetail(chord.name)} aria-label={`${chord.name} 和弦指法`}>
                    <ChordDiagram name={chord.name} showName={false} width={96} />
                    <b>{chord.name}</b>
                    <small>{positionLabel(chord)}</small>
                  </button>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      <div className="chord-library-legend">
        <span><i>○</i> 空弦</span>
        <span><i>×</i> 不弹</span>
        <span><i>1-4</i> 按弦手指</span>
        <span><i>▬</i> 琴枕</span>
      </div>

      {detail && <ChordDetailSheet name={detail} onClose={() => openDetail('')} />}
    </div>
  );
}

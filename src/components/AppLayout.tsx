import { Guitar, House, Import, LayoutGrid, Music2 } from 'lucide-react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';

export default function AppLayout() {
  const location = useLocation();
  const isDetail = location.pathname.startsWith('/score/');
  return (
    <div className="app-shell">
      <aside className="desktop-rail">
        <NavLink to="/" className="brand">
          <span className="brand-mark"><Guitar size={23} /></span>
          <span><b>拾谱</b><small>把喜欢的歌，慢慢弹会</small></span>
        </NavLink>
        <nav className="rail-nav">
          <NavLink to="/"><House size={20} /><span>我的琴谱</span></NavLink>
          <NavLink to="/import"><Import size={20} /><span>导入琴谱</span></NavLink>
          <NavLink to="/chords"><LayoutGrid size={20} /><span>和弦库</span></NavLink>
          <NavLink to="/tuner"><Music2 size={20} /><span>吉他调音器</span></NavLink>
        </nav>
        <div className="rail-foot"><span className="status-dot" />曲谱仅保存在这台设备</div>
      </aside>
      <main className="app-main"><Outlet /></main>
      {!isDetail && (
        <nav className="bottom-nav">
          <NavLink to="/" className={({ isActive }) => isActive ? 'active' : ''}><House size={21} /><span>琴谱</span></NavLink>
          <NavLink to="/import" className={({ isActive }) => `import-nav ${isActive ? 'active' : ''}`}><span className="import-chip"><Import size={20} /></span><span>导入</span></NavLink>
          <NavLink to="/chords" className={({ isActive }) => isActive ? 'active' : ''}><LayoutGrid size={21} /><span>和弦库</span></NavLink>
          <NavLink to="/tuner" className={({ isActive }) => isActive ? 'active' : ''}><Music2 size={21} /><span>调音器</span></NavLink>
        </nav>
      )}
    </div>
  );
}

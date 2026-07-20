import { NavLink } from 'react-router-dom';

const tabs = [
  { to: '/', ico: '🏠', label: 'Trang chủ' },
  { to: '/scan', ico: '📷', label: 'Quét vở' },
  { to: '/progress', ico: '📊', label: 'Tiến độ' },
  { to: '/rewards', ico: '🏆', label: 'Phần thưởng' },
];

export default function BottomNav() {
  return (
    <nav className="bottom-nav">
      {tabs.map((t) => (
        <NavLink key={t.to} to={t.to} end={t.to === '/'}
          className={({ isActive }) => (isActive ? 'active' : '')}>
          <span className="ico">{t.ico}</span>
          <span>{t.label}</span>
        </NavLink>
      ))}
    </nav>
  );
}

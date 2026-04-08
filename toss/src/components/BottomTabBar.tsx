import type { ReactElement } from 'react';
import { NavLink } from 'react-router-dom';

const tabs = [
  { to: '/', label: '홈', end: true },
  { to: '/history', label: '기록', end: false },
  { to: '/settings', label: '설정', end: false },
] as const;

export function BottomTabBar(): ReactElement {
  return (
    <nav className="tabbar">
      {tabs.map((tab) => (
        <NavLink
          key={tab.to}
          to={tab.to}
          end={tab.end}
          className={({ isActive }) =>
            isActive ? 'tab-link tab-link--active' : 'tab-link'
          }
        >
          {tab.label}
        </NavLink>
      ))}
    </nav>
  );
}

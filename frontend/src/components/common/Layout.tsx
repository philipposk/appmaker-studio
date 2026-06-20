import React from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { useGlobalDesignStyles, TOKENS, Sidebar, SidebarKey } from '../../design';

/**
 * App shell.
 *
 * Migrated pages (Dashboard, AppsList, AppBuilder, ProviderSettings) render
 * their OWN <Sidebar/> + scroll container, so for those routes the Layout is a
 * bare full-viewport canvas. Legacy pages (Profile, Admin, CreateApp,
 * AppDetail) do NOT — without help they'd render with no navigation and get
 * clipped by the shell's overflow:hidden. For those routes the Layout supplies
 * the Sidebar + a scrollable <main> so every page is usable and consistent.
 */

/** Routes whose page component already renders its own Sidebar/shell. */
function selfShelled(pathname: string): boolean {
  return (
    pathname === '/dashboard' ||
    pathname === '/apps' ||
    pathname === '/settings/providers' ||
    pathname.endsWith('/builder')
  );
}

function activeKey(pathname: string): SidebarKey {
  if (pathname.startsWith('/apps')) return 'projects';
  if (pathname.startsWith('/settings')) return 'settings';
  return 'home';
}

const Layout: React.FC = () => {
  useGlobalDesignStyles();
  const { pathname } = useLocation();

  const frame: React.CSSProperties = {
    display: 'flex',
    width: '100vw',
    height: '100vh',
    background: TOKENS.bg,
    color: TOKENS.text1,
    overflow: 'hidden',
  };

  if (selfShelled(pathname)) {
    return (
      <div style={frame}>
        <Outlet />
      </div>
    );
  }

  return (
    <div style={frame} className="am-root">
      <Sidebar active={activeKey(pathname)} />
      <main style={{ flex: 1, overflow: 'auto' }}>
        <Outlet />
      </main>
    </div>
  );
};

export default Layout;

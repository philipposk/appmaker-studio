import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAppSelector, useAppDispatch } from '../utils/hooks';
import { logout } from '../store/slices/authSlice';
import { TOKENS } from './tokens';
import { I, IconProps } from './icons';
import Logo from './Logo';

export type SidebarKey = 'home' | 'projects' | 'templates' | 'docs' | 'settings' | 'new';

interface SidebarItemDef {
  id: SidebarKey;
  label: string;
  icon: React.FC<IconProps>;
  to?: string;
  accent?: boolean;
  count?: number;
}

interface SidebarProps {
  active?: SidebarKey;
  /**
   * Optional `Recent projects` list. Rendered as plain entries; clicking
   * navigates to `/apps/:id/builder`. Falls back to a small skeleton
   * if nothing is supplied.
   */
  recents?: Array<{ id: string; name: string; active?: boolean }>;
}

const TOP_ITEMS: SidebarItemDef[] = [
  { id: 'new', label: 'New project', icon: I.Plus, accent: true, to: '/dashboard' },
  { id: 'home', label: 'Home', icon: I.Sparkle, to: '/dashboard' },
  { id: 'projects', label: 'Projects', icon: I.Folder, to: '/apps' },
  { id: 'templates', label: 'Templates', icon: I.Layout, to: '/apps' },
  { id: 'docs', label: 'Docs', icon: I.Book, to: '/about' },
];

const BOTTOM_ITEMS: SidebarItemDef[] = [
  { id: 'settings', label: 'Settings', icon: I.Settings, to: '/settings/providers' },
];

const Row: React.FC<{ item: SidebarItemDef; active: boolean }> = ({ item, active }) => {
  const Ico = item.icon;
  const style: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '8px 10px',
    borderRadius: 8,
    border: 0,
    cursor: 'pointer',
    background: active ? TOKENS.panel2 : item.accent ? TOKENS.accentSoft : 'transparent',
    color: item.accent ? TOKENS.accent : active ? TOKENS.text1 : TOKENS.text2,
    fontFamily: 'inherit',
    fontSize: 13.5,
    fontWeight: item.accent ? 500 : 400,
    textAlign: 'left',
    boxShadow: item.accent ? `inset 0 0 0 1px ${TOKENS.accentLine}` : 'none',
    textDecoration: 'none',
  };
  const inner = (
    <>
      <Ico size={16} />
      <span style={{ flex: 1 }}>{item.label}</span>
      {item.count != null && (
        <span style={{ fontSize: 11, color: TOKENS.text3, fontFamily: TOKENS.mono }}>{item.count}</span>
      )}
    </>
  );
  if (item.to) {
    return (
      <Link to={item.to} style={style}>
        {inner}
      </Link>
    );
  }
  return <button style={style}>{inner}</button>;
};

const Sidebar: React.FC<SidebarProps> = ({ active = 'home', recents }) => {
  const { user } = useAppSelector((s) => s.auth);
  const { apps } = useAppSelector((s) => s.apps);
  const dispatch = useAppDispatch();
  const navigate = useNavigate();

  // Derive a recents list from Redux apps if the caller didn't pass one in.
  const recentList =
    recents ||
    (apps || [])
      .slice(0, 4)
      .map((a: any, i: number) => ({ id: a._id, name: a.name, active: i === 0 }));

  const initials = (user?.username || 'AM').slice(0, 2).toUpperCase();

  return (
    <aside
      style={{
        width: 232,
        background: TOKENS.bg,
        borderRight: `1px solid ${TOKENS.hairline}`,
        display: 'flex',
        flexDirection: 'column',
        padding: '18px 12px 14px',
        fontFamily: TOKENS.sans,
        color: TOKENS.text2,
        height: '100%',
        flexShrink: 0,
      }}
    >
      <div style={{ padding: '4px 8px 18px' }}>
        <Link to="/dashboard" style={{ textDecoration: 'none' }}>
          <Logo />
        </Link>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        {TOP_ITEMS.map((it) => (
          <Row key={it.id} item={{ ...it, count: it.id === 'projects' ? apps?.length : it.count }} active={active === it.id} />
        ))}
      </div>

      <div
        style={{
          marginTop: 22,
          padding: '0 8px 8px',
          fontSize: 11,
          color: TOKENS.text4,
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          fontWeight: 500,
        }}
      >
        Recent
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        {recentList.length === 0 && (
          <div style={{ padding: '6px 10px', fontSize: 12, color: TOKENS.text4 }}>No projects yet.</div>
        )}
        {recentList.map((r) => (
          <button
            key={r.id}
            onClick={() => navigate(`/apps/${r.id}/builder`)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '7px 10px',
              borderRadius: 7,
              border: 0,
              background: 'transparent',
              color: r.active ? TOKENS.text1 : TOKENS.text2,
              fontSize: 13.5,
              cursor: 'pointer',
              textAlign: 'left',
              fontFamily: 'inherit',
            }}
          >
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: 2,
                background: r.active ? TOKENS.accent : TOKENS.text4,
              }}
            />
            <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.name}</span>
          </button>
        ))}
      </div>

      <div style={{ flex: 1 }} />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        {BOTTOM_ITEMS.map((it) => (
          <Row key={it.id} item={it} active={active === it.id} />
        ))}
      </div>

      <div
        style={{
          marginTop: 10,
          padding: 10,
          borderRadius: 10,
          background: TOKENS.panel,
          border: `1px solid ${TOKENS.hairline}`,
          display: 'flex',
          alignItems: 'center',
          gap: 10,
        }}
      >
        <div
          style={{
            width: 28,
            height: 28,
            borderRadius: 8,
            background: '#3A2418',
            color: TOKENS.accent,
            display: 'grid',
            placeItems: 'center',
            fontWeight: 600,
            fontSize: 12,
            fontFamily: TOKENS.mono,
          }}
        >
          {initials}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ color: TOKENS.text1, fontSize: 13, fontWeight: 500 }}>
            {user?.username || 'Guest'}
          </div>
          <div style={{ color: TOKENS.text3, fontSize: 11.5 }}>
            {user?.subscription?.plan || 'Free'} · {apps?.length || 0} apps
          </div>
        </div>
        <button
          title="Logout"
          onClick={() => {
            dispatch(logout());
            navigate('/login');
          }}
          style={{
            background: 'transparent',
            border: 0,
            color: TOKENS.text3,
            cursor: 'pointer',
            padding: 4,
          }}
        >
          <I.Arrow size={14} />
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;

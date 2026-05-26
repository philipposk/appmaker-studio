import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '../utils/hooks';
import { fetchApps, deleteApp } from '../store/slices/appSlice';
import { TOKENS, I, Sidebar, Pill, PillKind } from '../design';

/**
 * Projects screen — grid of apps with filter chips, stats and search.
 * Pulls live data from the Redux apps slice. Falls back to a friendly
 * empty state when the user has no projects yet.
 */

type FilterKey = 'all' | 'live' | 'building' | 'drafts';

const STATUS_TO_PILL: Record<string, PillKind> = {
  active: 'live',
  paused: 'building',
  draft: 'draft',
  archived: 'draft',
};

function accentFor(i: number) {
  return ['#5BB3FF', TOKENS.accent, '#9F8CFF', '#4ADE80', '#F5B647'][i % 5];
}

function matchesFilter(app: any, key: FilterKey) {
  if (key === 'all') return true;
  const pill = STATUS_TO_PILL[app.status] || 'draft';
  if (key === 'live') return pill === 'live';
  if (key === 'building') return pill === 'building';
  if (key === 'drafts') return pill === 'draft';
  return true;
}

const AppsList: React.FC = () => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { apps, loading } = useAppSelector((s) => s.apps);
  const [filter, setFilter] = useState<FilterKey>('all');
  const [query, setQuery] = useState('');

  useEffect(() => {
    dispatch(fetchApps());
  }, [dispatch]);

  const counts = useMemo(() => {
    const c = { all: apps?.length || 0, live: 0, building: 0, drafts: 0 };
    for (const a of apps || []) {
      const k = STATUS_TO_PILL[a.status] || 'draft';
      if (k === 'live') c.live++;
      else if (k === 'building') c.building++;
      else c.drafts++;
    }
    return c;
  }, [apps]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (apps || [])
      .filter((a) => matchesFilter(a, filter))
      .filter((a) =>
        q
          ? (a.name || '').toLowerCase().includes(q) || (a.description || '').toLowerCase().includes(q)
          : true,
      );
  }, [apps, filter, query]);

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm('Delete this app?')) dispatch(deleteApp(id));
  };

  return (
    <div
      className="am-root"
      style={{
        display: 'flex',
        width: '100%',
        height: '100%',
        background: TOKENS.bg,
        color: TOKENS.text1,
      }}
    >
      <Sidebar active="projects" />

      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <header
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '14px 28px',
            borderBottom: `1px solid ${TOKENS.hairline}`,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: TOKENS.text3, fontSize: 13 }}>
            <span style={{ color: TOKENS.text2 }}>Workspace</span>
            <span>/</span>
            <span style={{ color: TOKENS.text1 }}>Projects</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '6px 10px',
                width: 240,
                background: TOKENS.panel,
                border: `1px solid ${TOKENS.hairline}`,
                borderRadius: 8,
                color: TOKENS.text3,
                fontSize: 13,
              }}
            >
              <I.Search size={14} />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Filter projects…"
                style={{
                  flex: 1,
                  background: 'transparent',
                  border: 0,
                  outline: 0,
                  color: TOKENS.text1,
                  fontSize: 13,
                  fontFamily: 'inherit',
                }}
              />
              <span className="am-mono" style={{ fontSize: 11, color: TOKENS.text4 }}>
                ⌘K
              </span>
            </div>
            <button
              onClick={() => navigate('/dashboard')}
              style={{
                padding: '7px 12px',
                borderRadius: 8,
                border: 0,
                background: TOKENS.accent,
                color: '#0B0B0E',
                fontSize: 13,
                fontWeight: 500,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                boxShadow: '0 4px 14px rgba(255,106,61,0.3)',
              }}
            >
              <I.Plus size={14} stroke={2.4} /> New project
            </button>
          </div>
        </header>

        <div style={{ flex: 1, overflow: 'auto', padding: '28px 28px 36px' }}>
          <div style={{ maxWidth: 1240, margin: '0 auto' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'flex-end',
                justifyContent: 'space-between',
                marginBottom: 22,
              }}
            >
              <div>
                <h1 style={{ margin: 0, fontSize: 26, fontWeight: 600, letterSpacing: '-0.02em' }}>
                  Projects
                </h1>
                <p style={{ margin: '4px 0 0', color: TOKENS.text3, fontSize: 13.5 }}>
                  {counts.all} of 20 apps on your Pro plan.
                </p>
              </div>
              <div style={{ display: 'flex', gap: 24, alignItems: 'center', fontSize: 12.5, color: TOKENS.text3 }}>
                <Stat label="Live" value={String(counts.live)} />
                <Stat label="Building" value={String(counts.building)} />
                <Stat label="Drafts" value={String(counts.drafts)} />
              </div>
            </div>

            <FilterRow filter={filter} setFilter={setFilter} counts={counts} />

            {loading ? (
              <div style={{ padding: 60, textAlign: 'center', color: TOKENS.text3 }}>Loading…</div>
            ) : visible.length === 0 ? (
              <EmptyState onNew={() => navigate('/dashboard')} />
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
                {visible.map((p: any, i: number) => (
                  <ProjectCard
                    key={p._id}
                    app={p}
                    accent={accentFor(i)}
                    onOpen={() => navigate(`/apps/${p._id}/builder`)}
                    onDelete={(e) => handleDelete(p._id, e)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

const Stat: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
    <span style={{ fontSize: 11, color: TOKENS.text4, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
      {label}
    </span>
    <span style={{ color: TOKENS.text1, fontSize: 17, fontWeight: 600, fontFamily: TOKENS.mono }}>
      {value}
    </span>
  </div>
);

const FilterRow: React.FC<{
  filter: FilterKey;
  setFilter: (f: FilterKey) => void;
  counts: { all: number; live: number; building: number; drafts: number };
}> = ({ filter, setFilter, counts }) => {
  const opts: { key: FilterKey; label: string; count: number }[] = [
    { key: 'all', label: 'All', count: counts.all },
    { key: 'live', label: 'Live', count: counts.live },
    { key: 'building', label: 'Building', count: counts.building },
    { key: 'drafts', label: 'Drafts', count: counts.drafts },
  ];
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        marginBottom: 18,
        paddingBottom: 14,
        borderBottom: `1px solid ${TOKENS.hairline}`,
      }}
    >
      {opts.map((f) => {
        const active = filter === f.key;
        return (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 7,
              padding: '6px 11px',
              borderRadius: 7,
              cursor: 'pointer',
              background: active ? TOKENS.panel2 : 'transparent',
              border: `1px solid ${active ? TOKENS.hairline2 : 'transparent'}`,
              color: active ? TOKENS.text1 : TOKENS.text2,
              fontSize: 13,
              fontFamily: 'inherit',
              fontWeight: active ? 500 : 400,
            }}
          >
            {f.label}
            <span style={{ color: TOKENS.text4, fontFamily: TOKENS.mono, fontSize: 11 }}>
              {f.count}
            </span>
          </button>
        );
      })}
      <div style={{ flex: 1 }} />
      <div
        style={{
          display: 'flex',
          gap: 2,
          padding: 2,
          borderRadius: 7,
          background: TOKENS.panel,
          border: `1px solid ${TOKENS.hairline}`,
        }}
      >
        <button
          style={{
            width: 26,
            height: 22,
            borderRadius: 5,
            border: 0,
            cursor: 'pointer',
            background: TOKENS.panel2,
            color: TOKENS.text1,
            display: 'grid',
            placeItems: 'center',
          }}
        >
          <I.Grid size={13} />
        </button>
        <button
          style={{
            width: 26,
            height: 22,
            borderRadius: 5,
            border: 0,
            cursor: 'pointer',
            background: 'transparent',
            color: TOKENS.text3,
            display: 'grid',
            placeItems: 'center',
          }}
        >
          <I.Layout size={13} />
        </button>
      </div>
    </div>
  );
};

const EmptyState: React.FC<{ onNew: () => void }> = ({ onNew }) => (
  <div
    style={{
      padding: 60,
      textAlign: 'center',
      background: TOKENS.panel,
      border: `1px dashed ${TOKENS.hairline2}`,
      borderRadius: 14,
    }}
  >
    <div style={{ color: TOKENS.text1, fontSize: 18, fontWeight: 500, marginBottom: 6 }}>
      No projects yet
    </div>
    <div style={{ color: TOKENS.text3, fontSize: 14, marginBottom: 18 }}>
      Describe an app on the Home screen and we&apos;ll generate it.
    </div>
    <button
      onClick={onNew}
      style={{
        padding: '8px 14px',
        borderRadius: 8,
        border: 0,
        background: TOKENS.accent,
        color: '#0B0B0E',
        fontWeight: 500,
        cursor: 'pointer',
      }}
    >
      Create your first app
    </button>
  </div>
);

const ProjectCard: React.FC<{
  app: any;
  accent: string;
  onOpen: () => void;
  onDelete: (e: React.MouseEvent) => void;
}> = ({ app, accent, onOpen, onDelete }) => {
  const status = STATUS_TO_PILL[app.status] || 'draft';
  const desc = app.description || 'No description';
  const type = app.type === 'web' ? 'Web · React' : app.type;
  const updated = new Date(app.updatedAt || app.createdAt || Date.now()).toLocaleString();
  const deploys = app.deployment?.url ? 1 : 0;
  const runs = app.statistics?.views ?? '—';

  return (
    <div
      onClick={onOpen}
      style={{
        background: TOKENS.panel,
        border: `1px solid ${TOKENS.hairline}`,
        borderRadius: 14,
        cursor: 'pointer',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div
        style={{
          height: 132,
          background: TOKENS.bg,
          borderBottom: `1px solid ${TOKENS.hairline}`,
          position: 'relative',
          overflow: 'hidden',
          padding: 12,
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
        }}
      >
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: `radial-gradient(circle at 20% 0%, ${accent}1A, transparent 50%)`,
          }}
        />
        <div style={{ display: 'flex', gap: 4, position: 'relative' }}>
          <span style={{ width: 5, height: 5, borderRadius: 99, background: TOKENS.text4 }} />
          <span style={{ width: 5, height: 5, borderRadius: 99, background: TOKENS.text4 }} />
          <span style={{ width: 5, height: 5, borderRadius: 99, background: TOKENS.text4 }} />
        </div>
        <div style={{ display: 'flex', gap: 8, flex: 1, position: 'relative' }}>
          <div
            style={{
              width: 32,
              background: TOKENS.panel2,
              borderRadius: 5,
              display: 'flex',
              flexDirection: 'column',
              gap: 4,
              padding: 5,
            }}
          >
            <div style={{ height: 5, background: accent, borderRadius: 2 }} />
            <div style={{ height: 4, background: TOKENS.panel3, borderRadius: 2 }} />
            <div style={{ height: 4, background: TOKENS.panel3, borderRadius: 2 }} />
          </div>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 5 }}>
            <div style={{ height: 7, background: TOKENS.text1, borderRadius: 2, width: '45%' }} />
            <div style={{ height: 4, background: TOKENS.panel3, borderRadius: 2, width: '90%' }} />
            <div style={{ display: 'flex', gap: 6 }}>
              <div style={{ height: 18, background: accent, borderRadius: 4, width: 50 }} />
              <div style={{ height: 18, background: TOKENS.panel3, borderRadius: 4, width: 50 }} />
            </div>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 3 }}>
              {[1, 2, 3].map((i) => (
                <div key={i} style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
                  <div style={{ width: 8, height: 8, borderRadius: 2, background: TOKENS.panel3 }} />
                  <div style={{ height: 4, background: TOKENS.panel3, borderRadius: 2, flex: 1 }} />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ width: 8, height: 8, borderRadius: 2, background: accent }} />
            <span style={{ color: TOKENS.text1, fontSize: 14, fontWeight: 500 }}>{app.name}</span>
          </div>
          <Pill kind={status}>{status}</Pill>
        </div>
        <div
          style={{
            color: TOKENS.text3,
            fontSize: 12.5,
            lineHeight: 1.5,
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          {desc}
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 14,
            paddingTop: 10,
            borderTop: `1px solid ${TOKENS.hairline}`,
            fontSize: 11.5,
            color: TOKENS.text3,
          }}
        >
          <span className="am-mono" style={{ color: TOKENS.text2 }}>
            {type}
          </span>
          <span style={{ width: 1, height: 10, background: TOKENS.hairline2 }} />
          <span>{updated}</span>
          <div style={{ flex: 1 }} />
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
            <I.Rocket size={11} /> {deploys}
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
            <I.Eye size={11} /> {runs}
          </span>
          <button
            onClick={onDelete}
            title="Delete"
            style={{
              background: 'transparent',
              border: 0,
              color: TOKENS.text4,
              cursor: 'pointer',
              padding: 2,
            }}
          >
            ✕
          </button>
        </div>
      </div>
    </div>
  );
};

export default AppsList;

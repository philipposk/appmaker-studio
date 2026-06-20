import React, { useEffect, useState, useMemo } from 'react';
import { useAppDispatch, useAppSelector } from '../utils/hooks';
import { fetchApps } from '../store/slices/appSlice';
import './Admin.scss';

/**
 * Admin panel. Cross-user metrics (total users, users-by-plan) require a
 * server with the service-role key — not available in the static platform
 * deployment, and a client-side role gate is not a real security boundary.
 * So we show only what's safely derivable from the signed-in admin's own data
 * (their apps, via RLS) and a clear note for the rest. The old /api/admin/*
 * Express calls were removed (dead backend + Bearer of a non-existent token).
 */
const Admin: React.FC = () => {
  const dispatch = useAppDispatch();
  const { user } = useAppSelector((state) => state.auth);
  const { apps, loading } = useAppSelector((state) => state.apps);
  const [activeTab, setActiveTab] = useState<'users' | 'apps' | 'stats'>('stats');
  const users: any[] = [];

  useEffect(() => {
    if (user?.role !== 'admin') return;
    dispatch(fetchApps());
  }, [dispatch, user]);

  // Stats derived from the apps this admin can see (RLS-scoped). User-level
  // aggregates that need the service role are shown as "—".
  const stats = useMemo(() => {
    const list = apps || [];
    const byStatus = list.reduce((acc: Record<string, number>, a: any) => {
      acc[a.status] = (acc[a.status] || 0) + 1;
      return acc;
    }, {});
    return {
      totalUsers: '—',
      totalApps: list.length,
      activeUsers: '—',
      deployedApps: list.filter((a: any) => a.deployment?.url || a.deployment?.status === 'deployed').length,
      usersByPlan: [],
      appsByStatus: Object.entries(byStatus).map(([_id, count]) => ({ _id, count })),
    };
  }, [apps]);

  if (user?.role !== 'admin') {
    return (
      <div className="admin-page">
        <div className="alert alert--error">
          <p>Access denied. Admin privileges required.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-page">
      <div className="admin-header">
        <h1>Admin Panel</h1>
        <p>Manage users, apps, and platform settings</p>
      </div>

      <div className="admin-tabs">
        <button
          className={`tab ${activeTab === 'stats' ? 'active' : ''}`}
          onClick={() => setActiveTab('stats')}
        >
          📊 Statistics
        </button>
        <button
          className={`tab ${activeTab === 'users' ? 'active' : ''}`}
          onClick={() => setActiveTab('users')}
        >
          👥 Users
        </button>
        <button
          className={`tab ${activeTab === 'apps' ? 'active' : ''}`}
          onClick={() => setActiveTab('apps')}
        >
          📱 Apps
        </button>
      </div>

      <div className="admin-content">
        {activeTab === 'stats' && (
          <div className="admin-stats">
            {loading ? (
              <div className="spinner"></div>
            ) : stats ? (
              <>
                <div className="alert alert--warning">
                  Showing apps visible to your account. Platform-wide user counts need a
                  server with the service-role key (shown as “—”).
                </div>
                <div className="stats-grid">
                  <div className="stat-card">
                    <h3>{stats.totalUsers}</h3>
                    <p>Total Users</p>
                  </div>
                  <div className="stat-card">
                    <h3>{stats.totalApps}</h3>
                    <p>Total Apps</p>
                  </div>
                  <div className="stat-card">
                    <h3>{stats.activeUsers}</h3>
                    <p>Active Users</p>
                  </div>
                  <div className="stat-card">
                    <h3>{stats.deployedApps}</h3>
                    <p>Deployed Apps</p>
                  </div>
                </div>
                <div className="stats-details">
                  <div className="detail-card">
                    <h4>Users by Plan</h4>
                    {stats.usersByPlan.map((item: any) => (
                      <div key={item._id} className="detail-item">
                        <span>{item._id || 'free'}</span>
                        <span>{item.count}</span>
                      </div>
                    ))}
                  </div>
                  <div className="detail-card">
                    <h4>Apps by Status</h4>
                    {stats.appsByStatus.map((item: any) => (
                      <div key={item._id} className="detail-item">
                        <span>{item._id}</span>
                        <span>{item.count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            ) : null}
          </div>
        )}

        {activeTab === 'users' && (
          <div className="admin-users">
            <div className="alert alert--warning">
              User management isn't available in the platform deployment. Listing all
              users requires a server with the Supabase service-role key — use the
              Supabase dashboard (Authentication → Users) for now.
            </div>
            {users.length > 0 && (
              <table className="users-table">
                <tbody>
                  {users.map((u: any) => (
                    <tr key={u.id || u._id}><td>{u.email}</td></tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {activeTab === 'apps' && (
          <div className="admin-apps">
            <table className="apps-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Owner</th>
                  <th>Type</th>
                  <th>Status</th>
                  <th>Deployment</th>
                  <th>Created</th>
                </tr>
              </thead>
              <tbody>
                {apps.map((app: any) => (
                  <tr key={app._id}>
                    <td>{app.name}</td>
                    <td>{app.owner?.username || 'Unknown'}</td>
                    <td>{app.type}</td>
                    <td>
                      <span className={`badge badge--${app.status}`}>{app.status}</span>
                    </td>
                    <td>
                      <span className={`badge badge--${app.deployment?.status || 'not_deployed'}`}>
                        {app.deployment?.status || 'Not Deployed'}
                      </span>
                    </td>
                    <td>{new Date(app.createdAt).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default Admin;


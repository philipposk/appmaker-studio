import React, { useEffect, useState } from 'react';
import { useAppDispatch, useAppSelector } from '../utils/hooks';
import { fetchApps } from '../store/slices/appSlice';
import './Admin.scss';

const Admin: React.FC = () => {
  const dispatch = useAppDispatch();
  const { user } = useAppSelector((state) => state.auth);
  const { apps } = useAppSelector((state) => state.apps);
  const [activeTab, setActiveTab] = useState<'users' | 'apps' | 'stats'>('stats');
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState<any>(null);

  useEffect(() => {
    if (user?.role !== 'admin') {
      return;
    }
    dispatch(fetchApps());
    loadStats();
  }, [dispatch, user]);

  const loadStats = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/admin/stats', {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`
        }
      });
      const data = await response.json();
      if (data.success) {
        setStats(data.stats);
      }
    } catch (error) {
      console.error('Failed to load stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadUsers = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/admin/users', {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`
        }
      });
      const data = await response.json();
      if (data.success) {
        setUsers(data.users);
      }
    } catch (error) {
      console.error('Failed to load users:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'users') {
      loadUsers();
    }
  }, [activeTab]);

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
            {loading ? (
              <div className="spinner"></div>
            ) : (
              <table className="users-table">
                <thead>
                  <tr>
                    <th>Username</th>
                    <th>Email</th>
                    <th>Role</th>
                    <th>Plan</th>
                    <th>Apps</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u: any) => (
                    <tr key={u.id || u._id}>
                      <td>{u.username}</td>
                      <td>{u.email}</td>
                      <td>
                        <span className={`badge badge--${u.role}`}>{u.role}</span>
                      </td>
                      <td>{u.subscription?.plan || 'free'}</td>
                      <td>{u.apps?.length || 0}</td>
                      <td>
                        <span className={`badge badge--${u.isActive ? 'active' : 'inactive'}`}>
                          {u.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                    </tr>
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


import React from 'react';
import { Outlet, Link, useNavigate } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '../../utils/hooks';
import { logout } from '../../store/slices/authSlice';
import { toggleTheme } from '../../store/slices/themeSlice';
import Notifications from './Notifications';
import './Layout.scss';

const Layout: React.FC = () => {
  const dispatch = useAppDispatch();
  const { user } = useAppSelector((state) => state.auth);
  const { theme } = useAppSelector((state) => state.theme);
  const navigate = useNavigate();

  const handleLogout = () => {
    dispatch(logout());
    navigate('/login');
  };

  const handleThemeToggle = () => {
    dispatch(toggleTheme());
  };

  return (
    <div className="app-layout">
      <header className="header">
        <div className="container header__content">
          <Link to="/dashboard" className="header__logo">
            <h1>Vibecoders</h1>
          </Link>
          
          <nav className="header__nav">
            <Link to="/dashboard" className="nav-link">Dashboard</Link>
            <Link to="/apps" className="nav-link">My Apps</Link>
            <Link to="/profile" className="nav-link">Profile</Link>
            <Link to="/settings/providers" className="nav-link">Providers</Link>
            {user?.role === 'admin' && (
              <Link to="/admin" className="nav-link">Admin</Link>
            )}
          </nav>

          <div className="header__actions">
            <Notifications />
            <button onClick={handleThemeToggle} className="btn btn--secondary" title="Toggle theme">
              {theme === 'light' ? '🌙' : '☀️'}
            </button>
            <div className="header__user">
              <span className="user-name">{user?.username}</span>
              <button onClick={handleLogout} className="btn btn--secondary">Logout</button>
            </div>
          </div>
        </div>
      </header>

      <main className="main-content">
        <div className="container">
          <Outlet />
        </div>
      </main>

      <footer className="footer">
        <div className="container">
          <p>&copy; 2024 Vibecoders. Simplifying app development.</p>
          <Link to="/about">About</Link>
        </div>
      </footer>
    </div>
  );
};

export default Layout;


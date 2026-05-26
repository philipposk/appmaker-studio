import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Provider } from 'react-redux';
import { store } from './store/store';
import { useAppDispatch, useAppSelector } from './utils/hooks';
import { getMe } from './store/slices/authSlice';
import { setTheme } from './store/slices/themeSlice';
import './styles/index.scss';

// Components
import Layout from './components/common/Layout';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import AppsList from './pages/AppsList';
import AppDetail from './pages/AppDetail';
import AppBuilder from './pages/AppBuilder';
import CreateApp from './pages/CreateApp';
import Profile from './pages/Profile';
import About from './pages/About';
import Admin from './pages/Admin';
import ProviderSettings from './pages/ProviderSettings';
import PrivateRoute from './components/common/PrivateRoute';

// App Content with Routes
const AppContent = () => {
  const dispatch = useAppDispatch();
  const { isAuthenticated, token, loading } = useAppSelector((state) => state.auth);
  const { theme } = useAppSelector((state) => state.theme);

  useEffect(() => {
    // Initialize theme
    const savedTheme = localStorage.getItem('theme') as 'light' | 'dark' || theme;
    dispatch(setTheme(savedTheme));
    document.documentElement.setAttribute('data-theme', savedTheme);

    // Load user if token exists
    if (token && !isAuthenticated) {
      dispatch(getMe());
    }
  }, [dispatch, token, isAuthenticated]);

  if (loading && token) {
    return (
      <div className="app-layout" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
        <div className="spinner"></div>
      </div>
    );
  }

  return (
    <Router>
      <Routes>
        <Route path="/login" element={!isAuthenticated ? <Login /> : <Navigate to="/dashboard" />} />
        <Route path="/register" element={!isAuthenticated ? <Register /> : <Navigate to="/dashboard" />} />
        <Route path="/about" element={<About />} />
        
        <Route
          path="/"
          element={
            <PrivateRoute>
              <Layout />
            </PrivateRoute>
          }
        >
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="apps" element={<AppsList />} />
          <Route path="apps/create" element={<CreateApp />} />
          <Route path="apps/:id" element={<AppDetail />} />
          <Route path="apps/:id/builder" element={<AppBuilder />} />
          <Route path="profile" element={<Profile />} />
          <Route path="admin" element={<Admin />} />
          <Route path="settings/providers" element={<ProviderSettings />} />
        </Route>
      </Routes>
    </Router>
  );
};

// Main App Component
const App: React.FC = () => {
  return (
    <Provider store={store}>
      <AppContent />
    </Provider>
  );
};

export default App;

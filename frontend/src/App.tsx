import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Provider } from 'react-redux';
import { store } from './store/store';
import { useAppDispatch, useAppSelector } from './utils/hooks';
import { getMe, setSession } from './store/slices/authSlice';
import { setTheme } from './store/slices/themeSlice';
import { supabase } from './lib/supabase';
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

const AppContent = () => {
  const dispatch = useAppDispatch();
  const { isAuthenticated, loading } = useAppSelector((state) => state.auth);
  const { theme } = useAppSelector((state) => state.theme);

  useEffect(() => {
    // Theme init
    const savedTheme = localStorage.getItem('theme') as 'light' | 'dark' || theme;
    dispatch(setTheme(savedTheme));
    document.documentElement.setAttribute('data-theme', savedTheme);

    // Restore existing Supabase session on boot (checks cookies).
    dispatch(getMe());

    // Keep Redux in sync whenever Supabase refreshes the token or the user
    // signs in / out in another tab.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      dispatch(setSession({ session }));
    });

    return () => subscription.unsubscribe();
  }, [dispatch]); // eslint-disable-line react-hooks/exhaustive-deps

  // Block render until we've finished the initial session check.
  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', background: '#0B0B0E' }}>
        <div className="spinner" />
      </div>
    );
  }

  return (
    <Router>
      <Routes>
        <Route path="/login"    element={!isAuthenticated ? <Login />    : <Navigate to="/dashboard" />} />
        <Route path="/register" element={!isAuthenticated ? <Register /> : <Navigate to="/dashboard" />} />
        <Route path="/auth/callback" element={<Navigate to="/dashboard" />} />
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
          <Route path="dashboard"          element={<Dashboard />} />
          <Route path="apps"               element={<AppsList />} />
          <Route path="apps/create"        element={<CreateApp />} />
          <Route path="apps/:id"           element={<AppDetail />} />
          <Route path="apps/:id/builder"   element={<AppBuilder />} />
          <Route path="profile"            element={<Profile />} />
          <Route path="admin"              element={<Admin />} />
          <Route path="settings/providers" element={<ProviderSettings />} />
        </Route>
      </Routes>
    </Router>
  );
};

const App: React.FC = () => (
  <Provider store={store}>
    <AppContent />
  </Provider>
);

export default App;

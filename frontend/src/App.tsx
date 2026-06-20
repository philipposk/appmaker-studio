import React, { useEffect, Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Provider } from 'react-redux';
import { store } from './store/store';
import { useAppDispatch, useAppSelector } from './utils/hooks';
import { setSession, markLoaded } from './store/slices/authSlice';
import { setTheme } from './store/slices/themeSlice';
import { supabase } from './lib/supabase';
import { touchAppAccess } from './lib/appAccess';
import './styles/index.scss';

// Components
import Layout from './components/common/Layout';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import AppsList from './pages/AppsList';
import AppDetail from './pages/AppDetail';
import CreateApp from './pages/CreateApp';
import Profile from './pages/Profile';
import About from './pages/About';
import Admin from './pages/Admin';
import ProviderSettings from './pages/ProviderSettings';
import PrivateRoute from './components/common/PrivateRoute';

// The builder pulls the heavy editor stack — load it only when its route opens.
const AppBuilder = lazy(() => import('./pages/AppBuilder'));

const AppContent = () => {
  const dispatch = useAppDispatch();
  const { isAuthenticated, loading, user } = useAppSelector((state) => state.auth);

  // Record AppMaker usage in the shared platform table so the 6x7 hub's
  // "your apps" dashboard can list it. Once per authenticated user id.
  useEffect(() => {
    if (isAuthenticated && user?.id) touchAppAccess(user.id);
  }, [isAuthenticated, user?.id]);

  useEffect(() => {
    // The new shell is dark-only; the light-theme path renders white cards on
    // the black canvas, so force dark app-wide (audit: palette/theme break).
    dispatch(setTheme('dark'));
    document.documentElement.setAttribute('data-theme', 'dark');

    // Single source of truth for auth state: Supabase fires INITIAL_SESSION on
    // listener registration (restores the cookie session) and again on every
    // sign-in / sign-out / token refresh — in this and other tabs. setSession
    // also clears the loading gate. No separate getMe() (it raced this one).
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      dispatch(setSession({ session }));
    });

    // Safety net: if the initial event somehow never arrives (storage lock,
    // BroadcastChannel stall), don't trap the user on the spinner forever.
    const safety = setTimeout(() => dispatch(markLoaded()), 8000);

    return () => {
      subscription.unsubscribe();
      clearTimeout(safety);
    };
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
      <Suspense fallback={
        <div style={{ display: 'grid', placeItems: 'center', minHeight: '100vh', background: '#0B0B0E' }}>
          <div className="spinner" />
        </div>
      }>
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
      </Suspense>
    </Router>
  );
};

const App: React.FC = () => (
  <Provider store={store}>
    <AppContent />
  </Provider>
);

export default App;

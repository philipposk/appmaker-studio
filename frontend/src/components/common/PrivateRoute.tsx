import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAppSelector } from '../../utils/hooks';
import { TOKENS } from '../../design';

const PrivateRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, loading } = useAppSelector((s) => s.auth);

  if (loading) {
    return (
      <div style={{ display: 'grid', placeItems: 'center', minHeight: '100vh', background: TOKENS.bg }}>
        <div className="spinner" />
      </div>
    );
  }

  if (!isAuthenticated) return <Navigate to="/login" replace />;

  return <>{children}</>;
};

export default PrivateRoute;

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '../utils/hooks';
import { login, clearError } from '../store/slices/authSlice';
import { supabase } from '../lib/supabase';
import { TOKENS, I, Logo } from '../design';

const Login: React.FC = () => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { isAuthenticated, loading, error } = useAppSelector((s) => s.auth);
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [oauthLoading, setOauthLoading] = useState(false);

  useEffect(() => {
    if (isAuthenticated) navigate('/dashboard');
    return () => { dispatch(clearError()); };
  }, [isAuthenticated, navigate, dispatch]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    dispatch(login({ email, password }));
  };

  const handleGoogle = async () => {
    setOauthLoading(true);
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
  };

  return (
    <div style={{
      display: 'grid', placeItems: 'center', minHeight: '100vh',
      background: TOKENS.bg, fontFamily: TOKENS.sans, color: TOKENS.text1,
    }}>
      <div style={{ width: '100%', maxWidth: 400, padding: '0 24px' }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <Logo />
          <p style={{ color: TOKENS.text3, fontSize: 14, marginTop: 8 }}>Sign in to your account</p>
        </div>

        <button
          onClick={handleGoogle}
          disabled={oauthLoading || loading}
          style={{
            width: '100%', padding: '11px 16px', borderRadius: 9,
            border: `1px solid ${TOKENS.hairline2}`, background: TOKENS.panel,
            color: TOKENS.text1, fontSize: 14, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            marginBottom: 16, fontFamily: TOKENS.sans,
          }}
        >
          <I.Globe size={16} />
          {oauthLoading ? 'Redirecting…' : 'Continue with Google'}
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <span style={{ flex: 1, height: 1, background: TOKENS.hairline }} />
          <span style={{ fontSize: 12, color: TOKENS.text4 }}>or email</span>
          <span style={{ flex: 1, height: 1, background: TOKENS.hairline }} />
        </div>

        {error && (
          <div style={{
            padding: '10px 14px', borderRadius: 8, marginBottom: 16,
            background: 'rgba(255,142,114,0.1)', border: '1px solid rgba(255,142,114,0.25)',
            color: '#FF8E72', fontSize: 13,
          }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <input
            type="email" value={email} onChange={(e) => setEmail(e.target.value)}
            placeholder="Email" required autoComplete="email"
            style={inputStyle}
          />
          <input
            type="password" value={password} onChange={(e) => setPassword(e.target.value)}
            placeholder="Password" required autoComplete="current-password"
            style={inputStyle}
          />
          <button
            type="submit" disabled={loading || !email || !password}
            style={{
              padding: '11px 16px', borderRadius: 9, border: 0,
              background: TOKENS.accent, color: '#0B0B0E',
              fontSize: 14, fontWeight: 500, cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.7 : 1, fontFamily: TOKENS.sans,
              boxShadow: '0 4px 14px rgba(255,106,61,0.3)',
            }}
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <p style={{ textAlign: 'center', marginTop: 20, fontSize: 13.5, color: TOKENS.text3 }}>
          No account?{' '}
          <a href="/register" style={{ color: TOKENS.accent, textDecoration: 'none' }}>Create one</a>
        </p>
      </div>
    </div>
  );
};

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '10px 14px', borderRadius: 8,
  border: `1px solid ${TOKENS.hairline2}`, background: TOKENS.panel2,
  color: TOKENS.text1, fontSize: 14, fontFamily: 'inherit',
  outline: 0, boxSizing: 'border-box',
};

export default Login;

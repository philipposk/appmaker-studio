import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '../utils/hooks';
import { register, clearError } from '../store/slices/authSlice';
import { supabase } from '../lib/supabase';
import { TOKENS, I, Logo } from '../design';

const Register: React.FC = () => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { isAuthenticated, loading, error } = useAppSelector((s) => s.auth);

  const [form, setForm] = useState({
    username: '', email: '', password: '', confirmPassword: '', firstName: '', lastName: '',
  });
  const [sentTo, setSentTo] = useState<string>('');   // email-confirmation panel
  const [localError, setLocalError] = useState('');
  const [oauthLoading, setOauthLoading] = useState(false);

  useEffect(() => {
    if (isAuthenticated) navigate('/dashboard');
    return () => { dispatch(clearError()); };
  }, [isAuthenticated, navigate, dispatch]);

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError('');
    if (form.password !== form.confirmPassword) {
      setLocalError('Passwords do not match.');
      return;
    }
    if (form.password.length < 6) {
      setLocalError('Password must be at least 6 characters.');
      return;
    }
    const { confirmPassword, ...registerData } = form;
    const res = await dispatch(register(registerData));
    if (register.fulfilled.match(res) && (res.payload as any)?.needsConfirmation) {
      setSentTo(form.email);   // signup ok but must confirm email
    }
    // If a session came back, the isAuthenticated effect redirects to /dashboard.
  };

  const handleGoogle = async () => {
    setOauthLoading(true);
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
  };

  // ── Email-confirmation success panel ─────────────────────────
  if (sentTo) {
    return (
      <Shell>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: 48, height: 48, borderRadius: 12, margin: '0 auto 16px',
            background: 'rgba(74,222,128,0.12)', color: TOKENS.green,
            display: 'grid', placeItems: 'center',
          }}>
            <I.Check size={24} />
          </div>
          <h2 style={{ fontSize: 20, fontWeight: 600, margin: '0 0 8px' }}>Check your email</h2>
          <p style={{ color: TOKENS.text2, fontSize: 14, lineHeight: 1.6, margin: '0 0 20px' }}>
            We sent a confirmation link to{' '}
            <span style={{ color: TOKENS.text1, fontWeight: 500 }}>{sentTo}</span>.
            Click it to activate your account, then sign in.
          </p>
          <a href="/login" style={{
            display: 'inline-block', padding: '10px 18px', borderRadius: 9,
            background: TOKENS.accent, color: '#0B0B0E', fontSize: 14, fontWeight: 500,
            textDecoration: 'none',
          }}>
            Go to sign in
          </a>
        </div>
      </Shell>
    );
  }

  const mismatch = !!form.confirmPassword && form.password !== form.confirmPassword;

  return (
    <Shell>
      <div style={{ textAlign: 'center', marginBottom: 28 }}>
        <Logo />
        <p style={{ color: TOKENS.text3, fontSize: 14, marginTop: 8 }}>Create your account</p>
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

      {(error || localError) && (
        <div style={{
          padding: '10px 14px', borderRadius: 8, marginBottom: 16,
          background: 'rgba(255,142,114,0.1)', border: '1px solid rgba(255,142,114,0.25)',
          color: '#FF8E72', fontSize: 13,
        }}>
          {localError || error}
        </div>
      )}

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <input style={inputStyle} placeholder="Username" value={form.username}
               onChange={(e) => set('username', e.target.value)} required disabled={loading} />
        <input style={inputStyle} type="email" placeholder="Email" autoComplete="email" value={form.email}
               onChange={(e) => set('email', e.target.value)} required disabled={loading} />
        <div style={{ display: 'flex', gap: 12 }}>
          <input style={inputStyle} placeholder="First name" value={form.firstName}
                 onChange={(e) => set('firstName', e.target.value)} disabled={loading} />
          <input style={inputStyle} placeholder="Last name" value={form.lastName}
                 onChange={(e) => set('lastName', e.target.value)} disabled={loading} />
        </div>
        <input style={inputStyle} type="password" placeholder="Password (min 6)" autoComplete="new-password"
               value={form.password} onChange={(e) => set('password', e.target.value)} required disabled={loading} />
        <input style={{ ...inputStyle, borderColor: mismatch ? '#FF8E72' : TOKENS.hairline2 }}
               type="password" placeholder="Confirm password" autoComplete="new-password"
               value={form.confirmPassword} onChange={(e) => set('confirmPassword', e.target.value)} required disabled={loading} />
        {mismatch && <span style={{ fontSize: 12, color: '#FF8E72', marginTop: -4 }}>Passwords do not match</span>}

        <button type="submit" disabled={loading || mismatch || !form.email || !form.password}
          style={{
            padding: '11px 16px', borderRadius: 9, border: 0,
            background: TOKENS.accent, color: '#0B0B0E', fontSize: 14, fontWeight: 500,
            cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1,
            fontFamily: TOKENS.sans, boxShadow: '0 4px 14px rgba(255,106,61,0.3)',
          }}>
          {loading ? 'Creating account…' : 'Sign up'}
        </button>
      </form>

      <p style={{ textAlign: 'center', marginTop: 20, fontSize: 13.5, color: TOKENS.text3 }}>
        Already have an account?{' '}
        <a href="/login" style={{ color: TOKENS.accent, textDecoration: 'none' }}>Sign in</a>
      </p>
    </Shell>
  );
};

const Shell: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div style={{
    display: 'grid', placeItems: 'center', minHeight: '100vh',
    background: TOKENS.bg, fontFamily: TOKENS.sans, color: TOKENS.text1,
  }}>
    <div style={{ width: '100%', maxWidth: 420, padding: '0 24px' }}>{children}</div>
  </div>
);

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '10px 14px', borderRadius: 8,
  border: `1px solid ${TOKENS.hairline2}`, background: TOKENS.panel2,
  color: TOKENS.text1, fontSize: 14, fontFamily: 'inherit',
  outline: 0, boxSizing: 'border-box',
};

export default Register;

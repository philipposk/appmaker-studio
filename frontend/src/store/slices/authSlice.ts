import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { supabase } from '../../lib/supabase';

/**
 * Auth slice — backed by Supabase shared auth (6x7 platform).
 *
 * Same state shape as before so every component that reads
 * state.auth.user / isAuthenticated / loading keeps working unchanged.
 * Token is now the Supabase session access_token (JWT), used in
 * streamClient.ts Authorization header to reach the Edge Function.
 */

interface User {
  id: string;
  username: string;
  email: string;
  role: 'developer' | 'admin';
  profile?: {
    firstName?: string;
    lastName?: string;
    bio?: string;
    avatar?: string;
  };
  subscription?: {
    plan: string;
    maxApps: number;
  };
  notifications?: number;
}

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  loading: boolean;
  error: string | null;
}

const initialState: AuthState = {
  user: null,
  token: null,
  isAuthenticated: false,
  loading: true,   // true on boot — we need to check the session before rendering
  error: null,
};

/** Map a Supabase user → the app's User shape */
function toUser(sbUser: any): User {
  return {
    id:       sbUser.id,
    username: sbUser.user_metadata?.username || sbUser.email?.split('@')[0] || 'User',
    email:    sbUser.email ?? '',
    role:     sbUser.user_metadata?.role ?? 'developer',
    profile: {
      firstName: sbUser.user_metadata?.first_name,
      lastName:  sbUser.user_metadata?.last_name,
      avatar:    sbUser.user_metadata?.avatar_url,
    },
    subscription: { plan: 'Free', maxApps: 3 },
  };
}

// ── Thunks ─────────────────────────────────────────────────────

/** Called once on boot from App.tsx to restore any existing session. */
export const getMe = createAsyncThunk('auth/getMe', async (_, { rejectWithValue }) => {
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session) return rejectWithValue('No session');
  return { user: toUser(data.session.user), token: data.session.access_token };
});

export const login = createAsyncThunk(
  'auth/login',
  async (credentials: { email: string; password: string }, { rejectWithValue }) => {
    const { data, error } = await supabase.auth.signInWithPassword(credentials);
    if (error || !data.session) return rejectWithValue(error?.message ?? 'Login failed');
    return { user: toUser(data.session.user), token: data.session.access_token };
  },
);

export const register = createAsyncThunk(
  'auth/register',
  async (
    userData: { username: string; email: string; password: string; firstName?: string; lastName?: string },
    { rejectWithValue },
  ) => {
    const { data, error } = await supabase.auth.signUp({
      email:    userData.email,
      password: userData.password,
      options: {
        data: {
          username:   userData.username,
          first_name: userData.firstName,
          last_name:  userData.lastName,
        },
      },
    });
    if (error) return rejectWithValue(error.message);
    // signUp may return a session immediately (if email confirm disabled) or null.
    if (data.session) {
      return { user: toUser(data.session.user), token: data.session.access_token };
    }
    // Email confirmation required — return null session, UI will show "check email".
    return { user: null, token: null, needsConfirmation: true };
  },
);

// ── Slice ───────────────────────────────────────────────────────

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    logout: (state) => {
      state.user = null;
      state.token = null;
      state.isAuthenticated = false;
      supabase.auth.signOut();   // clears cookie storage
    },
    clearError: (state) => {
      state.error = null;
    },
    /** Called by the onAuthStateChange listener in App.tsx to keep Redux in sync. */
    setSession: (state, action) => {
      const { session } = action.payload;
      if (session) {
        state.user           = toUser(session.user);
        state.token          = session.access_token;
        state.isAuthenticated = true;
      } else {
        state.user           = null;
        state.token          = null;
        state.isAuthenticated = false;
      }
      state.loading = false;
    },
  },
  extraReducers: (builder) => {
    builder
      // getMe (boot session restore)
      .addCase(getMe.pending, (state) => { state.loading = true; })
      .addCase(getMe.fulfilled, (state, action) => {
        state.loading         = false;
        state.isAuthenticated = true;
        state.user            = action.payload.user;
        state.token           = action.payload.token;
      })
      .addCase(getMe.rejected, (state) => {
        state.loading         = false;
        state.isAuthenticated = false;
      })
      // login
      .addCase(login.pending, (state)  => { state.loading = true; state.error = null; })
      .addCase(login.fulfilled, (state, action) => {
        state.loading         = false;
        state.isAuthenticated = !!action.payload.user;
        state.user            = action.payload.user;
        state.token           = action.payload.token;
      })
      .addCase(login.rejected, (state, action) => {
        state.loading = false;
        state.error   = action.payload as string;
      })
      // register
      .addCase(register.pending, (state)  => { state.loading = true; state.error = null; })
      .addCase(register.fulfilled, (state, action) => {
        state.loading         = false;
        state.isAuthenticated = !!action.payload.user;
        state.user            = action.payload.user;
        state.token           = action.payload.token;
      })
      .addCase(register.rejected, (state, action) => {
        state.loading = false;
        state.error   = action.payload as string;
      });
  },
});

export const { logout, clearError, setSession } = authSlice.actions;
export default authSlice.reducer;

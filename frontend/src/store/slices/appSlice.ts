import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { supabase } from '../../lib/supabase';

/**
 * App slice — data layer backed by Supabase (appmaker schema, RLS-protected).
 * All operations go straight to Postgres via supabase-js.
 * No Express backend required.
 *
 * The App interface keeps `_id` (string uuid) as the identifier so the rest of
 * the codebase (AppBuilder, Dashboard, AIPrompt, etc.) doesn't need updating.
 */

export interface App {
  _id: string;
  name: string;
  description?: string;
  type: 'web' | 'mobile' | 'api' | 'integration';
  status: 'draft' | 'active' | 'paused' | 'archived';
  owner?: string;
  configuration?: Record<string, any>;
  integrations?: {
    groq?: { enabled: boolean; connectedAt?: string; lastUsed?: string; usageCount?: number };
    [key: string]: any;
  };
  metadata?: {
    version?: string;
    tags?: string[];
    category?: string;
    isPublic?: boolean;
    media?: Array<{ type: 'image' | 'video'; url: string; thumbnail?: string }>;
  };
  statistics?: { views: number; interactions: number; lastAccessed?: string };
  generatedCode?: {
    files?: Array<{ path: string; content: string }>;
    shellCommands?: string[];
    frontend?: { structure?: Array<{ path: string; content: string; type?: string }> };
    backend?:  { structure?: Array<{ path: string; content: string; type?: string }> };
  };
  tests?: Record<string, any>;
  deployment?: {
    status?: 'not_deployed' | 'building' | 'deployed' | 'failed';
    url?: string;
    platform?: 'vercel' | 'netlify' | 'custom';
  };
  generation?: {
    prompt?: string;
    defaultProvider?: string;
    iterations?: Array<{
      prompt: string;
      generatedAt: string;
      changes?: string;
      provider?: string;
      model?: string;
      filesChanged?: string[];
      tokensUsed?: number;
      durationMs?: number;
      source?: string;
    }>;
    lastGenerated?: string;
    model?: string;
  };
  createdAt?: string;
  updatedAt?: string;
}

interface AppState {
  apps: App[];
  currentApp: App | null;
  loading: boolean;
  error: string | null;
}

const initialState: AppState = { apps: [], currentApp: null, loading: false, error: null };

/** Map a Postgres row (snake_case + jsonb) → App (camelCase + _id) */
function rowToApp(row: any): App {
  return {
    _id:           row.id,
    name:          row.name,
    description:   row.description,
    type:          row.type,
    status:        row.status,
    owner:         row.user_id,
    configuration: row.configuration,
    metadata:      row.metadata,
    statistics:    row.statistics,
    generatedCode: row.generated_code,
    tests:         row.tests,
    deployment:    row.deployment,
    generation:    row.generation,
    createdAt:     row.created_at,
    updatedAt:     row.updated_at,
  };
}

// ── Thunks ─────────────────────────────────────────────────────

export const fetchApps = createAsyncThunk('apps/fetchApps', async (_, { rejectWithValue }) => {
  const { data, error } = await supabase
    .schema('appmaker')
    .from('apps')
    .select('id,name,description,type,status,user_id,metadata,statistics,generation,deployment,created_at,updated_at')
    .order('updated_at', { ascending: false });
  if (error) return rejectWithValue(error.message);
  return (data ?? []).map(rowToApp);
});

export const fetchApp = createAsyncThunk('apps/fetchApp', async (id: string, { rejectWithValue }) => {
  // Main app row
  const { data: appRow, error: appErr } = await supabase
    .schema('appmaker')
    .from('apps')
    .select('*')
    .eq('id', id)
    .single();
  if (appErr || !appRow) return rejectWithValue(appErr?.message ?? 'Not found');

  // Iteration history
  const { data: iters } = await supabase
    .schema('appmaker')
    .from('iterations')
    .select('id,prompt,provider,model,files_changed,tokens_used,duration_ms,source,created_at')
    .eq('app_id', id)
    .order('created_at', { ascending: true });

  const app = rowToApp(appRow);
  app.generation = {
    ...app.generation,
    iterations: (iters ?? []).map(it => ({
      prompt:        it.prompt ?? '',
      generatedAt:   it.created_at,
      provider:      it.provider,
      model:         it.model,
      filesChanged:  it.files_changed ?? [],
      tokensUsed:    it.tokens_used,
      durationMs:    it.duration_ms,
      source:        it.source,
    })),
  };
  return app;
});

export const createApp = createAsyncThunk('apps/createApp', async (appData: Partial<App>, { rejectWithValue }) => {
  const { data: sessionData } = await supabase.auth.getSession();
  const userId = sessionData.session?.user.id;
  if (!userId) return rejectWithValue('Not authenticated');

  const { data, error } = await supabase
    .schema('appmaker')
    .from('apps')
    .insert({
      user_id:     userId,
      name:        appData.name || 'Untitled',
      description: appData.description,
      type:        appData.type ?? 'web',
      status:      appData.status ?? 'draft',
      metadata:    appData.metadata ?? {},
    })
    .select()
    .single();
  if (error || !data) return rejectWithValue(error?.message ?? 'Insert failed');
  return rowToApp(data);
});

export const updateApp = createAsyncThunk(
  'apps/updateApp',
  async ({ id, data: patch }: { id: string; data: Partial<App> }, { rejectWithValue }) => {
    const { data, error } = await supabase
      .schema('appmaker')
      .from('apps')
      .update({
        name:          patch.name,
        description:   patch.description,
        status:        patch.status,
        metadata:      patch.metadata,
        statistics:    patch.statistics,
        generated_code: patch.generatedCode,
        deployment:    patch.deployment,
        generation:    patch.generation,
        updated_at:    new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();
    if (error || !data) return rejectWithValue(error?.message ?? 'Update failed');
    return rowToApp(data);
  },
);

export const deleteApp = createAsyncThunk('apps/deleteApp', async (id: string, { rejectWithValue }) => {
  const { error } = await supabase.schema('appmaker').from('apps').delete().eq('id', id);
  if (error) return rejectWithValue(error.message);
  return id;
});

// Kept for compat — no-op (Groq calls now go through Edge Function, not here).
export const testGroq = createAsyncThunk('apps/testGroq', async (_id: string) => ({ id: _id, result: null }));

// ── Slice ───────────────────────────────────────────────────────

const appSlice = createSlice({
  name: 'apps',
  initialState,
  reducers: {
    setCurrentApp: (state, action: PayloadAction<App | null>) => { state.currentApp = action.payload; },
    clearError:    (state) => { state.error = null; },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchApps.pending,  (s) => { s.loading = true;  s.error = null; })
      .addCase(fetchApps.fulfilled,(s, a) => { s.loading = false; s.apps = a.payload; })
      .addCase(fetchApps.rejected, (s, a) => { s.loading = false; s.error = a.payload as string; })

      .addCase(fetchApp.pending,   (s) => { s.loading = true;  s.error = null; })
      .addCase(fetchApp.fulfilled, (s, a) => { s.loading = false; s.currentApp = a.payload; })
      .addCase(fetchApp.rejected,  (s, a) => { s.loading = false; s.error = a.payload as string; })

      .addCase(createApp.fulfilled,(s, a) => { s.apps.unshift(a.payload); })

      .addCase(updateApp.fulfilled,(s, a) => {
        const i = s.apps.findIndex(app => app._id === a.payload._id);
        if (i !== -1) s.apps[i] = a.payload;
        if (s.currentApp?._id === a.payload._id) s.currentApp = a.payload;
      })

      .addCase(deleteApp.fulfilled,(s, a) => {
        s.apps = s.apps.filter(app => app._id !== a.payload);
        if (s.currentApp?._id === a.payload) s.currentApp = null;
      });
  },
});

export const { setCurrentApp, clearError } = appSlice.actions;
export default appSlice.reducer;

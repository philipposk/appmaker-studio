import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import api from '../../services/api';

export interface App {
  _id: string;
  name: string;
  description?: string;
  type: 'web' | 'mobile' | 'api' | 'integration';
  status: 'draft' | 'active' | 'paused' | 'archived';
  owner?: string;
  configuration?: {
    provider?: 'aws' | 'azure' | 'google-cloud' | 'custom';
    groqAPIKey?: string;
    groqModel?: string;
    settings?: Record<string, any>;
  };
  integrations?: {
    groq?: {
      enabled: boolean;
      connectedAt?: string;
      lastUsed?: string;
      usageCount?: number;
    };
  };
  metadata?: {
    version?: string;
    tags?: string[];
    category?: string;
    isPublic?: boolean;
    media?: Array<{
      type: 'image' | 'video';
      url: string;
      thumbnail?: string;
    }>;
  };
  statistics?: {
    views: number;
    interactions: number;
    lastAccessed?: string;
  };
  generatedCode?: {
    frontend?: {
      code?: string;
      structure?: Array<{
        path: string;
        content: string;
        type?: string;
        name?: string;
      }>;
      dependencies?: Record<string, string> | Map<string, string>;
    };
    backend?: {
      code?: string;
      structure?: Array<{
        path: string;
        content: string;
        type?: string;
        name?: string;
      }>;
      dependencies?: Record<string, string> | Map<string, string>;
    };
    config?: {
      packageJson?: any;
      buildConfig?: any;
    };
  };
  tests?: {
    unitTests?: Array<{
      path: string;
      content: string;
      status?: 'pass' | 'fail' | 'pending';
      results?: any;
      lastRun?: string;
    }>;
    integrationTests?: Array<{
      path: string;
      content: string;
      status?: 'pass' | 'fail' | 'pending';
      results?: any;
      lastRun?: string;
    }>;
    testCoverage?: {
      lines?: number;
      functions?: number;
      branches?: number;
      statements?: number;
    };
  };
  deployment?: {
    status?: 'not_deployed' | 'building' | 'deployed' | 'failed';
    url?: string;
    buildId?: string;
    deployedAt?: string;
    platform?: 'vercel' | 'netlify' | 'custom';
    env?: Record<string, string> | Map<string, string>;
  };
  generation?: {
    prompt?: string;
    iterations?: Array<{
      prompt: string;
      generatedAt: string;
      changes?: string;
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

const initialState: AppState = {
  apps: [],
  currentApp: null,
  loading: false,
  error: null,
};

// Async thunks
export const fetchApps = createAsyncThunk(
  'apps/fetchApps',
  async (_, { rejectWithValue }) => {
    try {
      const response = await api.get('/apps');
      return response.data.apps;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch apps');
    }
  }
);

export const fetchApp = createAsyncThunk(
  'apps/fetchApp',
  async (id: string, { rejectWithValue }) => {
    try {
      const response = await api.get(`/apps/${id}`);
      return response.data.app;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch app');
    }
  }
);

export const createApp = createAsyncThunk(
  'apps/createApp',
  async (appData: Partial<App>, { rejectWithValue }) => {
    try {
      const response = await api.post('/apps', appData);
      return response.data.app;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || 'Failed to create app');
    }
  }
);

export const updateApp = createAsyncThunk(
  'apps/updateApp',
  async ({ id, data }: { id: string; data: Partial<App> }, { rejectWithValue }) => {
    try {
      const response = await api.put(`/apps/${id}`, data);
      return response.data.app;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || 'Failed to update app');
    }
  }
);

export const deleteApp = createAsyncThunk(
  'apps/deleteApp',
  async (id: string, { rejectWithValue }) => {
    try {
      await api.delete(`/apps/${id}`);
      return id;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || 'Failed to delete app');
    }
  }
);

export const testGroq = createAsyncThunk(
  'apps/testGroq',
  async (id: string, { rejectWithValue }) => {
    try {
      const response = await api.post(`/apps/${id}/test-groq`);
      return { id, result: response.data };
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || 'Failed to test Groq');
    }
  }
);

const appSlice = createSlice({
  name: 'apps',
  initialState,
  reducers: {
    setCurrentApp: (state, action: PayloadAction<App | null>) => {
      state.currentApp = action.payload;
    },
    clearError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      // Fetch Apps
      .addCase(fetchApps.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchApps.fulfilled, (state, action) => {
        state.loading = false;
        state.apps = action.payload;
      })
      .addCase(fetchApps.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      // Fetch App
      .addCase(fetchApp.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchApp.fulfilled, (state, action) => {
        state.loading = false;
        state.currentApp = action.payload;
      })
      .addCase(fetchApp.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      // Create App
      .addCase(createApp.fulfilled, (state, action) => {
        state.apps.unshift(action.payload);
      })
      // Update App
      .addCase(updateApp.fulfilled, (state, action) => {
        const index = state.apps.findIndex(app => app._id === action.payload._id);
        if (index !== -1) {
          state.apps[index] = action.payload;
        }
        if (state.currentApp?._id === action.payload._id) {
          state.currentApp = action.payload;
        }
      })
      // Delete App
      .addCase(deleteApp.fulfilled, (state, action) => {
        state.apps = state.apps.filter(app => app._id !== action.payload);
        if (state.currentApp?._id === action.payload) {
          state.currentApp = null;
        }
      });
  },
});

export const { setCurrentApp, clearError } = appSlice.actions;
export default appSlice.reducer;


import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import api from '../../services/api';

interface GenerationState {
  generating: boolean;
  error: string | null;
  generatedApp: any | null;
  progress: number;
}

const initialState: GenerationState = {
  generating: false,
  error: null,
  generatedApp: null,
  progress: 0,
};

// Generate app from prompt
export const generateApp = createAsyncThunk(
  'generation/generateApp',
  async (data: { prompt: string; appType?: string; groqAPIKey?: string }, { rejectWithValue }) => {
    try {
      const response = await api.post('/generate/generate', data);
      return response.data;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || 'Failed to generate app');
    }
  }
);

// Refine existing app
export const refineApp = createAsyncThunk(
  'generation/refineApp',
  async (data: { 
    id: string; 
    prompt: string; 
    targetType?: 'component' | 'styling' | 'bug' | 'feature';
    targetComponent?: string;
  }, { rejectWithValue }) => {
    try {
      const response = await api.post(`/generate/refine/${data.id}`, {
        prompt: data.prompt,
        targetType: data.targetType,
        targetComponent: data.targetComponent
      });
      return response.data;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || 'Failed to refine app');
    }
  }
);

// Download app as ZIP
export const downloadApp = createAsyncThunk(
  'generation/downloadApp',
  async (id: string, { rejectWithValue }) => {
    try {
      const response = await api.get(`/generate/${id}/download`, {
        responseType: 'blob'
      });
      // Create download link
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `app-${id}.zip`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      return { success: true };
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || 'Failed to download app');
    }
  }
);

const generationSlice = createSlice({
  name: 'generation',
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null;
    },
    setProgress: (state, action: PayloadAction<number>) => {
      state.progress = action.payload;
    },
    clearGeneratedApp: (state) => {
      state.generatedApp = null;
    },
  },
  extraReducers: (builder) => {
    builder
      // Generate App
      .addCase(generateApp.pending, (state) => {
        state.generating = true;
        state.error = null;
        state.progress = 0;
      })
      .addCase(generateApp.fulfilled, (state, action) => {
        state.generating = false;
        state.generatedApp = action.payload.app;
        state.progress = 100;
      })
      .addCase(generateApp.rejected, (state, action) => {
        state.generating = false;
        state.error = action.payload as string;
        state.progress = 0;
      })
      // Refine App
      .addCase(refineApp.pending, (state) => {
        state.generating = true;
        state.error = null;
      })
      .addCase(refineApp.fulfilled, (state, action) => {
        state.generating = false;
        state.generatedApp = action.payload.app;
      })
      .addCase(refineApp.rejected, (state, action) => {
        state.generating = false;
        state.error = action.payload as string;
      });
  },
});

export const { clearError, setProgress, clearGeneratedApp } = generationSlice.actions;
export default generationSlice.reducer;


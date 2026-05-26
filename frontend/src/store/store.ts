import { configureStore } from '@reduxjs/toolkit';
import authSlice from './slices/authSlice';
import appSlice from './slices/appSlice';
import themeSlice from './slices/themeSlice';
import generationSlice from './slices/generationSlice';

export const store = configureStore({
  reducer: {
    auth: authSlice,
    apps: appSlice,
    theme: themeSlice,
    generation: generationSlice,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;


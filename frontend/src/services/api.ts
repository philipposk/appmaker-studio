import axios from 'axios';
import { supabase } from '../lib/supabase';

/**
 * Legacy axios client. Auth moved to Supabase (cookie session), so this
 * attaches the Supabase access token instead of the old localStorage 'token'.
 *
 * NOTE: the Express backend this pointed at is gone. Remaining callers
 * (legacy generate/refine/download, Deploy, Test) are being migrated to
 * Supabase / WebContainer. This client no longer hard-redirects on 401 —
 * the old behaviour bounced users out of the app to a backend that no
 * longer exists. Callers must handle their own errors.
 */
const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL || 'http://localhost:8000/api',
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use(
  async (config) => {
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (token) config.headers.Authorization = `Bearer ${token}`;
    } catch {
      /* unauthenticated — leave the header off */
    }
    return config;
  },
  (error) => Promise.reject(error),
);

api.interceptors.response.use(
  (response) => response,
  (error) => Promise.reject(error),
);

export default api;

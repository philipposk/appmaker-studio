import { createClient } from '@supabase/supabase-js';

/**
 * Supabase client for AppMaker (CRA / browser-only).
 *
 * Uses cookie-based session storage scoped to `.6x7.gr` so the shared
 * Supabase auth token is readable by every subdomain (school, timegift, etc.).
 * localStorage would isolate the session to appmaker.6x7.gr only — that
 * breaks SSO, so we use cookies instead.
 *
 * In local dev (localhost) the domain is left unset — browsers ignore
 * domain on localhost, which is correct behaviour.
 */

const SUPABASE_URL  = process.env.REACT_APP_SUPABASE_URL  as string;
const SUPABASE_ANON = process.env.REACT_APP_SUPABASE_ANON_KEY as string;

const isProd = window.location.hostname.endsWith('.6x7.gr') ||
               window.location.hostname === '6x7.gr';

const COOKIE_DOMAIN  = isProd ? '.6x7.gr' : undefined;
const COOKIE_SECURE  = isProd;
const COOKIE_NAME    = 'sb-6x7-auth';  // shared across all 6x7.gr subdomains

/** Minimal cookie helpers */
function setCookie(name: string, value: string, days = 365) {
  const expires = new Date(Date.now() + days * 864e5).toUTCString();
  let cookie = `${name}=${encodeURIComponent(value)}; expires=${expires}; path=/; SameSite=Lax`;
  if (COOKIE_DOMAIN) cookie += `; Domain=${COOKIE_DOMAIN}`;
  if (COOKIE_SECURE) cookie += `; Secure`;
  document.cookie = cookie;
}

function getCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

function deleteCookie(name: string) {
  let cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
  if (COOKIE_DOMAIN) cookie += `; Domain=${COOKIE_DOMAIN}`;
  document.cookie = cookie;
}

/** Custom storage adapter — cookies instead of localStorage */
const cookieStorage = {
  getItem: (key: string): string | null => {
    return getCookie(`${COOKIE_NAME}-${key}`);
  },
  setItem: (key: string, value: string): void => {
    setCookie(`${COOKIE_NAME}-${key}`, value);
  },
  removeItem: (key: string): void => {
    deleteCookie(`${COOKIE_NAME}-${key}`);
  },
};

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON, {
  auth: {
    storage: cookieStorage,
    storageKey: 'session',
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,       // handles OAuth callback ?code= URLs
  },
});

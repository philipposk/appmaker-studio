import { createBrowserClient } from '@supabase/ssr';

/**
 * Supabase client for AppMaker (CRA / browser SPA).
 *
 * Uses @supabase/ssr's createBrowserClient — the SAME library the platform's
 * Next.js apps (hub, timegift, smoking, paperassistant…) use. This matters:
 * it writes the session into cookies using the standard Supabase naming and
 * chunking scheme (`sb-<project-ref>-auth-token`, split into `.0`/`.1` when
 * larger than a single cookie). Because every 6x7 app uses the identical
 * library + project ref, the cookies are byte-compatible, which is what makes
 * cross-subdomain single-sign-on actually work.
 *
 * Cookie domain is set to `.6x7.gr` in production so every subdomain reads the
 * same session; left unset on localhost (browsers ignore Domain on localhost).
 *
 * Replaces the previous hand-rolled cookie adapter, which (a) used a cookie
 * name no other 6x7 app would read, and (b) wrote the whole session into one
 * cookie with no chunking — silently dropped for OAuth / rich-metadata users
 * once it exceeded the ~4KB browser limit. See audit findings #2 and #4.
 *
 * SSO CONTRACT (must match every 6x7.gr property — see DEPLOY.md):
 *   library:  @supabase/ssr  ·  cookie domain: .6x7.gr  ·  sameSite: lax
 *   cookie base name: sb-<project-ref>-auth-token  (chunked .0/.1/…)
 */

const SUPABASE_URL  = process.env.REACT_APP_SUPABASE_URL  as string;
const SUPABASE_ANON = process.env.REACT_APP_SUPABASE_ANON_KEY as string;

const host = typeof window !== 'undefined' ? window.location.hostname : '';
const isProd = host.endsWith('.6x7.gr') || host === '6x7.gr';

export const supabase = createBrowserClient(SUPABASE_URL, SUPABASE_ANON, {
  cookieOptions: {
    // Shared across all 6x7.gr subdomains in prod; host-only on localhost.
    domain: isProd ? '.6x7.gr' : undefined,
    path: '/',
    sameSite: 'lax',
    secure: isProd,
  },
});

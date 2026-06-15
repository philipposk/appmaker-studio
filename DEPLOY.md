# Deploying AppMaker

AppMaker runs on the **6x7 platform**: a React frontend on **Vercel**, shared
**Supabase** for auth + database, and one **Supabase Edge Function** for LLM
streaming. There is no separate backend server to host — the old Express/Mongo
setup was replaced. (Those files still exist under `backend/` + `docker-compose.yml`
as a legacy alternative, but the platform path below is the supported one.)

```
appmaker.6x7.gr ──► Vercel (this repo: frontend/)
                      │  reads/writes
                      ▼
                shared Supabase "6x7" project
                  • auth.users (shared login across *.6x7.gr)
                  • appmaker schema (apps, iterations) + RLS
                  • Edge Function appmaker-stream (LLM proxy)
generated app preview/tests ──► runs in the browser (WebContainer)
```

## Prerequisites

- Access to the shared Supabase project **`6x7`** (`fmrnqepyyjucnfbrqawl`).
  The `appmaker` schema, RLS, and the `appmaker-stream` Edge Function are
  already provisioned.
- A Vercel account linked to this GitHub repo.
- DNS control for `6x7.gr`.

## 1. Frontend → Vercel

1. New Project → import `philipposk/AppMaker-vibecode`.
2. **Root directory:** `frontend`. Framework preset: Create React App.
   (`frontend/vercel.json` already sets the SPA rewrite + the COOP/COEP headers
   the in-browser preview needs.)
3. Environment variables:
   ```
   REACT_APP_SUPABASE_URL      = https://fmrnqepyyjucnfbrqawl.supabase.co
   REACT_APP_SUPABASE_ANON_KEY = <publishable anon key from Supabase>
   CI                          = false   # so ESLint warnings don't fail the build
   ```
   The anon key is public-safe — RLS protects every row. Do **not** put the
   service-role key in the frontend.
4. Deploy.

## 2. Custom domain

- Vercel project → Settings → Domains → add `appmaker.6x7.gr`. Vercel gives a
  CNAME target.
- At the `6x7.gr` DNS provider: `CNAME  appmaker  →  <vercel target>`.

## 3. Supabase auth config (once, platform-wide)

In the `6x7` project's Auth settings:
- Site URL: `https://6x7.gr`
- Redirect URLs include: `https://*.6x7.gr/**`
- Enable Google + email providers.

## SSO cookie contract (must match every 6x7.gr app)

Cross-subdomain single-sign-on only works if **every** 6x7 property writes the
session cookie identically. AppMaker uses `@supabase/ssr`'s `createBrowserClient`
(`frontend/src/lib/supabase.ts`) — the same library the Next.js apps use — so
cookies are byte-compatible:

| Property | Value |
|----------|-------|
| Library | `@supabase/ssr` (both SPA and Next.js apps) |
| Cookie base name | `sb-<project-ref>-auth-token` (chunked `.0`/`.1`…) |
| Domain | `.6x7.gr` (prod) · unset on localhost |
| SameSite | `lax` · Secure in prod |

If the hub or another app uses a different library/storageKey/domain, login
won't carry across subdomains — verify there before assuming SSO works.

> **Security note (audit #14):** the session cookie is JS-readable and scoped to
> all of `.6x7.gr`, so an XSS on any subdomain can read the shared refresh token.
> Enforce a strict CSP on every 6x7.gr property; consider shortening cookie
> lifetime toward the refresh-rotation window.

## What runs where

| Concern | Where |
|---------|-------|
| UI, routing | Vercel static build |
| Login, session | Supabase Auth (shared cookie) |
| Apps + history | `appmaker.apps` / `appmaker.iterations` (RLS), via `supabase-js` |
| LLM code streaming | Edge Function `appmaker-stream` (Bearer = user session) |
| Live preview, tests, `npm install` | the **browser** (WebContainer) |
| Export `.zip` | the **browser** (JSZip) |

## Post-deploy checklist

- [ ] `https://appmaker.6x7.gr` loads, login works
- [ ] After login, generate an app → Code/Preview tabs populate (loop intact)
- [ ] Log in on the hub, open `appmaker.6x7.gr` in the same browser → still authed (SSO)
- [ ] Provider key entry (Provider Settings) → generation streams
- [ ] Download `.zip` produces a runnable project

## Legacy self-host (optional)

The original standalone stack (Express + MongoDB) still exists: `backend/`,
`backend/Dockerfile`, `frontend/Dockerfile`, `docker-compose.yml`. It is **not**
the platform path and is unmaintained; use only if running AppMaker fully
detached from the 6x7 platform.

# Deploying AppMaker

This guide takes AppMaker from "works on my laptop" to "live at
**appmaker.6x7.gr**". It assumes no prior DevOps experience — every term is
explained the first time it shows up.

AppMaker has **three moving parts**:

| Part | What it is | Where it runs |
|------|-----------|---------------|
| **Frontend** | The website people see (React) | Static files served by nginx |
| **Backend** | The API behind it (Node/Express) | A long-running server process |
| **Database** | Where users & apps are stored (MongoDB) | MongoDB Atlas (managed) or a container |

You have two realistic ways to host it. Pick one:

- **Path A — one server, Docker (recommended).** Everything runs on a single
  machine you control (a VPS — a rented Linux server). One command starts all
  three parts. Best fit since you already own the `6x7.gr` domain.
- **Path B — managed platforms.** The backend runs on Render, the frontend on
  Vercel/Netlify, the database on MongoDB Atlas. No server to maintain, but
  more dashboards and (past free tiers) more cost.

---

## Before you start (both paths)

1. **A MongoDB database.** The easiest is **MongoDB Atlas** — a free,
   hosted database (no install). Sign up at <https://www.mongodb.com/atlas>,
   create a free "M0" cluster, add a database user, and copy the connection
   string. It looks like:
   ```
   mongodb+srv://USER:PASSWORD@cluster0.xxxx.mongodb.net/appmaker
   ```
   (Path A can also just run MongoDB in a container — see below — so you can
   skip Atlas if you prefer everything on one box.)

2. **A JWT secret.** This is a long random password the server uses to sign
   login tokens. Generate one:
   ```bash
   openssl rand -hex 32
   ```
   Keep it private. If it leaks, anyone can forge logins.

3. **An LLM key is optional.** Users can paste their own key in the app's
   Provider Settings (it stays in their browser). Only set `GROQ_API_KEY` on
   the server if you want a shared default key.

---

## Path A — one server with Docker (recommended)

**What you need:** a VPS running Linux (e.g. a small DigitalOcean / Hetzner /
Linode droplet), with Docker installed. "Docker" packages each part into a
self-contained box (a *container*) so you don't install Node, nginx, or Mongo
by hand.

### 1. Get the code onto the server
```bash
git clone https://github.com/philipposk/AppMaker-vibecode.git
cd AppMaker-vibecode
```

### 2. Create one `.env` file at the repo root
This feeds secrets into `docker-compose.yml`. Create a file named `.env`:
```bash
JWT_SECRET=<paste the openssl value here>
JWT_EXPIRE=7d
GROQ_API_KEY=                       # optional
FRONTEND_URL=https://appmaker.6x7.gr
REACT_APP_API_URL=https://appmaker.6x7.gr/api
```
> The bundled `docker-compose.yml` already runs MongoDB in a container, so you
> don't need Atlas for this path. If you *do* want Atlas, delete the `mongo`
> service from the compose file and set `MONGODB_URI` to your Atlas string.

### 3. Start everything
```bash
docker compose up -d --build
```
- `-d` = run in the background.
- `--build` = build the images first.

This brings up MongoDB, the API (port **8000**), and the web UI (port
**8080**). Check it's alive:
```bash
curl http://localhost:8000/api/health      # -> {"status":"ok",...}
```

### 4. Put it on the internet at appmaker.6x7.gr
The containers listen on `localhost`. You need a **reverse proxy** (a front
door that accepts public HTTPS traffic and forwards it inside). Easiest is
**Caddy**, which also gets you a free HTTPS certificate automatically.

Install Caddy, then create `/etc/caddy/Caddyfile`:
```
appmaker.6x7.gr {
    handle /api/* {
        reverse_proxy localhost:8000
    }
    handle {
        reverse_proxy localhost:8080
    }
}
```
Reload Caddy (`sudo systemctl reload caddy`). Caddy fetches an HTTPS cert on
first request.

### 5. Point DNS
In your `6x7.gr` DNS settings, add an **A record**:
```
Type: A    Name: appmaker    Value: <your server's public IP>
```
Give it a few minutes, then open **https://appmaker.6x7.gr**.

### Updating later
```bash
git pull
docker compose up -d --build
```

---

## Path B — managed platforms

### Database
Use **MongoDB Atlas** (see "Before you start"). Copy the connection string.

### Backend on Render
[Render](https://render.com) runs the API for you.
1. New → **Web Service** → connect the GitHub repo.
2. Root directory: `backend`. Render auto-detects the `Dockerfile`.
3. Add environment variables (from `backend/.env.example`):
   `MONGODB_URI`, `JWT_SECRET`, `JWT_EXPIRE`, `FRONTEND_URL`
   (= `https://appmaker.6x7.gr`), optionally `GROQ_API_KEY`.
   **Do not** set `PORT` — Render provides it.
4. Deploy. Note the URL, e.g. `https://appmaker-api.onrender.com`.

### Frontend on Vercel or Netlify
1. New project → import the repo. Root directory: `frontend`.
2. Build command `npm run build`, output directory `build`.
3. Environment variable:
   `REACT_APP_API_URL = https://appmaker-api.onrender.com/api`
4. If the build fails on lint warnings, add `CI = false`.
5. Add `appmaker.6x7.gr` as a custom domain and follow their DNS instructions
   (usually a CNAME record on `6x7.gr`).

> ⚠️ The **in-browser preview (WebContainer)** needs two special HTTP headers
> (`Cross-Origin-Opener-Policy` and `Cross-Origin-Embedder-Policy`). Path A's
> nginx sets these for you. On Vercel/Netlify you must add them yourself via
> their headers config, or the live-preview tab won't boot.

---

## Environment variable reference

**Backend** (`backend/.env.example`)

| Variable | Required | Meaning |
|----------|----------|---------|
| `PORT` | no | API port (default 8000; managed hosts set this) |
| `NODE_ENV` | yes | `production` in prod |
| `MONGODB_URI` | yes | MongoDB connection string |
| `JWT_SECRET` | yes | Random secret for signing login tokens |
| `JWT_EXPIRE` | no | Token lifetime, e.g. `7d` |
| `GROQ_API_KEY` | no | Optional shared LLM key |
| `FRONTEND_URL` | yes | Allowed site origin(s) for CORS, comma-separated |

**Frontend** (`frontend/.env.example`)

| Variable | Required | Meaning |
|----------|----------|---------|
| `REACT_APP_API_URL` | yes | Backend base URL **including `/api`** |
| `REACT_APP_GROQ_API_KEY` | no | Baked-in key — avoid on public sites |

---

## Post-deploy checklist

- [ ] `https://appmaker.6x7.gr` loads the UI
- [ ] `https://appmaker.6x7.gr/api/health` returns `{"status":"ok","db":"connected"}`
- [ ] Register a user, log in, generate an app end-to-end
- [ ] `FRONTEND_URL` matches the real domain (otherwise the browser blocks API
      calls with a CORS error)
- [ ] `.env` is **not** committed (it's gitignored — keep it that way)
- [ ] `JWT_SECRET` is long and random, not the example value

---

## Known limitations before opening to the public

AppMaker is at version 0.1. Built-in protections so far: rate limiting,
security headers (helmet), request size limits, CORS allow-listing. **Not yet
built**: email verification, password reset, billing/quota enforcement, and
abuse monitoring on the code-generation endpoints. Fine for a demo or invite
-only beta; add those before a wide public launch.

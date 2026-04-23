# Deploying VolleyIQ

The simplest path: **one Railway service** hosts everything (Express + SQLite
+ the built Vite client). If you later want the client on a CDN, there's a
split-deploy recipe further down.

---

## Option A — Single host on Railway (recommended)

### 1. Create the service

1. [railway.app](https://railway.app) → **New Project** → **Deploy from
   GitHub** → pick this repo, branch `claude/build-vol-platform-clone-yHkf5`
   (or whichever branch you merge to `main`).
2. In the service **Settings**:
   - Build command: `npm install && npm run build`
   - Start command: `npm start`
   - (Railway's Nixpacks auto-detects Node 20 from `engines`.)

### 2. Persistent volume for SQLite

Railway's container filesystem is wiped on every redeploy. Mount a volume.

1. Service → **Volumes** → **New Volume** → mount path `/data`.
2. Set env var `DATABASE_URL=/data/volleyiq.db`.

Without this, every deploy starts with an empty database.

### 3. Environment variables

Minimum to boot (stays in dev-bypass mode, good for first smoke test):

```
NODE_ENV=production
DATABASE_URL=/data/volleyiq.db
DEV_AUTH_BYPASS=true
```

Layer on once it's alive:

```
ANTHROPIC_API_KEY=sk-ant-...            # real AI instead of mocks
FIRESTORE_MIRROR=true                   # enables Second Screen realtime
FIREBASE_SERVICE_ACCOUNT_JSON={...}     # paste the whole service account JSON
```

Client-side Firebase vars ALSO live on the Railway service (they're read at
build time by Vite):

```
VITE_USE_DEV_AUTH=true                  # matches DEV_AUTH_BYPASS for dev
# When you swap to real Firebase:
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=volleyiq-xxx.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=volleyiq-xxx
VITE_FIREBASE_APP_ID=1:...:web:...
```

### 4. Deploy and verify

Railway gives you a URL like `https://volleyiq-production-xxxx.up.railway.app`.

```bash
curl https://<url>/api/health
# → {"ok":true,"version":"0.1.0"}
```

Open the URL in a browser — you should see the dashboard (dev-bypass auto
creates a seed team on first load).

### 5. Custom domain

Service → **Settings → Domains** → **Add custom domain**. Railway shows the
CNAME to add at your DNS provider. HTTPS is provisioned automatically.

### 6. Turn off dev-bypass before going public

**Do not leave `DEV_AUTH_BYPASS=true` on a production URL** — anyone who
finds the link has full admin.

1. Firebase console → enable Email/Password + Google sign-in.
2. Project Settings → Service accounts → generate a new private key.
3. On Railway:
   - Remove `DEV_AUTH_BYPASS` and `VITE_USE_DEV_AUTH`.
   - Add `FIREBASE_SERVICE_ACCOUNT_JSON` (paste the whole JSON).
   - Add `VITE_FIREBASE_API_KEY` / `_AUTH_DOMAIN` / `_PROJECT_ID` / `_APP_ID`.
4. Redeploy. Open in incognito — you should land on the login screen.

---

## Option B — Split deploy: Vercel (client) + Railway (API)

Use this if you want preview deploys per PR or CDN-backed static hosting.

1. Deploy the API to Railway using **Option A steps 1–4**, but Railway only
   serves `/api/*` in this mode (the Express static fallback still returns
   `index.html` to non-API requests — harmless, but Vercel won't hit it).
2. On **Railway**, set `ALLOWED_ORIGINS` to your Vercel URL(s), comma-
   separated. Include both the production URL and preview URLs if you rely
   on them:
   ```
   ALLOWED_ORIGINS=https://your-app.vercel.app,https://your-custom-domain.com
   ```
3. On **Vercel**, pick one of these two wiring options:

   **B.1 — Direct (recommended).** Set `VITE_API_URL` to the Railway URL:
   ```
   VITE_API_URL=https://<your-railway>.up.railway.app
   ```
   The client will send requests straight to Railway with the Firebase
   Bearer token attached. No `vercel.json` rewrite needed — you can delete
   the `rewrites` block or leave it empty. CORS is handled by
   `ALLOWED_ORIGINS` on the backend.

   **B.2 — Vercel rewrite.** Leave `VITE_API_URL` empty and edit
   `vercel.json`, replacing the placeholder Railway URL:
   ```json
   "destination": "https://<your-railway>.up.railway.app/api/:path*"
   ```
   Commit and push. The request stays same-origin from the browser's point
   of view; Vercel's edge forwards it server-side (Authorization header
   included). `ALLOWED_ORIGINS` isn't required for this path since the
   browser never talks to Railway directly.

4. [vercel.com](https://vercel.com) → **Import Project** → pick this repo.
   Vercel reads `vercel.json` and auto-configures Vite + output dir
   `dist/client`.
5. **Vercel env vars** (Settings → Environment Variables). All `VITE_*`
   vars are inlined at build time, so add them under *Production* (and
   *Preview*, if you want previews to work):
   ```
   VITE_API_URL=https://<your-railway>.up.railway.app   # only for B.1
   VITE_FIREBASE_API_KEY=...
   VITE_FIREBASE_AUTH_DOMAIN=<project>.firebaseapp.com
   VITE_FIREBASE_PROJECT_ID=<project>
   VITE_FIREBASE_APP_ID=1:...:web:...
   ```
   If you're using real Firebase auth, **do not** set `VITE_USE_DEV_AUTH`.
   If Railway has `DEV_AUTH_BYPASS=true`, Vercel must also have
   `VITE_USE_DEV_AUTH=true` — mismatched sides produce 401s.
6. Vercel → Settings → Domains → add your custom domain.
7. In the Firebase console → *Authentication → Settings → Authorized
   domains*, add your Vercel URL and custom domain. Without this, Google
   popup login fails silently and `currentUser` stays null.

Tradeoff vs. Option A: two dashboards to manage, two deploys per change that
touches both sides. Pro: PR previews, CDN, zero frontend cold-starts.

---

## Optional — Firestore mirror

The Second Screen view (`/#/second-screen/:matchId`) subscribes to Firestore
live when the server-side mirror is on, otherwise falls back to 2s polling.

1. Firebase console → enable Firestore in Native mode (eu-west3 for low
   latency from Portugal).
2. Railway: set `FIRESTORE_MIRROR=true` and ensure
   `FIREBASE_SERVICE_ACCOUNT_JSON` is set. Redeploy.
3. Firestore security rules starter (only admin SDK writes, clients
   read-only):
   ```
   rules_version = '2';
   service cloud.firestore {
     match /databases/{db}/documents {
       match /matches/{matchId}/actions/{doc} {
         allow read: if request.auth != null;
         allow write: if false;
       }
     }
   }
   ```

---

## Checklist before going public

- [ ] `DEV_AUTH_BYPASS` removed from Railway
- [ ] `VITE_USE_DEV_AUTH` removed from Railway/Vercel
- [ ] Firebase Auth credentials set on both sides
- [ ] SQLite backed by a Railway volume (not container FS)
- [ ] `ANTHROPIC_API_KEY` set if you want real AI output
- [ ] Custom domain DNS propagated, HTTPS green padlock
- [ ] Smoke test: login → dashboard → create match → live scout

## Troubleshooting

- **`ERR_MODULE_NOT_FOUND` at startup** — you're on an older revision where
  `npm start` ran `node dist/server/index.js`. Pull the latest branch: the
  start script now uses `tsx` which resolves `@shared/*` and ESM extensions
  correctly at runtime.
- **Dashboard renders but `/api/*` returns HTML** — your Vercel rewrite in
  `vercel.json` is pointing at the placeholder URL. Replace it with the
  Railway URL and redeploy Vercel.
- **`401 Missing bearer token` on `/api/teams`** (split deploy) — the
  request reached the API without an `Authorization` header. Common causes:
  (1) `VITE_FIREBASE_*` env vars are missing on Vercel, so the web SDK
  can't sign the user in and `getIdToken()` returns null; (2) your Vercel
  URL isn't in Firebase → Authentication → Authorized domains, so the
  login popup fails silently; (3) Railway has `DEV_AUTH_BYPASS=true` but
  Vercel doesn't have `VITE_USE_DEV_AUTH=true` (or vice versa). The client
  now throws a clear *"Not signed in"* error instead of firing a headerless
  request — check the browser devtools console for that.
- **`401 Missing bearer token` when calling Railway directly from the
  browser** — you need `ALLOWED_ORIGINS` set on Railway to include your
  Vercel origin, and `VITE_API_URL` set on Vercel to the Railway URL.
- **`better-sqlite3` native build fails on Railway** — usually means Node 18
  is being picked. `engines.node` in `package.json` requests 20+; make sure
  Nixpacks isn't overriden. You can force it with a `.nvmrc` file at the
  repo root containing `20`.
- **DB state disappears between deploys** — you didn't attach a volume at
  `/data` or `DATABASE_URL` isn't pointing at the volume.

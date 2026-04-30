# LS Argentina Daily Builder

Internal tool for the Latin Securities Sales & Trading desk to compose, preview, and send the **Argentina Daily** market email. Single-page app deployed on Vercel; persistence via Supabase; email delivery via SendGrid.

---

## Daily workflow

1. Log in (Supabase email + password, restricted to `@latinsecurities.ar`).
2. **Analysts** tab — update ratings, TPs, last prices for the coverage universe (one-click "Fetch Closing Prices" pulls from Yahoo Finance).
3. **Editor** tab — fill in today's content:
   - **General** — date, summary bar, what to watch
   - **Macro / Political** — multiple blocks, each with body + LS view + news links
   - **Trade Ideas** — equity picks (autopopulate from Analyst DB) + FI ideas
   - **Flows** — desk colour
   - **Corporate** — earnings notes per ticker
   - **Signatures**
   - Optional: snapshot, top movers, BCRA dashboard, events, chart of the day
4. **Preview** tab or live-preview pane — see the email rendered.
5. **AI Review** (optional) — runs the BBG output through Claude for a quality check.
6. **Send Email** panel:
   - Import recipients from a SendGrid list (or add manually)
   - Confirmation modal shows total / domains / sample / iframe preview
   - Type `SEND` to confirm — fires the multipart (text+HTML) send via `/api/send-email`
7. **Copy BBG** → paste into Bloomberg MSG / WhatsApp.

Drafts auto-save to Supabase every few seconds; an "✓ Saved Xs ago" indicator and a beforeunload guard protect against lost work.

---

## Quick start (local)

```bash
npm install
cp .env.local.example .env.local        # fill in the env vars (see below)
npm run dev                              # Vite dev server on :5173
```

For `/api/*` endpoints to work locally, run with the Vercel CLI instead of plain Vite:

```bash
npm i -g vercel
vercel dev
```

### Useful scripts

| Command | What it does |
|---|---|
| `npm run dev` | Vite dev server (UI only, `/api/*` will 404) |
| `npm run typecheck` | `tsc --noEmit` over the whole repo |
| `npm test` | Runs the Vitest suite (132 tests) |
| `npm run test:watch` | Vitest in watch mode |
| `npm run build` | Production build to `dist/` |

CI on every PR runs typecheck + tests + build (`.github/workflows/ci.yml`).

---

## Environment variables

`.env.local.example` is the canonical list. Quick reference:

### Required for the app to function

| Name | Set in | Purpose |
|---|---|---|
| `VITE_SUPABASE_URL` | Vercel + local | Supabase project URL — gates login + autosaves drafts |
| `VITE_SUPABASE_ANON_KEY` | Vercel + local | Supabase anon key |
| `SENDGRID_API_KEY` | Vercel + local | Used by `/api/send-email`, `/api/sendgrid-lists`, `/api/unsubscribe` |
| `SENDGRID_FROM_EMAIL` | Vercel + local | "From" address on outgoing mail (e.g. `daily@latinsecurities.ar`) |
| `ANTHROPIC_API_KEY` | Vercel + local | AI Draft + AI Review tabs |

### Optional

| Name | Set in | Purpose |
|---|---|---|
| `VITE_SENTRY_DSN` | Vercel | Pipes runtime errors to Sentry. Without this, errors surface only in browser console + ErrorBoundary fallback UI. |
| `VITE_SENTRY_RELEASE` | Vercel | Optional release tag (e.g. commit SHA) for Sentry's release-tracking. |
| `KV_URL`, `KV_REST_API_URL`, `KV_REST_API_TOKEN`, `KV_REST_API_READ_ONLY_TOKEN` | Vercel | Vercel KV / Upstash Redis credentials — when set, `/api/send-email` rate-limits failed-PIN attempts (10 per IP per 15 min). Without these the endpoint still works, just no throttle. |
| `CORS_ALLOWED_ORIGINS` | Vercel | Comma-separated origin allowlist for cross-origin API calls. Empty = same-origin only (the recommended default for an internal tool). |
| `ALPHA_VANTAGE_API_KEY` | Vercel | Fallback price source when Yahoo is rate-limited. |

---

## Security model

Two-layer auth on the send endpoint (everything else is read-only and rate-limited at the CDN):

1. **Page-level login** (`LoginGate.tsx`) — Supabase email/password, restricted to the `@latinsecurities.ar` domain. Without a valid session you don't see the app at all.
2. **Send authorization** (`api/send-email.js`):
   - **Required**: `Authorization: Bearer <Supabase JWT>` — the server calls `supabase.auth.getUser(token)` and checks the email domain. No fallback PIN — there is exactly one valid auth path.
   - **Rate limit**: 10 failed attempts per IP per 15 min via Redis (when `REDIS_URL` is configured).
   - **CORS**: `Access-Control-Allow-Origin` allowlisted via `CORS_ALLOWED_ORIGINS` — defaults to same-origin only.

In the UI:
- Header chip shows the authenticated user's email at all times.
- The send-confirmation modal labels the auth method (green = active session, red = none) and the user must type `SEND` to enable the destructive button.
- A pre-send re-check refreshes the session in case it expired while the modal was open.

Per-recipient unsubscribe link is rendered in the email footer with the `__LS_RECIPIENT_EMAIL__` substitution token; SendGrid replaces it per-personalization so each recipient gets a pre-filled URL.

---

## Deploy

### Vercel (recommended)

1. Push to GitHub.
2. [vercel.com/new](https://vercel.com/new) → import the repo.
3. Vercel auto-detects Vite — click **Deploy**.
4. **Settings → Environment Variables** → add the vars from the table above.
5. Trigger a redeploy (`Deployments` → `⋯` → Redeploy → uncheck "Use existing Build Cache" so the new env vars get baked into the bundle).

Subsequent pushes to `main` auto-deploy.

### Vercel CLI

```bash
npm i -g vercel
vercel              # first run links the project
vercel --prod       # deploy to production
```

---

## Tech stack

- **React 18** + **Vite 5**
- **Zustand** + **zundo** (state, undo/redo)
- **Supabase** (auth, draft persistence, email logs)
- **SendGrid** (mail delivery, list import, suppressions)
- **TailwindCSS 4** + inline styles (mixed; Tailwind for layout-y stuff, inline for dynamic colours)
- **@dnd-kit** (drag-to-reorder)
- **react-window** (virtualised recipient list above 100 rows)
- **Sentry** (error reporting, opt-in via env var)
- **Vercel KV / Upstash Redis** (rate limiting, opt-in via env var)
- **Vitest** + **@testing-library/react** + **happy-dom** (132 tests)
- **TypeScript 6** strict, 0 errors

---

## Repo layout

```
api/                  Vercel serverless functions (one file per route)
  _helpers.js         Shared CORS allowlist + fetchWithRetry
  _rateLimit.js       Vercel KV-backed rate limiter
  send-email.js       Mass-mail handler (auth + rate limit + multipart MIME)
  unsubscribe.js      Branded unsubscribe form + SendGrid suppression
  sendgrid-lists.js   List + contact export polling
  …                   (analytics, ai-draft, bcra, prices, snapshot, etc.)
src/
  components/         UI components, panels, sections
  hooks/              useKeyboardShortcuts, useUnsavedChangesGuard,
                      useCurrentUser, useOnlineStatus, useUrlPasteHint
  lib/                sendgridApi, recipientsApi, dailyApi, sentry, supabase…
  store/              useDailyStore (zustand), useUIStore, useToastStore
  utils/              generateHTML, generateBBG, dates, prices, ratings, text…
  __tests__/          Vitest suites + RTL component tests + HTML snapshots
public/               Static assets (logo, manifest, vite icon)
.github/workflows/    CI (typecheck + tests + build on every PR)
```

---

## Brand colours

| Token   | Hex       |
|---------|-----------|
| Navy    | `#000039` |
| Blue    | `#1e5ab0` |
| Sky     | `#3399ff` |
| Teal    | `#23a29e` |
| Salmon  | `#ebaca2` |
| Green   | `#acd484` |
| Orange  | `#ffbe65` |

---

## Useful keyboard shortcuts

Press `?` anywhere in the app to see the full list. Most-used:

| Combo | Action |
|---|---|
| `Ctrl/⌘ + S` | Copy email HTML to clipboard |
| `Ctrl/⌘ + B` | Copy Bloomberg-formatted text |
| `Ctrl/⌘ + Z` / `Ctrl/⌘ + Y` | Undo / redo |
| `Ctrl/⌘ + E` / `Ctrl/⌘ + P` | Switch to Editor / Preview tab |
| `Ctrl/⌘ + D` | Toggle dark mode |

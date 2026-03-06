# LS Argentina Daily Builder

Internal tool for Latin Securities Sales & Trading desk to compose the daily Argentina market email.

## Features

- **Section toggles** — enable/disable Macro, Trade Ideas, Flows, Macro Estimates, Corporate
- **Analyst database** — manage analysts, coverage universe, ratings, target prices
- **Smart dropdowns** — corporate blocks auto-populate rating/TP/analyst from the database
- **Trade ideas** — equity picks via dropdown + rationale field, FI ideas with reasoning
- **Multiple signatures** — add/remove signatories
- **Dual output** — SendGrid HTML (copy-paste into Code Editor) and Bloomberg chat text
- **Live preview** — see the email rendered in real-time

## Quick Start

```bash
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173)

## Deploy to Vercel

### Option A: GitHub → Vercel (recommended)

1. Push this repo to GitHub
2. Go to [vercel.com/new](https://vercel.com/new)
3. Import your GitHub repository
4. Vercel auto-detects Vite — just click **Deploy**
5. Done. Every push to `main` auto-deploys.

### Option B: Vercel CLI

```bash
npm i -g vercel
vercel
```

Follow the prompts. First deploy creates the project, subsequent `vercel` commands redeploy.

## Workflow

1. Open the app each morning
2. **Analysts tab** — update ratings/TPs if changed
3. **Editor tab** — fill in today's content:
   - Date + summary bar
   - Macro blocks (auction, FX, news)
   - Trade ideas (equity picks + FI)
   - Desk flows
   - Macro estimates
   - Corporate earnings (select analyst → ticker → write body)
   - Signatures
4. **Preview tab** — review HTML and BBG outputs
5. **Copy HTML** → paste into SendGrid Code Editor → Send
6. **Copy BBG** → paste into Bloomberg MSG

## Tech Stack

- React 18 + Vite 5
- Zero external UI dependencies (pure inline styles)
- Embedded base64 logo (no external assets needed)

## Brand Colors

| Color   | Hex       |
|---------|-----------|
| Navy    | `#000039` |
| Blue    | `#1e5ab0` |
| Sky     | `#3399ff` |
| Teal    | `#23a29e` |
| Salmon  | `#ebaca2` |
| Green   | `#acd484` |
| Orange  | `#ffbe65` |

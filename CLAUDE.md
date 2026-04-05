# LS Daily Builder — Contexto para Claude Code

## Proyecto
React/Vite app para armar emails del "Argentina Daily" de Latin Securities (Sales & Trading Buenos Aires).
Email diario dirigido a clientes institucionales e inversores sofisticados.

- **Repo:** https://github.com/nistorrodrigo/Dailyv1
- **Deploy:** Vercel (auto-deploy desde `main`)
- **Local:** `C:\Users\rnistor\Downloads\dailyv1`

---

## Stack
- **Frontend:** React (sin router, todo en `src/App.jsx` ~1000 líneas)
- **Build:** Vite
- **Backend:** Vercel serverless functions en `/api/`
- **Persistencia:** localStorage (`"lsDailyState"`) — sin DB

---

## Estructura de archivos
```
src/
  App.jsx          ← TODO: UI, state, generadores HTML + BBG
api/
  bcra.js          ← proxy BCRA API oficial
  ccl.js           ← proxy dolarapi.com (Contado con Liqui)
  prices.js        ← precios varios
public/
  ...
CLAUDE.md          ← este archivo
```

---

## State shape (DEFAULT_STATE)

```js
{
  date: "",                    // ISO date string — date picker nativo
  summaryBar: "",              // texto del banner "Today:"

  sections: [
    { key: "macro",           label: "Macro",                   on: true  },
    { key: "tradeIdeas",      label: "Trade Ideas",             on: false },
    { key: "flows",           label: "Flows",                   on: false },
    { key: "macroEstimates",  label: "Macro Estimates",         on: false },
    { key: "corporate",       label: "Corporate",               on: false },
    { key: "research",        label: "Research",                on: false },
    { key: "topMovers",       label: "Top Movers",              on: false },
    { key: "tweets",          label: "Tweets / Market Noise",   on: false },
    { key: "bcra",            label: "BCRA Dashboard",          on: false },
    { key: "events",          label: "Events",                  on: false },
    { key: "keyEvents",       label: "Key Events Calendar",     on: false },
    { key: "chart",           label: "Chart of the Day",        on: false },
  ],

  macroBlocks: [{ id, title, body, lsPick, contributorIds: [], sourceLink }],
  corpBlocks:  [{ id, tickers, headline, analystIds: [], body, link, sourceLink }],

  equityPicks: [{ ticker, reason, link }],
  fiIdeas:     [{ idea, reason, link }],
  showEquity:  true,    // toggle sección equity en Trade Ideas
  showFI:      true,    // toggle sección FI en Trade Ideas

  flows: { global: "", local: "", positioning: "" },
  macroEstimates: [],

  analysts: [{ id, name, title, role, coverage: [{ ticker, rating, tp, last }] }],

  events:    [{ title, type, date, timeET, timeBUE, timeLON, description, link }],
  //          date = ISO string (date picker), timeET/BUE/LON = "HH:MM" (time picker)
  keyEvents: [{ date, event }],  // date = ISO string

  chartImage: null | { base64, title, caption },

  topMovers: {
    gainers: [{ ticker, chgPct, comment }],  // solo % return en USD — sin precio ni moneda
    losers:  [{ ticker, chgPct, comment }],
  },

  tweets: [{
    content:     "",
    link:        "",
    time:        "",                          // ej: "9:32 AM ET"
    sentiment:   "Bullish"|"Bearish"|"Neutral",
    impactType:  "Market"|"Sector"|"Stock",
    impactValue: "",                          // ticker o nombre de sector
  }],

  cclRate:       null,   // number — fetcheado desde /api/ccl
  bcraData:      null,
  bcraHiddenRows: {},
  signatures:    [],
}
```

---

## Secciones — comportamiento

| Sección | Descripción |
|---|---|
| **Macro** | Bloques libres: título + body (markdown) + lsPick checkbox + contributors + source link |
| **Trade Ideas** | Equity picks + FI ideas, con toggles `showEquity`/`showFI` |
| **Flows** | 3 textareas: Global / Local / Positioning |
| **Macro Estimates** | Tabla editable de estimaciones macroeconómicas |
| **Corporate** | Bloques con tickers, headline, analistas, body, links |
| **Top Movers** | Gainers/Losers: ticker + % return USD + comentario. CCL fetcheable como referencia |
| **Tweets / Market Noise** | Posts que mueven el mercado. Sentiment + impacto (Market/Sector/Stock) + link + hora |
| **BCRA Dashboard** | Datos de BCRA API. Filas toggleables. Fetched desde /api/bcra |
| **Events** | Agenda con date picker (ISO) y time pickers HH:MM para ET/BUE/LON |
| **Key Events Calendar** | Lista simple: fecha + evento |
| **Chart of the Day** | Upload imagen con título y caption |

---

## Outputs generados

```js
generateHTML(s)   // → email HTML completo (tabla, estilos inline, logos en base64)
generateBBG(s)    // → texto plano para Bloomberg (compacto, sin firmas, URLs planas)
```

### Formato BBG
- Separador de secciones: `─────────────────────────`
- Sin firmas al final
- URLs sin prefijo "Link:" o "Source:"
- Sin `**bold**`

---

## Helpers de fecha/hora

```js
formatDate(iso)    // "Monday, March 10, 2026"  → header del email
fmtEventDate(iso)  // "Mar 10, 2026"            → sección events
fmtTime(hhmm)      // "10:00 AM"                → horarios ET/BUE/LON
```

---

## API Endpoints

| Endpoint | Respuesta |
|---|---|
| `GET /api/ccl` | `{ ok, venta, compra, variacion, fecha }` |
| `GET /api/bcra` | `{ ok, data: {...}, fetchedAt }` |
| `GET /api/prices` | precios varios |

---

## Convenciones de código

- **Componentes inline** en App.jsx: `Card`, `Inp`, `DashBtn`, `X`, etc.
- **`is`** = objeto de estilos base para inputs
- **`B`** = objeto de colores de marca: `{ navy, blue, sky, lightBg }`
- **Estado** siempre via `setS(p => ({...p, ...}))` — nunca mutación directa
- **localStorage** key: `"lsDailyState"` — migración de schemas viejos en `loadState()`
- **`migrateMover(m)`** normaliza rows viejos de topMovers (eliminó campo `price`, `currency`, `name`)

---

## Git — commits recientes

```
6199b22  Top Movers: solo % return USD + comment. Nueva sección Tweets/Market Noise
64ef34e  Top Movers: rename USD→ADR toggle (DEPRECADO, precio eliminado después)
b912fc1  BBG: formato corto, sin firmas, URLs planas
e57c54a  Trade Ideas: toggles Equity/FI
c7d4df9  Date/time pickers nativos (daily, events, key events)
```

---

## Pendientes / ideas

- [ ] **Botón "✦ News Brief"** en el builder: genera el prompt de noticias con la fecha del día
      precompletada, lo abre en una nueva pestaña de Claude para buscar noticias y pegar
      directamente en Macro / Corporate
- [ ] Mejorar migración de localStorage si se agregan campos nuevos
- [ ] Posible sección "Macro Estimates" con más tipos de datos

### Prompt de noticias (para el botón News Brief)
Busca en: Econojournal, Boletín Oficial, La Nación, Infobae, Clarín, Ámbito, Cronista, iProfesional.
Cubre: política, macro, sectores (oil & gas, minería, agro, energía), internacional relevante para Argentina.
Excluye: inseguridad, espectáculos, deportes, noticias banales sin impacto financiero/político.
Formato: título + fuente + hora + resumen 2-3 líneas + categoría + afecta.
Ordenadas por relevancia, máx 10-12 noticias.

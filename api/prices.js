import { applyCors, fetchWithRetry, requireAuth } from "./_helpers.js";

// Hard caps + format validation — the previous version had none,
// so a caller could pass 10000 comma-separated entries and the
// handler would loop through each serially with `fetchWithRetry`
// (4 attempts × 8s timeout) → effectively a one-request DoS
// against our Vercel quota and our Alpha Vantage rate limit.
const MAX_TICKERS_PER_REQUEST = 50;
// Tight regex — uppercase letters, digits, plus the small set of
// punctuation valid in ticker / index / FX symbols (`.`, `-`,
// `^`, `=`). Rejects path-traversal / URL-encoding tricks before
// interpolating into the Yahoo / Alpha Vantage URLs.
const TICKER_RE = /^[A-Z0-9.\-^=]{1,12}$/;

async function fetchPriceForSymbol(sym, avKey) {
  // Try Yahoo Finance first
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${sym}?range=5d&interval=1d`;
    const resp = await fetchWithRetry(url, { headers: { "User-Agent": "Mozilla/5.0" } });
    const data = await resp.json();
    const result = data?.chart?.result?.[0];
    if (result) {
      const closes = result.indicators?.quote?.[0]?.close || [];
      const validCloses = closes.filter((c) => c !== null);
      if (validCloses.length > 0) {
        return validCloses[validCloses.length - 1];
      }
    }
  } catch {
    // Yahoo failed, try Alpha Vantage
  }
  if (avKey) {
    try {
      const url = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${sym}&apikey=${avKey}`;
      const resp = await fetchWithRetry(url);
      const data = await resp.json();
      const price = parseFloat(data?.["Global Quote"]?.["05. price"]);
      if (!isNaN(price)) return price;
    } catch {
      // skip failed ticker
    }
  }
  return null;
}

export default async function handler(req, res) {
  applyCors(req, res);
  if (req.method === "OPTIONS") return res.status(204).end();

  // Auth gate — this is an LS-internal data fetcher. Previously
  // unauth, which let any anonymous request burn Yahoo / Alpha
  // Vantage quota at our cost.
  const auth = await requireAuth(req);
  if (!auth.ok) return res.status(401).json({ ok: false, error: "Auth required" });

  res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=600");

  const { tickers } = req.query;
  if (!tickers) return res.status(400).json({ error: "Missing tickers param" });

  const symbols = String(tickers).split(",").map((t) => t.trim().toUpperCase()).filter(Boolean);
  if (symbols.length === 0) return res.status(400).json({ error: "No valid tickers" });
  if (symbols.length > MAX_TICKERS_PER_REQUEST) {
    return res.status(413).json({ error: `Too many tickers (${symbols.length} > ${MAX_TICKERS_PER_REQUEST})` });
  }
  const bad = symbols.find((s) => !TICKER_RE.test(s));
  if (bad) {
    return res.status(400).json({ error: `Invalid ticker: ${bad}` });
  }

  // Parallel fetch — previously serial, which made 50 tickers a
  // 30s+ response. Promise.all keeps the function under the Vercel
  // 10s default. fetchWithRetry already handles per-request
  // back-off, so individual slow / dead tickers don't gate the
  // others.
  const avKey = process.env.ALPHA_VANTAGE_API_KEY;
  const results = await Promise.all(
    symbols.map(async (sym) => [sym, await fetchPriceForSymbol(sym, avKey)]),
  );
  const prices = {};
  for (const [sym, price] of results) {
    if (price !== null) prices[sym] = price;
  }

  res.status(200).json({ prices });
}

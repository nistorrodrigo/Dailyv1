import { applyCors, fetchWithRetry } from "./_helpers.js";

export default async function handler(req, res) {
  applyCors(req, res);
  res.setHeader("Cache-Control", "s-maxage=900, stale-while-revalidate=1800");

  const BASE = "https://api.bcra.gob.ar/estadisticas/v4.0/monetarias";
  const HDR  = { "User-Agent": "Mozilla/5.0", "Accept": "application/json" };

  // All IDs verified from v4.0 variable list on 2026-03-09
  // div: divisor applied before returning (1=mn, 1000=bn, 1000000=tn)
  const VARS = {
    reservas:    { id: 1,   label: "International Reserves",        unit: "US$ mn",  type: "stock", div: 1    },
    depCC:       { id: 22,  label: "Demand Deposits (ARS$)",        unit: "ARS$ bn", type: "stock", div: 1000 },
    depCA:       { id: 23,  label: "Savings Deposits (ARS$)",       unit: "ARS$ bn", type: "stock", div: 1000 },
    depPF:       { id: 24,  label: "Time Deposits (ARS$)",          unit: "ARS$ bn", type: "stock", div: 1000 },
    depUSD:      { id: 108, label: "USD Deposits – Private Sector", unit: "US$ mn",  type: "stock", div: 1    },
    prestARS:    { id: 26,  label: "Private Sector Loans (ARS$)",   unit: "ARS$ bn", type: "stock", div: 1000 },
    prestUSD:    { id: 125, label: "Private Sector Loans (USD)",    unit: "US$ mn",  type: "stock", div: 1    },
    comprasBCRA: { id: 78,  label: "BCRA FX Purchases (Daily)",     unit: "US$ mn",  type: "flow",  div: 1    },
  };

  function dateStr(d) { return d.toISOString().slice(0, 10); }

  async function fetchSeries(id) {
    const hasta = dateStr(new Date());
    const desde = dateStr(new Date(Date.now() - 400 * 86400000));
    const url   = `${BASE}/${id}?desde=${desde}&hasta=${hasta}`;
    try {
      const r = await fetchWithRetry(url, { headers: HDR, signal: AbortSignal.timeout(12000) });
      if (!r.ok) return null;
      const j = await r.json();
      const detalle = j.results?.[0]?.detalle || [];
      return detalle
        .map(x => ({ fecha: x.fecha, valor: x.valor }))
        .sort((a, b) => a.fecha.localeCompare(b.fecha));
    } catch { return null; }
  }

  function calcStock(series, div = 1) {
    if (!series?.length) return null;
    const last     = series[series.length - 1];
    const prev     = series.length >= 2 ? series[series.length - 2] : null;
    const lastMonth = last.fecha.slice(0, 7);
    const lastYear  = last.fecha.slice(0, 4);
    const eom = [...series].reverse().find(s => s.fecha < `${lastMonth}-01`) || null;
    const eoy = [...series].reverse().find(s => s.fecha < `${lastYear}-01-01`) || null;
    const decimals = div >= 1000 ? 0 : 0;
    const d = (v) => v != null ? v / div : null;
    const diff = (a, b) => a != null && b != null ? +((a - b) / div).toFixed(decimals) : null;
    const pct  = (a, b) => a != null && b != null && b !== 0 ? +((a - b) / Math.abs(b) * 100).toFixed(2) : null;
    return {
      value:  d(last.valor), date: last.fecha,
      d1:     diff(last.valor, prev?.valor),  d1pct:  pct(last.valor, prev?.valor),
      mtd:    diff(last.valor, eom?.valor),   mtdpct: pct(last.valor, eom?.valor),
      ytd:    diff(last.valor, eoy?.valor),   ytdpct: pct(last.valor, eoy?.valor),
    };
  }

  function calcFlow(series, div = 1) {
    // For daily flows: show today's value, cumulative MTD sum, cumulative YTD sum
    if (!series?.length) return null;
    const last      = series[series.length - 1];
    const lastMonth = last.fecha.slice(0, 7);
    const lastYear  = last.fecha.slice(0, 4);
    const mtdRows = series.filter(s => s.fecha.startsWith(lastMonth));
    const ytdRows = series.filter(s => s.fecha.startsWith(lastYear));
    const sum = rows => rows.reduce((a, r) => a + (r.valor || 0), 0);
    return {
      value:   +(last.valor / div).toFixed(2),
      date:    last.fecha,
      isFlow:  true,
      mtdSum:  +(sum(mtdRows) / div).toFixed(2),
      ytdSum:  +(sum(ytdRows) / div).toFixed(2),
      mtdDays: mtdRows.length,
      ytdDays: ytdRows.length,
    };
  }

  try {
    const keys   = Object.keys(VARS);
    const series = await Promise.all(keys.map(k => fetchSeries(VARS[k].id)));

    const data = {};
    keys.forEach((k, i) => {
      const meta = VARS[k];
      const s    = series[i];
      const div  = meta.div || 1;
      const stats = meta.type === "flow" ? calcFlow(s, div) : calcStock(s, div);
      data[k] = { ...meta, ...(stats || {}) };
    });

    // Compute total ARS deposits from the three components
    const cc = data.depCC, ca = data.depCA, pf = data.depPF;
    const sumV = (a, b, c) => (a != null && b != null && c != null) ? a + b + c : null;
    data.depTotalARS = {
      label: "Total ARS Deposits",
      unit:  "ARS$ bn",
      type:  "stock",
      value: sumV(cc?.value, ca?.value, pf?.value),
      date:  cc?.date,
      d1:    sumV(cc?.d1,  ca?.d1,  pf?.d1),
      d1pct: (cc?.value && ca?.value && pf?.value && cc?.d1 != null)
               ? +((cc.d1 + ca.d1 + pf.d1) / Math.abs(cc.value + ca.value + pf.value - cc.d1 - ca.d1 - pf.d1) * 100).toFixed(2) : null,
      mtd:   sumV(cc?.mtd, ca?.mtd, pf?.mtd),
      mtdpct:(cc?.mtd != null) ? +((cc.mtd+ca.mtd+pf.mtd)/Math.abs(cc.value-cc.mtd+ca.value-ca.mtd+pf.value-pf.mtd)*100).toFixed(2) : null,
      ytd:   sumV(cc?.ytd, ca?.ytd, pf?.ytd),
      ytdpct:(cc?.ytd != null) ? +((cc.ytd+ca.ytd+pf.ytd)/Math.abs(cc.value-cc.ytd+ca.value-ca.ytd+pf.value-pf.ytd)*100).toFixed(2) : null,
    };

    res.status(200).json({ fetchedAt: new Date().toISOString(), data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

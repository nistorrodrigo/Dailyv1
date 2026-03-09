export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");

  // v3 was deprecated 2026-02-28 — now using v4.0
  const BASE = "https://api.bcra.gob.ar/estadisticas/v4.0/monetarias";
  const HDR  = { "Accept-Language": "es-AR", "User-Agent": "Mozilla/5.0", "Accept": "application/json" };

  // Confirmed variable IDs (v4 list endpoint verified 2026-03-09)
  const KNOWN = {
    reservas:  1,
    depCC:    22,
    depCA:    23,
    depPF:    24,
    prestARS: 26,
  };

  const LABELS = {
    reservas:    { label: "International Reserves",        unit: "USD M"  },
    comprasBCRA: { label: "BCRA Net FX Purchases (MLC)",   unit: "USD M"  },
    depCC:       { label: "Demand Deposits (ARS)",         unit: "ARS M"  },
    depCA:       { label: "Savings Deposits (ARS)",        unit: "ARS M"  },
    depPF:       { label: "Time Deposits (ARS)",           unit: "ARS M"  },
    depUSD:      { label: "USD Deposits",                  unit: "USD M"  },
    prestARS:    { label: "Private Sector Loans (ARS)",    unit: "ARS M"  },
    prestUSD:    { label: "Private Sector Loans (USD)",    unit: "USD M"  },
  };

  function dateStr(d) {
    return d.toISOString().slice(0, 10);
  }

  // v4 returns: { results: [{ idVariable, detalle: [{fecha, valor}] }] }
  async function fetchSeries(id) {
    const hasta = dateStr(new Date());
    const desde = dateStr(new Date(Date.now() - 400 * 86400000));
    const url   = `${BASE}/${id}?desde=${desde}&hasta=${hasta}`;
    try {
      const r = await fetch(url, { headers: HDR, signal: AbortSignal.timeout(12000) });
      if (!r.ok) return null;
      const j = await r.json();
      // v4 nests data under results[0].detalle
      const detalle = j.results?.[0]?.detalle || [];
      const rows = detalle
        .map(x => ({ fecha: x.fecha, valor: x.valor }))
        .sort((a, b) => a.fecha.localeCompare(b.fecha));
      return rows.length ? rows : null;
    } catch (e) {
      return null;
    }
  }

  async function fetchVarList() {
    try {
      const r = await fetch(`${BASE}?limit=2000`, { headers: HDR, signal: AbortSignal.timeout(12000) });
      if (!r.ok) return [];
      const j = await r.json();
      return j.results || [];
    } catch {
      return [];
    }
  }

  function findVar(list, mustContain, mustNot = []) {
    const mc = mustContain.map(k => k.toLowerCase());
    const mn = mustNot.map(k => k.toLowerCase());
    return list.find(v => {
      const d = (v.descripcion || "").toLowerCase();
      return mc.every(k => d.includes(k)) && mn.every(k => !d.includes(k));
    }) || null;
  }

  function calcStats(series) {
    if (!series || !series.length) return null;
    const last      = series[series.length - 1];
    const lastDate  = last.fecha;
    const lastYear  = lastDate.slice(0, 4);
    const lastMonth = lastDate.slice(0, 7);

    const prev = series.length >= 2 ? series[series.length - 2] : null;
    const eom  = [...series].reverse().find(s => s.fecha < `${lastMonth}-01`) || null;
    const eoy  = [...series].reverse().find(s => s.fecha < `${lastYear}-01-01`) || null;

    const diff = (a, b) => a != null && b != null ? +(a - b).toFixed(4) : null;
    const pct  = (a, b) => a != null && b != null && b !== 0 ? +((a - b) / Math.abs(b) * 100).toFixed(2) : null;

    return {
      value:   last.valor,
      date:    last.fecha,
      d1:      diff(last.valor, prev?.valor),
      d1pct:   pct(last.valor,  prev?.valor),
      mtd:     diff(last.valor, eom?.valor),
      mtdpct:  pct(last.valor,  eom?.valor),
      mtdRef:  eom?.fecha || null,
      ytd:     diff(last.valor, eoy?.valor),
      ytdpct:  pct(last.valor,  eoy?.valor),
      ytdRef:  eoy?.fecha || null,
    };
  }

  try {
    // 1. Fetch known-ID series in parallel
    const [resSeries, ccSeries, caSeries, pfSeries, prestARSSeries] = await Promise.all([
      fetchSeries(KNOWN.reservas),
      fetchSeries(KNOWN.depCC),
      fetchSeries(KNOWN.depCA),
      fetchSeries(KNOWN.depPF),
      fetchSeries(KNOWN.prestARS),
    ]);

    // 2. Find unknown-ID variables by keyword from the list
    const varList = await fetchVarList();

    const comprasVar  = findVar(varList, ["compras netas"], []);
    const depUSDVar   = findVar(varList, ["depósitos", "dólar"], ["tasa", "plazo fijo", "cuenta corriente", "ahorro"]);
    const prestUSDVar = findVar(varList, ["préstamos", "dólar"], ["tasa"]);

    const [comprasSeries, depUSDSeries, prestUSDSeries] = await Promise.all([
      comprasVar  ? fetchSeries(comprasVar.idVariable)  : Promise.resolve(null),
      depUSDVar   ? fetchSeries(depUSDVar.idVariable)   : Promise.resolve(null),
      prestUSDVar ? fetchSeries(prestUSDVar.idVariable) : Promise.resolve(null),
    ]);

    const data = {
      reservas:    { ...LABELS.reservas,    ...calcStats(resSeries)       },
      comprasBCRA: { ...LABELS.comprasBCRA, ...calcStats(comprasSeries),
                     varId: comprasVar?.idVariable || null,
                     varDesc: comprasVar?.descripcion || null },
      depCC:       { ...LABELS.depCC,       ...calcStats(ccSeries)        },
      depCA:       { ...LABELS.depCA,       ...calcStats(caSeries)        },
      depPF:       { ...LABELS.depPF,       ...calcStats(pfSeries)        },
      depUSD:      { ...LABELS.depUSD,      ...calcStats(depUSDSeries),
                     varId: depUSDVar?.idVariable || null,
                     varDesc: depUSDVar?.descripcion || null },
      prestARS:    { ...LABELS.prestARS,    ...calcStats(prestARSSeries)  },
      prestUSD:    { ...LABELS.prestUSD,    ...calcStats(prestUSDSeries),
                     varId: prestUSDVar?.idVariable || null,
                     varDesc: prestUSDVar?.descripcion || null },
    };

    res.status(200).json({
      fetchedAt: new Date().toISOString(),
      data,
      debug: {
        apiVersion: "v4.0",
        varListCount: varList.length,
        comprasVarFound:  comprasVar  ? `${comprasVar.idVariable}: ${comprasVar.descripcion}`  : "NOT FOUND",
        depUSDVarFound:   depUSDVar   ? `${depUSDVar.idVariable}: ${depUSDVar.descripcion}`    : "NOT FOUND",
        prestUSDVarFound: prestUSDVar ? `${prestUSDVar.idVariable}: ${prestUSDVar.descripcion}`: "NOT FOUND",
        seriesLengths: {
          reservas: resSeries?.length || 0,
          depCC:    ccSeries?.length  || 0,
          depCA:    caSeries?.length  || 0,
          depPF:    pfSeries?.length  || 0,
          prestARS: prestARSSeries?.length || 0,
          compras:  comprasSeries?.length  || 0,
          depUSD:   depUSDSeries?.length   || 0,
          prestUSD: prestUSDSeries?.length || 0,
        }
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

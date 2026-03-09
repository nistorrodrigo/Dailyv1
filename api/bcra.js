export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");

  const BASE = "https://api.bcra.gob.ar/estadisticas/v3.0/monetarias";
  const HDR  = { "Accept-Language": "es-AR", "User-Agent": "Mozilla/5.0" };

  /* ── helpers ─────────────────────────────────────────── */
  const today = () => new Date().toISOString().slice(0, 10);
  const daysAgo = (n) => {
    const d = new Date(); d.setDate(d.getDate() - n);
    return d.toISOString().slice(0, 10);
  };
  const startOfYear = () => `${new Date().getFullYear()}-01-01`;
  const startOfMonth = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
  };

  async function fetchList() {
    const r = await fetch(BASE, { headers: HDR });
    const j = await r.json();
    return j.results || [];
  }

  async function fetchSeries(id, desde) {
    const url = `${BASE}/${id}?desde=${desde}&hasta=${today()}&limit=120`;
    const r = await fetch(url, { headers: HDR });
    const j = await r.json();
    return (j.results || []).sort((a, b) => a.fecha.localeCompare(b.fecha));
  }

  /* Returns { ultimo, fecha, varDiaria, varDiariaPC, varMTD, varMTDPC, varYTD, varYTDPC } */
  function calcVariations(series) {
    if (!series.length) return null;
    const last = series[series.length - 1];
    const sm   = startOfMonth();
    const sy   = startOfYear();

    // previous business day value
    const prev = series.length >= 2 ? series[series.length - 2] : null;
    // value at/just before start of month
    const eom  = series.filter(s => s.fecha < sm).pop() || null;
    // value at/just before start of year
    const eoy  = series.filter(s => s.fecha < sy).pop() || null;

    const diff  = (a, b) => b && a ? a.valor - b.valor : null;
    const pct   = (a, b) => b && a && b.valor ? ((a.valor - b.valor) / Math.abs(b.valor)) * 100 : null;

    return {
      ultimo: last.valor,
      fecha:  last.fecha,
      varDiaria:   diff(last, prev),
      varDiariaPC: pct(last, prev),
      varMTD:      diff(last, eom),
      varMTDPC:    pct(last, eom),
      varYTD:      diff(last, eoy),
      varYTDPC:    pct(last, eoy),
    };
  }

  /* Match a variable in the list by scoring against keywords */
  function findVar(list, mustContain, mustNotContain = []) {
    const mc = mustContain.map(k => k.toLowerCase());
    const mn = mustNotContain.map(k => k.toLowerCase());
    const matches = list.filter(v => {
      const d = v.descripcion.toLowerCase();
      return mc.every(k => d.includes(k)) && mn.every(k => !d.includes(k));
    });
    return matches[0] || null;
  }

  /* ── main ────────────────────────────────────────────── */
  try {
    const list = await fetchList();

    // ---- Define what we want -------------------------------------------------
    const slots = {
      reservas:     findVar(list, ["reservas internacionales"]),
      comprasBCRA:  findVar(list, ["compras"]) || findVar(list, ["posición de cambios"]) || findVar(list, ["posicion de cambios"]),
      depCCPesos:   findVar(list, ["cuentas corrientes"], ["dólar","usd","me "]),
      depCAPesos:   findVar(list, ["caja de ahorro"],    ["dólar","usd","me "]),
      depPFPesos:   findVar(list, ["plazo"],             ["dólar","usd","me ","porcentaje","tasa"]),
      depUSD:       findVar(list, ["depósito"],          ["pesos","cuenta","corriente","ahorro"]) ||
                    findVar(list, ["deposito"],          ["pesos","cuenta","corriente","ahorro"]),
      prestPesos:   findVar(list, ["préstamos"],         ["dólar","usd","me ","tasa","interés"]) ||
                    findVar(list, ["prestamos"],         ["dólar","usd","me ","tasa","interes"]),
      prestUSD:     findVar(list, ["préstamos","dólar"]) ||
                    findVar(list, ["préstamos","me "])   ||
                    findVar(list, ["prestamos","dólar"]) ||
                    findVar(list, ["prestamos","me "]),
    };

    // ---- Fetch series for slots that were found ------------------------------
    const desde = daysAgo(90); // 90 days covers YTD for most variables
    const results = {};

    for (const [key, v] of Object.entries(slots)) {
      if (!v) { results[key] = null; continue; }
      try {
        const series = await fetchSeries(v.idVariable, desde < startOfYear() ? startOfYear() : desde);
        results[key] = {
          id:         v.idVariable,
          descripcion: v.descripcion,
          ...calcVariations(series),
        };
      } catch {
        results[key] = null;
      }
    }

    // ---- Compute pesos deposit total (CC + CA + PF) -------------------------
    const sumLatest = (...keys) => {
      const vals = keys.map(k => results[k]?.ultimo).filter(v => v != null);
      return vals.length === keys.length ? vals.reduce((a, b) => a + b, 0) : null;
    };
    results.depTotalPesos = sumLatest("depCCPesos", "depCAPesos", "depPFPesos") !== null
      ? { ultimo: sumLatest("depCCPesos", "depCAPesos", "depPFPesos") }
      : null;

    // ---- Return --------------------------------------------------------------
    res.status(200).json({
      fecha: today(),
      variables: slots,   // debug: show which IDs were matched
      data: results,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

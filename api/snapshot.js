export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=600");

  const tickers = {
    merval: "^MERV",
    sp500: "^GSPC",
    dxy: "DX-Y.NYB",
    wti: "CL=F",
    soja: "ZS=F",
    ust10y: "^TNX",
  };

  const snapshot = {};

  // Fetch Yahoo Finance data
  for (const [key, symbol] of Object.entries(tickers)) {
    try {
      const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?range=2d&interval=1d`;
      const resp = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
      const data = await resp.json();
      const result = data?.chart?.result?.[0];
      if (result) {
        const closes = result.indicators?.quote?.[0]?.close?.filter(c => c !== null) || [];
        if (closes.length >= 1) {
          const last = closes[closes.length - 1];
          const prev = closes.length >= 2 ? closes[closes.length - 2] : last;
          const chg = prev ? ((last / prev - 1) * 100).toFixed(2) : "0";

          if (key === "ust10y") {
            snapshot[key] = { value: last.toFixed(2) + "%", chg: "" };
          } else if (key === "merval") {
            snapshot[key] = { value: Math.round(last).toLocaleString(), chg };
          } else {
            snapshot[key] = { value: last.toFixed(2), chg };
          }
        }
      }
    } catch (e) { /* skip */ }
  }

  // Fetch CCL, MEP, Blue from dolarapi
  try {
    const [cclResp, mepResp, blueResp] = await Promise.all([
      fetch("https://dolarapi.com/v1/dolares/contadoconliqui", { headers: { "User-Agent": "Mozilla/5.0" } }),
      fetch("https://dolarapi.com/v1/dolares/bolsa", { headers: { "User-Agent": "Mozilla/5.0" } }),
      fetch("https://dolarapi.com/v1/dolares/blue", { headers: { "User-Agent": "Mozilla/5.0" } }),
    ]);
    const [ccl, mep, blue] = await Promise.all([cclResp.json(), mepResp.json(), blueResp.json()]);

    if (ccl.venta) snapshot.ccl = { value: ccl.venta.toFixed(0), chg: ccl.variacion?.toFixed(2) || "" };
    if (mep.venta) snapshot.mep = { value: mep.venta.toFixed(0), chg: mep.variacion?.toFixed(2) || "" };
    if (blue.venta) snapshot.blue = { value: blue.venta.toFixed(0), chg: "" };
  } catch (e) { /* skip */ }

  res.status(200).json({ ok: true, snapshot, fetchedAt: new Date().toISOString() });
}

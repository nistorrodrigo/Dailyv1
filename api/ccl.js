import { applyCors, fetchWithRetry } from "./_helpers.js";

export default async function handler(req, res) {
  applyCors(req, res);
  res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=600");
  try {
    const r = await fetchWithRetry("https://dolarapi.com/v1/dolares/contadoconliqui", {
      headers: { "User-Agent": "Mozilla/5.0" }
    });
    if (!r.ok) throw new Error(`dolarapi status ${r.status}`);
    const data = await r.json();
    res.json({ ok: true, venta: data.venta, compra: data.compra, variacion: data.variacion, fecha: data.fechaActualizacion });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
}

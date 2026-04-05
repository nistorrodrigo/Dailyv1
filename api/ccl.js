export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");

  try {
    const resp = await fetch("https://dolarapi.com/v1/dolares/contadoconliqui", {
      headers: { "User-Agent": "Mozilla/5.0" },
    });
    const data = await resp.json();

    res.status(200).json({
      ok: true,
      venta: data.venta,
      compra: data.compra,
      variacion: data.variacion,
      fecha: data.fechaActualizacion,
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");

  try {
    const endpoints = {
      "Reservas Internacionales": "https://api.bcra.gob.ar/estadisticas/v2.0/DatosVariable/1/2024-01-01/2099-12-31",
      "Base Monetaria": "https://api.bcra.gob.ar/estadisticas/v2.0/DatosVariable/15/2024-01-01/2099-12-31",
      "Tipo de Cambio Minorista": "https://api.bcra.gob.ar/estadisticas/v2.0/DatosVariable/4/2024-01-01/2099-12-31",
      "Tasa de Política Monetaria": "https://api.bcra.gob.ar/estadisticas/v2.0/DatosVariable/6/2024-01-01/2099-12-31",
      "BADLAR Total": "https://api.bcra.gob.ar/estadisticas/v2.0/DatosVariable/7/2024-01-01/2099-12-31",
      "Dep. Plazo Fijo": "https://api.bcra.gob.ar/estadisticas/v2.0/DatosVariable/21/2024-01-01/2099-12-31",
    };

    const data = {};
    const results = await Promise.allSettled(
      Object.entries(endpoints).map(async ([label, url]) => {
        const resp = await fetch(url, {
          headers: {
            "Accept": "application/json",
            "User-Agent": "Mozilla/5.0",
          },
        });
        const json = await resp.json();
        const results = json?.results || [];
        if (results.length > 0) {
          const latest = results[results.length - 1];
          data[label] = latest.valor != null
            ? typeof latest.valor === "number"
              ? latest.valor.toLocaleString("es-AR")
              : String(latest.valor)
            : "N/A";
        }
      })
    );

    res.status(200).json({ ok: true, data, fetchedAt: new Date().toISOString() });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
}

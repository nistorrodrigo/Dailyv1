export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=600");

  const { tickers } = req.query;
  if (!tickers) return res.status(400).json({ error: "Missing tickers param" });

  const symbols = tickers.split(",").map(t => t.trim().toUpperCase()).filter(Boolean);
  const prices = {};

  for (const sym of symbols) {
    // Try Yahoo Finance first
    try {
      const url = `https://query1.finance.yahoo.com/v8/finance/chart/${sym}?range=5d&interval=1d`;
      const resp = await fetch(url, {
        headers: { "User-Agent": "Mozilla/5.0" }
      });
      const data = await resp.json();
      const result = data?.chart?.result?.[0];
      if (result) {
        const closes = result.indicators?.quote?.[0]?.close || [];
        const validCloses = closes.filter(c => c !== null);
        if (validCloses.length > 0) {
          prices[sym] = validCloses[validCloses.length - 1];
          continue;
        }
      }
    } catch (e) {
      // Yahoo failed, try Alpha Vantage
    }

    // Fallback: Alpha Vantage
    const avKey = process.env.ALPHA_VANTAGE_API_KEY;
    if (avKey) {
      try {
        const url = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${sym}&apikey=${avKey}`;
        const resp = await fetch(url);
        const data = await resp.json();
        const price = parseFloat(data?.["Global Quote"]?.["05. price"]);
        if (!isNaN(price)) {
          prices[sym] = price;
        }
      } catch (e) {
        // skip failed ticker
      }
    }
  }

  res.setHeader("Access-Control-Allow-Origin", "*");
  res.status(200).json({ prices });
}

export default async function handler(req, res) {
  const { tickers } = req.query;
  if (!tickers) return res.status(400).json({ error: "Missing tickers param" });

  const symbols = tickers.split(",").map(t => t.trim().toUpperCase()).filter(Boolean);
  const prices = {};

  for (const sym of symbols) {
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
        }
      }
    } catch (e) {
      // skip failed ticker
    }
  }

  res.setHeader("Access-Control-Allow-Origin", "*");
  res.status(200).json({ prices });
}

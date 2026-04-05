export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "ANTHROPIC_API_KEY not configured" });

  const { context, existingBlocks, date } = req.body;

  const systemPrompt = `You are a senior Argentina macro analyst at Latin Securities, a Buenos Aires-based investment bank focused on Argentine equities and fixed income.

Your job is to draft concise, professional macro/political sections for the daily morning report sent to institutional investors.

Style guidelines:
- Write in English
- Be concise and factual — 2-4 sentences per block
- Use bullet points for multiple data points
- Include specific numbers, rates, and percentages when relevant
- Mention market impact where applicable
- Use professional sell-side research tone
- Each block should have a clear UPPERCASE title and a body
- If you have a view, add an "LS pick" with a brief trade recommendation

Common block titles: TREASURY AUCTION RESULTS, FX / BCRA, INFLATION DATA, POLITICAL UPDATE, IMF PROGRAM, FISCAL DATA, RESERVES UPDATE, RATE DECISION, GDP DATA, TRADE BALANCE`;

  const userPrompt = `Today is ${date}. Generate 2-3 macro blocks for today's Argentina Daily report.

${context ? `Context/notes from the analyst:\n${context}\n` : ""}
${existingBlocks?.length ? `Existing blocks to improve or complement (don't repeat these):\n${existingBlocks.map(b => `- ${b.title}: ${b.body}`).join("\n")}\n` : ""}

Return a JSON array of blocks. Each block has: title (string, UPPERCASE), body (string), lsPick (string or empty).

Example format:
[
  {"title": "TREASURY AUCTION RESULTS", "body": "MECON placed ARS$2.1tn across 3 instruments...", "lsPick": "We favor the long end of the BONCAP curve"},
  {"title": "FX / BCRA", "body": "The BCRA bought US$150mn in the official FX market...", "lsPick": ""}
]

Return ONLY the JSON array, no markdown, no explanation.`;

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 1024,
        messages: [
          { role: "user", content: userPrompt },
        ],
        system: systemPrompt,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Anthropic API ${response.status}: ${err}`);
    }

    const data = await response.json();
    const text = data.content?.[0]?.text || "[]";

    // Parse the JSON from Claude's response
    let blocks;
    try {
      // Handle potential markdown wrapping
      const clean = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      blocks = JSON.parse(clean);
    } catch {
      blocks = [{ title: "AI DRAFT", body: text, lsPick: "" }];
    }

    res.status(200).json({
      ok: true,
      blocks,
      usage: {
        input: data.usage?.input_tokens,
        output: data.usage?.output_tokens,
      },
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
}

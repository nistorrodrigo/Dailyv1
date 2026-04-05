const MODELS = {
  haiku: { id: "claude-haiku-4-5-20251001", label: "Haiku 4.5", cost: "~$0.002" },
  sonnet: { id: "claude-sonnet-4-6-20250514", label: "Sonnet 4.6", cost: "~$0.012" },
  opus: { id: "claude-opus-4-6-20250514", label: "Opus 4.6", cost: "~$0.06" },
};

const SYSTEM_MACRO = `You are a senior Argentina macro analyst at Latin Securities, a Buenos Aires-based investment bank focused on Argentine equities and fixed income.

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

const SYSTEM_FULL = `You are a senior analyst at Latin Securities, a Buenos Aires-based investment bank. You draft the complete Argentina Daily morning report sent to institutional investors.

Style: English, concise, factual, professional sell-side tone. Include specific numbers when relevant.

The daily has these sections (generate content for ALL enabled ones):
- macroBlocks: array of {title (UPPERCASE), body, lsPick}. 2-3 blocks covering key macro/political developments.
- summaryBar: one-line top summary of the day's key theme (max 120 chars)
- equityPicks: array of {ticker, reason}. Top 3-4 equity picks from coverage universe with brief rationale.
- fiIdeas: array of {idea, reason}. 2-3 fixed income trade ideas.
- eqBuyer/eqSeller: brief description of equity flow direction.
- fiBuyer/fiSeller: brief description of FI flow direction.

Return valid JSON only, no markdown wrapping.`;

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "ANTHROPIC_API_KEY not configured" });

  const { context, existingBlocks, date, model = "haiku", mode = "macro", analysts } = req.body;

  const modelConfig = MODELS[model] || MODELS.haiku;

  let systemPrompt, userPrompt, maxTokens;

  if (mode === "full") {
    systemPrompt = SYSTEM_FULL;
    maxTokens = 2048;

    const tickerList = analysts?.length
      ? `\nAvailable tickers from coverage: ${analysts.flatMap(a => a.coverage.map(c => `${c.ticker} (${c.rating})`)).join(", ")}`
      : "";

    userPrompt = `Today is ${date}. Generate a COMPLETE Argentina Daily report.
${context ? `\nContext/notes:\n${context}` : ""}${tickerList}

Return a JSON object with these fields:
{
  "summaryBar": "one-line summary",
  "macroBlocks": [{"title": "UPPERCASE TITLE", "body": "...", "lsPick": "..."}],
  "equityPicks": [{"ticker": "TICKER", "reason": "..."}],
  "fiIdeas": [{"idea": "trade idea", "reason": "..."}],
  "eqBuyer": "...",
  "eqSeller": "...",
  "fiBuyer": "...",
  "fiSeller": "..."
}

Return ONLY the JSON object, no markdown, no explanation.`;
  } else {
    systemPrompt = SYSTEM_MACRO;
    maxTokens = 1024;

    userPrompt = `Today is ${date}. Generate 2-3 macro blocks for today's Argentina Daily report.

${context ? `Context/notes from the analyst:\n${context}\n` : ""}
${existingBlocks?.length ? `Existing blocks to improve or complement (don't repeat these):\n${existingBlocks.map(b => `- ${b.title}: ${b.body}`).join("\n")}\n` : ""}

Return a JSON array of blocks. Each block has: title (string, UPPERCASE), body (string), lsPick (string or empty).
Return ONLY the JSON array, no markdown, no explanation.`;
  }

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: modelConfig.id,
        max_tokens: maxTokens,
        messages: [{ role: "user", content: userPrompt }],
        system: systemPrompt,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Anthropic API ${response.status}: ${err}`);
    }

    const data = await response.json();
    const text = data.content?.[0]?.text || (mode === "full" ? "{}" : "[]");

    let parsed;
    try {
      const clean = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      parsed = JSON.parse(clean);
    } catch {
      parsed = mode === "full"
        ? { macroBlocks: [{ title: "AI DRAFT", body: text, lsPick: "" }] }
        : [{ title: "AI DRAFT", body: text, lsPick: "" }];
    }

    res.status(200).json({
      ok: true,
      mode,
      model: modelConfig.label,
      ...(mode === "full" ? { daily: parsed } : { blocks: parsed }),
      usage: {
        input: data.usage?.input_tokens,
        output: data.usage?.output_tokens,
      },
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
}

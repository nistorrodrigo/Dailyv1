export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=600");

  const apiKey = process.env.SENDGRID_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "SendGrid not configured" });

  const { listId } = req.query;

  try {
    if (listId) {
      // Fetch contacts from a specific list
      const resp = await fetch(`https://api.sendgrid.com/v3/marketing/contacts/search`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          query: `CONTAINS(list_ids, '${listId}')`,
        }),
      });
      if (!resp.ok) {
        const text = await resp.text();
        throw new Error(`SendGrid ${resp.status}: ${text}`);
      }
      const data = await resp.json();
      const contacts = (data.result || []).map((c) => ({
        email: c.email,
        name: [c.first_name, c.last_name].filter(Boolean).join(" ") || "",
      }));
      return res.status(200).json({ ok: true, contacts });
    }

    // Fetch all lists
    const resp = await fetch("https://api.sendgrid.com/v3/marketing/lists?page_size=100", {
      headers: { "Authorization": `Bearer ${apiKey}` },
    });
    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(`SendGrid ${resp.status}: ${text}`);
    }
    const data = await resp.json();
    const lists = (data.result || []).map((l) => ({
      id: l.id,
      name: l.name,
      count: l.contact_count,
    }));
    res.status(200).json({ ok: true, lists });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");

  const apiKey = process.env.SENDGRID_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "SendGrid not configured" });

  const { listId, exportId } = req.query;

  try {
    // Step 3: Check export status and get results
    if (exportId) {
      const resp = await fetch(`https://api.sendgrid.com/v3/marketing/contacts/exports/${exportId}`, {
        headers: { "Authorization": `Bearer ${apiKey}` },
      });
      const data = await resp.json();

      if (data.status === "ready" && data.urls?.length) {
        // Download the CSV
        const csvResp = await fetch(data.urls[0]);
        const csvText = await csvResp.text();

        // Parse CSV
        const lines = csvText.split("\n").filter(l => l.trim());
        if (lines.length < 2) return res.status(200).json({ ok: true, contacts: [], status: "ready" });

        const headers = lines[0].split(",").map(h => h.trim().toLowerCase().replace(/"/g, ""));
        const emailIdx = headers.indexOf("email");
        const fnIdx = headers.indexOf("first_name");
        const lnIdx = headers.indexOf("last_name");

        const contacts = lines.slice(1).map(line => {
          const cols = line.match(/("([^"]*)"|[^,]*)/g)?.map(c => c.replace(/^"|"$/g, "").trim()) || [];
          return {
            email: cols[emailIdx] || "",
            name: [cols[fnIdx], cols[lnIdx]].filter(Boolean).join(" ") || "",
          };
        }).filter(c => c.email && c.email.includes("@"));

        return res.status(200).json({ ok: true, contacts, total: contacts.length, status: "ready" });
      }

      return res.status(200).json({ ok: true, status: data.status || "pending", contacts: [] });
    }

    // Step 2: Start export for a specific list
    if (listId) {
      const resp = await fetch("https://api.sendgrid.com/v3/marketing/contacts/exports", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          list_ids: [listId],
          file_type: "csv",
        }),
      });

      if (!resp.ok) {
        const text = await resp.text();
        throw new Error(`SendGrid ${resp.status}: ${text}`);
      }

      const data = await resp.json();
      return res.status(200).json({ ok: true, exportId: data.id, status: "pending" });
    }

    // Step 1: Fetch all lists
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

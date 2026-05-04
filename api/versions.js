import { createClient } from "@supabase/supabase-js";
import { applyCors, requireAuth } from "./_helpers.js";

/**
 * /api/versions — versioned snapshots of a daily.
 *
 *   GET  /api/versions?date=YYYY-MM-DD
 *      → list versions for that date (without state, for the table view)
 *   GET  /api/versions?id=<uuid>
 *      → load one version's full state (for restore)
 *   POST /api/versions
 *      body: { date, state, label? }
 *      → save a new version
 *   DELETE /api/versions?id=<uuid>
 *      → delete a single version
 *
 * Requires Supabase JWT auth — same pattern as /api/ai-draft and
 * /api/link-meta. Anonymous calls bounce with 401.
 *
 * Errors:
 *   400 — missing required params
 *   401 — auth failed
 *   404 — version id not found (GET by id)
 *   500 — Supabase error (table missing, network, etc.)
 *
 * The dailies table holds the live working copy (one row / date).
 * This table holds the immutable rollback log: many rows per date,
 * each a snapshot of the state at save time. Restore = read the
 * row's state and let the client write it back into the live store.
 */

let _supabase;
function getSupabase() {
  if (_supabase) return _supabase;
  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  _supabase = createClient(url, key);
  return _supabase;
}

export default async function handler(req, res) {
  applyCors(req, res);
  if (req.method === "OPTIONS") return res.status(200).end();

  const auth = await requireAuth(req);
  if (!auth.ok) return res.status(401).json({ error: "Auth required" });

  const supabase = getSupabase();
  if (!supabase) return res.status(500).json({ error: "Supabase not configured" });

  if (req.method === "POST") {
    const { date, state, label } = req.body || {};
    if (!date || !state) return res.status(400).json({ error: "Missing date or state" });

    const finalLabel =
      label ||
      `Auto · ${new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false })}`;

    const { data, error } = await supabase
      .from("daily_versions")
      .insert({ daily_date: date, label: finalLabel, state })
      .select("id, daily_date, label, created_at")
      .single();

    if (error) {
      // Table-not-found surfaces a hint rather than a generic 500
      // so an analyst running the schema migration sees what's up.
      if (error.code === "42P01") {
        return res.status(500).json({ error: "daily_versions table not created — run supabase-schema.sql" });
      }
      return res.status(500).json({ error: error.message });
    }
    return res.status(200).json({ ok: true, version: data });
  }

  if (req.method === "DELETE") {
    const id = req.query?.id;
    if (!id) return res.status(400).json({ error: "Missing id" });
    const { error } = await supabase.from("daily_versions").delete().eq("id", id);
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ ok: true });
  }

  if (req.method === "GET") {
    const { id, date } = req.query || {};

    if (id) {
      // Load the full state for restore — heavier payload, kept on
      // a separate code path so the list response stays light.
      const { data, error } = await supabase
        .from("daily_versions")
        .select("id, daily_date, label, created_at, state")
        .eq("id", id)
        .single();
      if (error) {
        if (error.code === "PGRST116") return res.status(404).json({ error: "Version not found" });
        return res.status(500).json({ error: error.message });
      }
      return res.status(200).json({ ok: true, version: data });
    }

    if (!date) return res.status(400).json({ error: "Missing date or id param" });

    // List response excludes state to keep payloads small — table
    // views only need the metadata. The id is enough to round-trip
    // back to the GET-by-id branch on restore.
    const { data, error } = await supabase
      .from("daily_versions")
      .select("id, daily_date, label, created_at")
      .eq("daily_date", date)
      .order("created_at", { ascending: false });

    if (error) {
      if (error.code === "42P01") {
        return res.status(200).json({ ok: true, versions: [] });
      }
      return res.status(500).json({ error: error.message });
    }
    return res.status(200).json({ ok: true, versions: data || [] });
  }

  return res.status(405).json({ error: "Method not allowed" });
}

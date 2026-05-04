import { authedFetch } from "./authedFetch";
import type { DailyState } from "../types";

/** Metadata for one persisted version — list-view shape, no state. */
export interface VersionMeta {
  id: string;
  daily_date: string;
  label: string | null;
  created_at: string;
}

/** Full version with state — used on restore. */
export interface VersionFull extends VersionMeta {
  state: DailyState;
}

/**
 * Save a snapshot of the current daily state to the rollback log.
 * `label` is optional — the server auto-generates "Auto · HH:MM"
 * when missing, so analysts don't have to type a label every save.
 */
export async function saveVersion(
  date: string,
  state: DailyState,
  label?: string,
): Promise<VersionMeta | null> {
  const resp = await authedFetch("/api/versions", {
    method: "POST",
    body: JSON.stringify({ date, state, label }),
  });
  const data = await resp.json();
  if (!data?.ok) return null;
  return data.version as VersionMeta;
}

/**
 * List versions for a date — newest first. State is NOT included
 * (heavy payload); call `loadVersion(id)` to fetch a single one's
 * full state when the analyst clicks Restore.
 */
export async function listVersions(date: string): Promise<VersionMeta[]> {
  const resp = await authedFetch(`/api/versions?date=${encodeURIComponent(date)}`);
  const data = await resp.json();
  if (!data?.ok) return [];
  return (data.versions || []) as VersionMeta[];
}

/** Load one version's full state — used on restore. */
export async function loadVersion(id: string): Promise<VersionFull | null> {
  const resp = await authedFetch(`/api/versions?id=${encodeURIComponent(id)}`);
  const data = await resp.json();
  if (!data?.ok) return null;
  return data.version as VersionFull;
}

/** Delete one version. */
export async function deleteVersion(id: string): Promise<boolean> {
  const resp = await authedFetch(`/api/versions?id=${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
  const data = await resp.json();
  return Boolean(data?.ok);
}

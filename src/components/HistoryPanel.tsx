import React, { useState, useEffect } from "react";
import { BRAND } from "../constants/brand";
import { listDailies, loadDaily, deleteDaily } from "../lib/dailyApi";
import { supabase } from "../lib/supabase";
import useDailyStore from "../store/useDailyStore";
import type { DailyState } from "../types";

interface HistoryPanelProps {
  open: boolean;
  onClose: () => void;
}

interface DailyListItem {
  id: string;
  date: string;
  updated_at: string;
  state?: DailyState;
}

export default function HistoryPanel({ open, onClose }: HistoryPanelProps): React.ReactElement | null {
  const [dailies, setDailies] = useState<DailyListItem[]>([]);
  const [loading, setLoading] = useState<boolean>(false);

  useEffect(() => {
    if (open && supabase) {
      setLoading(true);
      listDailies(50).then(setDailies).finally(() => setLoading(false));
    }
  }, [open]);

  if (!open) return null;

  const handleLoad = async (date: string): Promise<void> => {
    if (!window.confirm(`Load daily from ${date}? Current unsaved changes will be lost.`)) return;
    try {
      const daily = await loadDaily(date);
      if (daily?.state) {
        useDailyStore.setState({ ...daily.state });
        onClose();
      }
    } catch (err) {
      alert("Failed to load: " + (err as Error).message);
    }
  };

  const handleDuplicate = async (sourceDate: string): Promise<void> => {
    const today = new Date().toISOString().split("T")[0];
    if (!window.confirm(`Duplicate daily from ${sourceDate} as today's (${today})?`)) return;
    try {
      const source = await loadDaily(sourceDate);
      if (source?.state) {
        const prev = useDailyStore.getState();
        useDailyStore.setState({
          ...source.state,
          date: today,
          analysts: prev.analysts,
          signatures: prev.signatures,
        });
        onClose();
      }
    } catch (err) {
      alert("Failed to duplicate: " + (err as Error).message);
    }
  };

  const handleDelete = async (id: string, date: string): Promise<void> => {
    if (!window.confirm(`Delete daily from ${date}? This cannot be undone.`)) return;
    try {
      await deleteDaily(id);
      setDailies((d) => d.filter((x) => x.id !== id));
    } catch (err) {
      alert("Failed to delete: " + (err as Error).message);
    }
  };

  return (
    <div style={{
      position: "fixed", top: 0, right: 0, bottom: 0, width: 360,
      background: "var(--bg-card)", boxShadow: "var(--shadow-panel)",
      zIndex: 1000, display: "flex", flexDirection: "column", animation: "slideInRight 0.2s ease",
    }}>
      <div style={{
        background: BRAND.navy, padding: "16px 20px",
        display: "flex", justifyContent: "space-between", alignItems: "center",
      }}>
        <span style={{ color: "#fff", fontSize: 14, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1 }}>
          Daily History
        </span>
        <button onClick={onClose} style={{
          background: "none", border: "none", color: BRAND.sky,
          fontSize: 20, cursor: "pointer",
        }}>
          {"\u00D7"}
        </button>
      </div>
      <div style={{ flex: 1, overflow: "auto", padding: 16 }}>
        {!supabase && (
          <p style={{ fontSize: 12, color: "#999", textAlign: "center", padding: 20 }}>
            Supabase not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to enable history.
          </p>
        )}
        {loading && <p style={{ fontSize: 12, color: "#666", textAlign: "center" }}>Loading...</p>}
        {!loading && dailies.length === 0 && supabase && (
          <p style={{ fontSize: 12, color: "#999", textAlign: "center" }}>No saved dailies yet.</p>
        )}
        {dailies.map((d) => (
          <div key={d.id} style={{
            padding: 12, marginBottom: 8, borderRadius: 6,
            border: "1px solid var(--border-light)", background: "var(--bg-card-alt)",
          }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)", marginBottom: 4 }}>
              {d.date}
            </div>
            <div style={{ fontSize: 10, color: "#999", marginBottom: 8 }}>
              Updated: {new Date(d.updated_at).toLocaleString()}
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              <button onClick={() => handleLoad(d.date)} style={{
                padding: "4px 10px", borderRadius: 4, border: `1px solid ${BRAND.blue}`,
                background: "transparent", color: BRAND.blue, fontSize: 10,
                fontWeight: 600, cursor: "pointer",
              }}>
                Load
              </button>
              <button onClick={() => handleDuplicate(d.date)} style={{
                padding: "4px 10px", borderRadius: 4, border: `1px solid ${BRAND.teal}`,
                background: "transparent", color: BRAND.teal, fontSize: 10,
                fontWeight: 600, cursor: "pointer",
              }}>
                Duplicate
              </button>
              <button onClick={() => handleDelete(d.id, d.date)} style={{
                padding: "4px 10px", borderRadius: 4, border: "1px solid #c0392b",
                background: "transparent", color: "#c0392b", fontSize: 10,
                fontWeight: 600, cursor: "pointer",
              }}>
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

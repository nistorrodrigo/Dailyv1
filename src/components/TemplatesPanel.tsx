import React, { useState, useEffect } from "react";
import { BRAND } from "../constants/brand";
import { listTemplates, saveTemplate, deleteTemplate } from "../lib/templatesApi";
import { supabase } from "../lib/supabase";
import useDailyStore from "../store/useDailyStore";
import type { Section, DailyState } from "../types";

interface TemplatesPanelProps {
  open: boolean;
  onClose: () => void;
}

interface TemplateItem {
  id: string;
  name: string;
  created_at: string;
  state: { sections?: Section[] };
}

export default function TemplatesPanel({ open, onClose }: TemplatesPanelProps): React.ReactElement | null {
  const [templates, setTemplates] = useState<TemplateItem[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [newName, setNewName] = useState<string>("");

  useEffect(() => {
    if (open && supabase) {
      setLoading(true);
      listTemplates().then(setTemplates).finally(() => setLoading(false));
    }
  }, [open]);

  if (!open) return null;

  const handleSave = async (): Promise<void> => {
    if (!newName.trim()) return alert("Enter a template name");
    try {
      const fullState = useDailyStore.getState();
      const sectionsConfig = fullState.sections;
      await saveTemplate(newName.trim(), { sections: sectionsConfig } as DailyState);
      setNewName("");
      const updated = await listTemplates();
      setTemplates(updated);
    } catch (err) {
      alert("Failed to save: " + (err as Error).message);
    }
  };

  const handleLoad = (template: TemplateItem): void => {
    if (!window.confirm(`Load template "${template.name}"? This will update section toggles.`)) return;
    const current = useDailyStore.getState();
    if (template.state.sections) {
      useDailyStore.setState({ sections: template.state.sections });
    }
    onClose();
  };

  const handleDelete = async (id: string): Promise<void> => {
    if (!window.confirm("Delete this template?")) return;
    try {
      await deleteTemplate(id);
      setTemplates((t) => t.filter((x) => x.id !== id));
    } catch (err) {
      alert("Failed to delete: " + (err as Error).message);
    }
  };

  return (
    <div style={{
      position: "fixed", top: 0, right: 0, bottom: 0, width: 360,
      background: "var(--bg-card)", boxShadow: "var(--shadow-panel)",
      zIndex: 1000, display: "flex", flexDirection: "column",
    }}>
      <div style={{
        background: BRAND.navy, padding: "16px 20px",
        display: "flex", justifyContent: "space-between", alignItems: "center",
      }}>
        <span style={{ color: "#fff", fontSize: 14, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1 }}>
          Templates
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
            Supabase not configured. Templates require Supabase.
          </p>
        )}
        {supabase && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ display: "flex", gap: 8 }}>
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Template name..."
                style={{
                  flex: 1, padding: "8px 10px", borderRadius: 6,
                  border: "1px solid #d0d5dd", fontSize: 12,
                }}
              />
              <button onClick={handleSave} style={{
                padding: "8px 14px", borderRadius: 6, border: "none",
                background: BRAND.blue, color: "#fff", fontSize: 11,
                fontWeight: 700, cursor: "pointer",
              }}>
                Save Current
              </button>
            </div>
            <p style={{ fontSize: 10, color: "#999", marginTop: 4 }}>
              Saves current section toggle configuration as a template.
            </p>
          </div>
        )}
        {loading && <p style={{ fontSize: 12, color: "#666", textAlign: "center" }}>Loading...</p>}
        {templates.map((t) => (
          <div key={t.id} style={{
            padding: 12, marginBottom: 8, borderRadius: 6,
            border: "1px solid var(--border-light)", background: "var(--bg-card-alt)",
          }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: BRAND.navy, marginBottom: 4 }}>
              {t.name}
            </div>
            <div style={{ fontSize: 10, color: "#999", marginBottom: 8 }}>
              Created: {new Date(t.created_at).toLocaleString()}
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              <button onClick={() => handleLoad(t)} style={{
                padding: "4px 10px", borderRadius: 4, border: `1px solid ${BRAND.blue}`,
                background: "transparent", color: BRAND.blue, fontSize: 10,
                fontWeight: 600, cursor: "pointer",
              }}>
                Apply
              </button>
              <button onClick={() => handleDelete(t.id)} style={{
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

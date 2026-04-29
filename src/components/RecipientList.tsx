import React, { useMemo, useState } from "react";
import { BRAND } from "../constants/brand";

export interface Recipient {
  id: string | number;
  email: string;
  name: string;
  active: boolean;
}

export interface RecipientListProps {
  recipients: Recipient[];
  loading?: boolean;
  onToggle: (id: Recipient["id"], active: boolean) => void;
  onRemove: (id: Recipient["id"]) => void;
  onBulkToggle?: (ids: Recipient["id"][], active: boolean) => void;
}

/**
 * The list of recipients shown inside EmailSendPanel: each row has a checkbox
 * to toggle active and an X to remove. Stateless re. data — parent owns it.
 *
 * For large imported lists (e.g. 4000+ from SendGrid), provides:
 *  - case-insensitive search across name + email
 *  - "Show only active" filter
 *  - "Activate all shown" / "Deactivate all shown" bulk actions
 *  - virtualization-free render up to ~5k via a max-height + overflow scroll
 */
export default function RecipientList({
  recipients,
  loading,
  onToggle,
  onRemove,
  onBulkToggle,
}: RecipientListProps): React.ReactElement {
  const [search, setSearch] = useState("");
  const [activeOnly, setActiveOnly] = useState(false);

  const activeCount = useMemo(() => recipients.filter((r) => r.active).length, [recipients]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return recipients.filter((r) => {
      if (activeOnly && !r.active) return false;
      if (!q) return true;
      return r.email.toLowerCase().includes(q) || r.name.toLowerCase().includes(q);
    });
  }, [recipients, search, activeOnly]);

  const bulkSet = (active: boolean) => {
    if (!onBulkToggle) {
      visible.forEach((r) => { if (r.active !== active) onToggle(r.id, active); });
      return;
    }
    onBulkToggle(visible.map((r) => r.id), active);
  };

  const showFilters = recipients.length > 10;

  return (
    <div style={{ marginBottom: 16 }}>
      <div className="flex items-baseline justify-between mb-1">
        <label style={{ fontSize: 11, fontWeight: 600, color: "#555", textTransform: "uppercase" }}>
          Recipients ({activeCount} active{recipients.length !== activeCount ? ` of ${recipients.length}` : ""})
        </label>
        {showFilters && (
          <span className="text-[10px] text-[var(--text-muted)]">
            {visible.length}/{recipients.length} shown
          </span>
        )}
      </div>

      {showFilters && (
        <>
          <div className="flex gap-2 mb-2">
            <input
              value={search}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearch(e.target.value)}
              placeholder="Search name or email..."
              className="themed-input flex-1 px-2 py-1.5 rounded border border-[var(--border-input)] text-[12px] bg-[var(--bg-input)] text-[var(--text-primary)]"
            />
            <label className="flex items-center gap-1.5 text-[11px] text-[var(--text-muted)] cursor-pointer whitespace-nowrap">
              <input type="checkbox" checked={activeOnly} onChange={(e) => setActiveOnly(e.target.checked)} />
              Active only
            </label>
          </div>
          <div className="flex gap-3 mb-2 text-[10px] font-semibold">
            <button onClick={() => bulkSet(true)} className="bg-transparent border-none cursor-pointer p-0" style={{ color: BRAND.sky }}>
              Activate all shown
            </button>
            <button onClick={() => bulkSet(false)} className="bg-transparent border-none cursor-pointer p-0 text-[var(--text-muted)]">
              Deactivate all shown
            </button>
            {(search || activeOnly) && (
              <button
                onClick={() => { setSearch(""); setActiveOnly(false); }}
                className="bg-transparent border-none cursor-pointer p-0 ml-auto text-red-500"
              >
                Clear filters
              </button>
            )}
          </div>
        </>
      )}

      {loading && <p style={{ fontSize: 12, color: "#666" }}>Loading...</p>}
      {!loading && recipients.length === 0 && (
        <p className="text-[11px] text-[var(--text-muted)] italic py-2">
          No recipients yet. Add manually or import from a SendGrid list above.
        </p>
      )}
      {!loading && recipients.length > 0 && visible.length === 0 && (
        <p className="text-[11px] text-[var(--text-muted)] italic py-2">
          No recipients match your filters.
        </p>
      )}

      <div style={{ maxHeight: recipients.length > 30 ? 300 : undefined, overflow: recipients.length > 30 ? "auto" : undefined }}>
        {visible.map((r) => (
          <div
            key={r.id}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "6px 8px",
              marginBottom: 4,
              borderRadius: 4,
              background: r.active ? "#f0f6ff" : "#fafafa",
              border: `1px solid ${r.active ? BRAND.sky + "40" : "#eee"}`,
            }}
          >
            <input
              type="checkbox"
              checked={r.active}
              onChange={(e) => onToggle(r.id, e.target.checked)}
            />
            <span style={{ flex: 1, fontSize: 12, color: r.active ? "#333" : "#999" }}>
              {r.name ? `${r.name} <${r.email}>` : r.email}
            </span>
            <button
              onClick={() => onRemove(r.id)}
              style={{
                background: "none",
                border: "none",
                color: "#c0392b",
                cursor: "pointer",
                fontSize: 14,
                padding: 0,
              }}
            >
              {"×"}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

import React from "react";
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
}

/**
 * The list of recipients shown inside EmailSendPanel: each row has a checkbox
 * to toggle active and an X to remove. Stateless — parent owns the data.
 */
export default function RecipientList({
  recipients,
  loading,
  onToggle,
  onRemove,
}: RecipientListProps): React.ReactElement {
  return (
    <div style={{ marginBottom: 16 }}>
      <label
        style={{
          fontSize: 11,
          fontWeight: 600,
          color: "#555",
          textTransform: "uppercase",
          display: "block",
          marginBottom: 4,
        }}
      >
        Recipients ({recipients.filter((r) => r.active).length} active)
      </label>
      {loading && <p style={{ fontSize: 12, color: "#666" }}>Loading...</p>}
      {recipients.map((r) => (
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
  );
}

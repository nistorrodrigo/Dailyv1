import React from "react";
import type { NewsLink } from "../../types";
import { X } from "./X";

export interface NewsLinksEditorProps {
  links: NewsLink[] | undefined;
  onChange: (next: NewsLink[]) => void;
  /** Optional label shown above the editor; defaults to "News Links". */
  label?: string;
}

/**
 * Compact editor for a list of {label, url} news links. Used inside
 * MacroSection and CorporateSection blocks so the user can attach
 * source articles to each item.
 *
 * The component is stateless — parent owns the array. Empty rows are
 * tolerated; render-side filters discard rows missing a URL.
 */
export default function NewsLinksEditor({ links, onChange, label = "News Links" }: NewsLinksEditorProps): React.ReactElement {
  const list = links || [];

  const updateAt = (i: number, key: keyof NewsLink, value: string) => {
    const next = list.map((l, j) => (j === i ? { ...l, [key]: value } : l));
    onChange(next);
  };

  const removeAt = (i: number) => onChange(list.filter((_, j) => j !== i));
  const add = () => onChange([...list, { label: "", url: "" }]);

  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
        <label style={{ fontSize: 11, fontWeight: 600, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: 0.5 }}>
          {label}
        </label>
        <button
          onClick={add}
          style={{
            background: "transparent",
            border: "1px dashed var(--border-input)",
            borderRadius: 4,
            color: "var(--text-muted)",
            fontSize: 10,
            fontWeight: 600,
            padding: "3px 10px",
            cursor: "pointer",
          }}
        >
          + Add link
        </button>
      </div>

      {list.length === 0 && (
        <div style={{ fontSize: 11, color: "var(--text-muted)", fontStyle: "italic", padding: "4px 0" }}>
          No links yet.
        </div>
      )}

      {list.map((l, i) => (
        <div key={i} style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 4 }}>
          <input
            value={l.label}
            onChange={(e) => updateAt(i, "label", e.target.value)}
            placeholder="Label (e.g. Bloomberg)"
            style={{
              flex: 1,
              padding: "5px 8px",
              borderRadius: 4,
              border: "1px solid var(--border-input)",
              background: "var(--bg-input)",
              color: "var(--text-primary)",
              fontSize: 12,
            }}
          />
          <input
            value={l.url}
            onChange={(e) => updateAt(i, "url", e.target.value)}
            placeholder="https://..."
            style={{
              flex: 2,
              padding: "5px 8px",
              borderRadius: 4,
              border: "1px solid var(--border-input)",
              background: "var(--bg-input)",
              color: "var(--text-primary)",
              fontSize: 12,
              fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
            }}
          />
          <X onClick={() => removeAt(i)} />
        </div>
      ))}
    </div>
  );
}

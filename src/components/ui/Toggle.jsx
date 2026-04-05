import { BRAND } from "../../constants/brand";

export const Toggle = ({ checked, onChange, label }) => (
  <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", userSelect: "none" }}>
    <div
      onClick={() => onChange(!checked)}
      style={{
        width: 40, height: 22, borderRadius: 11, position: "relative",
        background: checked ? BRAND.blue : "#c8cdd3", transition: "background 0.2s",
      }}
    >
      <div style={{
        width: 18, height: 18, borderRadius: 9, background: "#fff",
        position: "absolute", top: 2, left: checked ? 20 : 2,
        transition: "left 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
      }} />
    </div>
    <span style={{ fontSize: 13, fontWeight: 600, color: checked ? "var(--text-primary)" : "var(--text-muted)" }}>{label}</span>
  </label>
);

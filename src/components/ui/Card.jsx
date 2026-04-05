import { BRAND } from "../../constants/brand";

export const Card = ({ title, children, color = BRAND.blue }) => (
  <div className="themed-card card-animated" style={{
    background: "var(--bg-card)", borderRadius: 10, marginBottom: 14,
    border: "1px solid var(--border-light)", overflow: "hidden",
    boxShadow: "var(--shadow-card)",
  }}>
    <div style={{
      background: color, padding: "9px 18px", fontSize: 11,
      fontWeight: 700, color: "#fff", letterSpacing: 1.2, textTransform: "uppercase",
    }}>
      {title}
    </div>
    <div style={{ padding: 18 }}>{children}</div>
  </div>
);

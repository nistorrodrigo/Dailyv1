import { BRAND } from "../../constants/brand";

export const Card = ({ title, children, color = BRAND.blue }) => (
  <div style={{
    background: "#fff", borderRadius: 8, marginBottom: 12,
    border: "1px solid #e4e8ed", overflow: "hidden",
    boxShadow: "0 1px 3px rgba(0,0,57,0.06)",
  }}>
    <div style={{
      background: color, padding: "8px 16px", fontSize: 11,
      fontWeight: 700, color: "#fff", letterSpacing: 1.2, textTransform: "uppercase",
    }}>
      {title}
    </div>
    <div style={{ padding: 16 }}>{children}</div>
  </div>
);

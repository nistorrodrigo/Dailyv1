import { BRAND } from "../../constants/brand";

export const DashBtn = ({ onClick, children, color = BRAND.blue }) => (
  <button
    onClick={onClick}
    style={{
      width: "100%", padding: 10,
      border: "2px dashed #d0d5dd", borderRadius: 6,
      background: "transparent", color, fontWeight: 600,
      fontSize: 12, cursor: "pointer",
    }}
  >
    {children}
  </button>
);

import { BRAND } from "../../constants/brand";

export const DashBtn = ({ onClick, children, color = BRAND.blue }) => (
  <button
    onClick={onClick}
    className="w-full py-2.5 border-2 border-dashed border-[var(--border-input)] rounded-md bg-transparent font-semibold text-xs cursor-pointer hover:border-[var(--text-muted)]"
    style={{ color }}
  >
    {children}
  </button>
);

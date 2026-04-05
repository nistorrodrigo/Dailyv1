import { BRAND } from "../../constants/brand";

export const Card = ({ title, children, color = BRAND.blue }) => (
  <div className="card-animated rounded-[10px] mb-3.5 border border-[var(--border-light)] overflow-hidden shadow-[var(--shadow-card)] bg-[var(--bg-card)]">
    <div
      className="px-4.5 py-2.5 text-[11px] font-bold text-white tracking-wider uppercase"
      style={{ background: color }}
    >
      {title}
    </div>
    <div className="p-4.5">{children}</div>
  </div>
);

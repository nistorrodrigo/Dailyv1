import { useState } from "react";
import { BRAND } from "../../constants/brand";

export const Card = ({ title, children, color = BRAND.blue, collapsible = true, defaultOpen = true }) => {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="card-animated rounded-[10px] mb-3.5 border border-[var(--border-light)] overflow-hidden shadow-[var(--shadow-card)] bg-[var(--bg-card)]">
      <div
        className={`px-4.5 py-2.5 text-[11px] font-bold text-white tracking-wider uppercase flex items-center justify-between ${collapsible ? "cursor-pointer select-none" : ""}`}
        style={{ background: color }}
        onClick={collapsible ? () => setOpen(!open) : undefined}
      >
        <span>{title}</span>
        {collapsible && (
          <span className="text-[14px] opacity-60 transition-transform duration-200" style={{ transform: open ? "rotate(0)" : "rotate(-90deg)" }}>
            {"\u25BC"}
          </span>
        )}
      </div>
      {open && <div className="p-4.5">{children}</div>}
    </div>
  );
};

import React from "react";
import { BRAND } from "../../constants/brand";

interface DashBtnProps {
  onClick: () => void;
  children: React.ReactNode;
  color?: string;
}

export const DashBtn = ({ onClick, children, color = BRAND.blue }: DashBtnProps) => (
  <button
    onClick={onClick}
    className="w-full py-2.5 border-2 border-dashed border-[var(--border-input)] rounded-md bg-transparent font-semibold text-xs cursor-pointer hover:border-[var(--text-muted)]"
    style={{ color }}
  >
    {children}
  </button>
);

import { BRAND } from "../../constants/brand";

interface ToggleProps {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}

export const Toggle = ({ checked, onChange, label }: ToggleProps) => (
  <label className="flex items-center gap-2.5 cursor-pointer select-none">
    <div
      onClick={() => onChange(!checked)}
      className="relative w-10 h-[22px] rounded-full transition-colors duration-200"
      style={{ background: checked ? BRAND.blue : "#c8cdd3" }}
    >
      <div
        className="absolute top-0.5 w-[18px] h-[18px] rounded-full bg-white shadow-sm transition-[left] duration-200"
        style={{ left: checked ? 20 : 2 }}
      />
    </div>
    <span className={`text-[13px] font-semibold ${checked ? "text-[var(--text-primary)]" : "text-[var(--text-muted)]"}`}>
      {label}
    </span>
  </label>
);

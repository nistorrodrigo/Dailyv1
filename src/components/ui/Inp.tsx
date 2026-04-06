interface InpProps {
  label?: string;
  value: string;
  onChange: (v: string) => void;
  multi?: boolean;
  rows?: number;
  placeholder?: string;
}

export const Inp = ({ label, value, onChange, multi, rows = 2, placeholder }: InpProps) => (
  <div className="mb-2.5">
    {label && (
      <label className="block mb-1 text-[11px] font-semibold text-[var(--text-secondary)] uppercase tracking-wide">
        {label}
      </label>
    )}
    {multi ? (
      <textarea
        className="themed-input w-full px-2.5 py-2 rounded-md border border-[var(--border-input)] text-[13px] font-sans leading-relaxed resize-y box-border bg-[var(--bg-input)] text-[var(--text-primary)]"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
        placeholder={placeholder}
      />
    ) : (
      <input
        className="themed-input w-full px-2.5 py-2 rounded-md border border-[var(--border-input)] text-[13px] font-sans box-border bg-[var(--bg-input)] text-[var(--text-primary)]"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
    )}
  </div>
);

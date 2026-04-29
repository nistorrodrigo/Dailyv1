import React from "react";

export interface ABTestSubjectProps {
  enabled: boolean;
  onToggle: () => void;
  subjectB: string;
  onSubjectBChange: (value: string) => void;
}

/**
 * A/B test subject line input. When enabled, recipients are split 50/50
 * between the panel's main subject (variant A) and `subjectB` (variant B).
 */
export default function ABTestSubject({
  enabled,
  onToggle,
  subjectB,
  onSubjectBChange,
}: ABTestSubjectProps): React.ReactElement {
  return (
    <div className="mb-3 p-3 rounded-md bg-[var(--bg-card-alt)] border border-[var(--border-light)]">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[11px] font-semibold text-[var(--text-secondary)] uppercase tracking-wide">A/B Test Subject</span>
        <button
          onClick={onToggle}
          className="text-[10px] text-[var(--text-muted)] bg-transparent border-none cursor-pointer"
        >
          {enabled ? "Disable" : "Enable"}
        </button>
      </div>
      {enabled && (
        <input
          value={subjectB}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => onSubjectBChange(e.target.value)}
          placeholder="Variant B subject line (50% of recipients get this)"
          className="themed-input w-full px-2.5 py-2 rounded-md border border-[var(--border-input)] text-[12px] bg-[var(--bg-input)] text-[var(--text-primary)]"
        />
      )}
      <div className="text-[9px] text-[var(--text-muted)] mt-1">Recipients split 50/50. Track opens per variant in Dashboard.</div>
    </div>
  );
}

import React, { useId } from "react";

interface InpProps {
  label?: string;
  value: string;
  onChange: (v: string) => void;
  multi?: boolean;
  rows?: number;
  placeholder?: string;
  /** Optional paste hook — used by smart-paste URL detection in body fields. */
  onPaste?: (e: React.ClipboardEvent<HTMLTextAreaElement | HTMLInputElement>) => void;
  /** Provide an explicit aria-label when the field has no visible `label`
   *  prop (e.g. an inline filter input). Silences the a11y "form field
   *  has no label" warning without forcing a visual label. */
  ariaLabel?: string;
  /** HTML input `type` for the single-line variant. Defaults to "text".
   *  Use "date" for an ISO date picker (browser-native calendar), "url"
   *  for link fields with built-in validation hints, etc. Ignored when
   *  `multi` is set since textareas don't take `type`. */
  type?: "text" | "date" | "url" | "email" | "number";
}

export const Inp = ({ label, value, onChange, multi, rows = 2, placeholder, onPaste, ariaLabel, type = "text" }: InpProps) => {
  // useId is stable across SSR and unmounts — gives this Inp instance a
  // unique id we can bind label.htmlFor → input.id, satisfying the
  // accessibility requirement that every form field has an associated
  // label.
  const fieldId = useId();
  return (
    <div className="mb-2.5">
      {label && (
        <label
          htmlFor={fieldId}
          className="block mb-1 text-[11px] font-semibold text-[var(--text-secondary)] uppercase tracking-wide"
        >
          {label}
        </label>
      )}
      {multi ? (
        <textarea
          id={fieldId}
          name={fieldId}
          aria-label={ariaLabel || label || placeholder || "input"}
          className="themed-input w-full px-2.5 py-2 rounded-md border border-[var(--border-input)] text-[13px] font-sans leading-relaxed resize-y box-border bg-[var(--bg-input)] text-[var(--text-primary)]"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onPaste={onPaste}
          rows={rows}
          placeholder={placeholder}
        />
      ) : (
        <input
          id={fieldId}
          name={fieldId}
          type={type}
          aria-label={ariaLabel || label || placeholder || "input"}
          className="themed-input w-full px-2.5 py-2 rounded-md border border-[var(--border-input)] text-[13px] font-sans box-border bg-[var(--bg-input)] text-[var(--text-primary)]"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onPaste={onPaste}
          placeholder={placeholder}
        />
      )}
    </div>
  );
};

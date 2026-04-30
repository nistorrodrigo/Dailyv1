import React, { forwardRef, useId } from "react";

/**
 * Small full-width input designed for use inside dense table rows
 * (Analyst coverage, Snapshot, Top Movers, Macro Estimates). The visual
 * tokens — padding, border, background, font — match what was
 * previously duplicated as a `const is = { … }` style object in every
 * Section that has a table.
 *
 * Centralising it here means:
 *   1. One source of truth for the look & feel; tweak the table-cell
 *      density once and every screen updates.
 *   2. The a11y plumbing (label-via-aria-label, useId-bound id) lives
 *      in one place rather than being re-implemented per-section.
 *   3. Per-cell styles still compose: callers pass `style` (e.g.
 *      `{ textAlign: "center" }`) and we merge it on top.
 *
 * Width defaults to 100% so the input fills its <td>; pass `width="auto"`
 * via `style` if you need a fixed-size variant. forwardRef so callers
 * can focus or measure the underlying input.
 */
export interface CompactInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "size"> {
  /** Visual size variant. "sm" = 5px padding, font 11px (densest table cells).
   *  "md" = 6px padding, font 12px (default). "lg" = 8px padding, font 13px. */
  size?: "sm" | "md" | "lg";
  /** Optional aria-label override. If omitted, uses placeholder. */
  ariaLabel?: string;
}

const SIZE_PADDING: Record<NonNullable<CompactInputProps["size"]>, string> = {
  sm: "5px 6px",
  md: "6px 8px",
  lg: "8px 10px",
};
const SIZE_FONT: Record<NonNullable<CompactInputProps["size"]>, number> = {
  sm: 11,
  md: 12,
  lg: 13,
};

export const CompactInput = forwardRef<HTMLInputElement, CompactInputProps>(function CompactInput(
  { size = "md", ariaLabel, style, placeholder, id, ...rest },
  ref,
) {
  const generatedId = useId();
  const inputId = id || generatedId;
  return (
    <input
      ref={ref}
      id={inputId}
      // Always provide an aria-label so screen readers can identify
      // the field even when there's no visible label (typical in
      // table rows). Falls back to the placeholder if nothing better
      // is supplied.
      aria-label={ariaLabel || rest["aria-label"] || placeholder || "input"}
      placeholder={placeholder}
      style={{
        padding: SIZE_PADDING[size],
        borderRadius: 4,
        border: "1px solid var(--border-input)",
        fontSize: SIZE_FONT[size],
        boxSizing: "border-box",
        width: "100%",
        background: "var(--bg-input)",
        color: "var(--text-primary)",
        ...style,
      }}
      {...rest}
    />
  );
});

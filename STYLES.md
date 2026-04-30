# Styling conventions

This file documents how styles are applied across the app. Read it before adding a new component or refactoring an existing one — the codebase mixes Tailwind utility classes with inline `style={{}}` attributes intentionally, and the rules for when to use which are not arbitrary.

---

## TL;DR

| Use case | Approach |
|---|---|
| Static layout (flex, grid, padding, gap, typography size) | **Tailwind** |
| Theme-aware colour referenced from CSS custom properties | **Tailwind arbitrary** (`bg-[var(--bg-card)]`) **or inline** (`style={{ background: "var(--bg-card)" }}`) — pick the more readable in context |
| Dynamic / computed values (state-driven colours, calculated heights, BRAND.* constants from JS) | **Inline `style`** |
| Repeated multi-property "shape" used across several files | **Extract to a UI primitive in `src/components/ui/`** |

---

## Why both?

Tailwind handles 95 % of layout spacing, flex/grid behaviour, typography size, and breakpoint logic perfectly. Inline `style` handles the remaining 5 %: values that come from JavaScript (`BRAND.navy`), runtime computations (`{ height: ${count/max*80}px }`), and conditional colours (`{ borderColor: error ? "#e74c3c" : "var(--border-input)" }`).

Trying to express dynamic values via Tailwind ends up with either Tailwind arbitrary classes that aren't really classes (`bg-[${BRAND.navy}]` doesn't work — JIT can't see the value) or `clsx` / `cva` indirection that's harder to read than the inline form. We picked the simpler convention.

---

## Existing primitives (`src/components/ui/`)

When a multi-property style shape repeats across two or more files, extract it here rather than duplicating the inline-style block.

| Primitive | What it is | When to use |
|---|---|---|
| `Card` | Coloured-header collapsible container with body slot | Every section in the Editor tab |
| `Inp` | Labelled input/textarea with `useId`-bound a11y wiring | Form fields with a visible label |
| `CompactInput` | Dense table-cell-sized `<input>` (3 sizes: sm / md / lg) | Inputs inside `<td>` rows — Snapshot, Top Movers, Analyst coverage, Macro Estimates |
| `Toggle` | Animated on/off switch | Section toggles, feature flags |
| `X` | Small "×" remove button | List-item delete buttons |
| `DashBtn` | Dashed "+ Add" button for list-row insertion | Row-add at the bottom of a list |
| `MarkdownEditor` | Textarea + live-rendered markdown preview | News links body, AI Review notes |
| `NewsLinksEditor` | Add/remove list of `{ source, url }` pairs | News-link footers under macro/corp blocks |
| `SortableList` | `@dnd-kit` wrapper for drag-to-reorder | Section reordering, recipient list |
| `LazySection` | Suspense + IntersectionObserver wrapper | Heavy sections that should defer until scrolled into view |

**Rule of thumb:** if you write the same `style={{ … }}` block in two files, the third occurrence is the one where you extract it.

---

## CSS custom properties (theme tokens)

The light/dark theme system lives in `src/theme.css`. Every theme-aware colour goes through one of these vars rather than a literal hex:

- `--bg-page`, `--bg-card`, `--bg-card-alt`, `--bg-input`, `--bg-tab-bar`
- `--text-primary`, `--text-secondary`, `--text-muted`
- `--border-light`, `--border-input`
- `--shadow-card`, `--shadow-panel`

In Tailwind: `bg-[var(--bg-card)]` / `text-[var(--text-muted)]` etc.
Inline: `style={{ background: "var(--bg-card)" }}`.

Brand colours that **don't** change between light/dark (the navy header, the sky accent, the green/orange status badges) come from `src/constants/brand.ts` as JS constants — `BRAND.navy`, `BRAND.blue`, `BRAND.sky`. These can only be inline because Tailwind can't see runtime values.

---

## Anti-patterns

These are things to avoid as the codebase grows:

- **`style={{ display: "flex" }}` for plain layout.** Use `className="flex"`. Inline style here gains nothing and makes scanning harder.
- **Hard-coded hex colours instead of theme tokens.** If you find `#fff`, `#000`, `#666` in component styles, check whether it should be `var(--text-primary)` etc. instead.
- **Recreating an existing primitive's shape inline.** If you find yourself writing `padding: "6px 8px", borderRadius: 4, border: "1px solid var(--border-input)"`, you want `<CompactInput>` instead.
- **`cn` / `clsx` chains for static class lists.** Just inline the string. Conditional classes are fine; static concatenation isn't.

---

## Adding a new section

A typical section component looks like:

```tsx
import { Card, CompactInput } from "../ui";
import { BRAND } from "../../constants/brand";
import useDailyStore from "../../store/useDailyStore";

export default function MySection() {
  const data = useDailyStore((s) => s.mySectionData);
  return (
    <Card title="My Section" color={BRAND.navy}>
      <div className="flex gap-2 mb-2">
        <CompactInput value={data.field1} onChange={…} placeholder="Field 1" />
        <CompactInput value={data.field2} onChange={…} placeholder="Field 2" />
      </div>
    </Card>
  );
}
```

That's the shape we want most new code to land in.

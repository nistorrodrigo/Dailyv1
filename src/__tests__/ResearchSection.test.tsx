import React from "react";
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import ResearchSection from "../components/sections/ResearchSection";
import useDailyStore from "../store/useDailyStore";
import { DEFAULT_STATE, STORAGE_KEY } from "../constants/defaultState";
import type { Analyst, ResearchReport } from "../types";

/**
 * RTL coverage for the Research Reports author dropdown.
 *
 * The dropdown is the surface the desk uses to attribute a report
 * to a catalogue analyst (with a free-text "External / other…"
 * escape hatch for visiting authors). Three independent state
 * pieces drive its rendering — `r.analystId`, `r.author`, and the
 * derived `useExternal` boolean — which is enough surface for
 * "looks right but doesn't actually update" bugs. This file pins:
 *
 *   - Renders all catalogue analysts as options
 *   - Selecting an analyst writes `analystId` + clears free-text
 *     `author` (so the resolved name wins on render)
 *   - Selecting "External / other…" sets `analystId=""` AND shows
 *     the free-text input
 *   - External author text writes back to `r.author`
 *   - Off-toggle for the section returns null (no leak when the
 *     analyst hides Research Reports)
 *   - + Add Research Report appends a new row; × removes it
 *   - Type dropdown only contains the strict union values
 */

const SAMPLE_ANALYSTS: Analyst[] = [
  { id: "a1", name: "Mariana Pérez", title: "Macro Strategist", coverage: [] },
  { id: "a2", name: "Tomás García", title: "Equity Research", coverage: [] },
  { id: "a3", name: "Lucía Romero", title: "Fixed Income", coverage: [] },
];

function seedStore(overrides: { researchReports?: ResearchReport[]; analysts?: Analyst[] } = {}): void {
  const sections = DEFAULT_STATE.sections.map((s) =>
    s.key === "research" ? { ...s, on: true } : s,
  );
  useDailyStore.setState({
    ...JSON.parse(JSON.stringify(DEFAULT_STATE)),
    sections,
    analysts: overrides.analysts ?? SAMPLE_ANALYSTS,
    researchReports: overrides.researchReports ?? [],
  });
}

beforeEach(() => {
  if (typeof localStorage !== "undefined") {
    localStorage.removeItem(STORAGE_KEY);
  }
  seedStore();
});

describe("ResearchSection — visibility toggle", () => {
  it("returns null when the `research` section is toggled off", () => {
    const sections = DEFAULT_STATE.sections.map((s) =>
      s.key === "research" ? { ...s, on: false } : s,
    );
    useDailyStore.setState({
      ...JSON.parse(JSON.stringify(DEFAULT_STATE)),
      sections,
      researchReports: [{ id: "r1", type: "Macro", title: "Hidden", author: "", body: "", link: "" }],
    });
    const { container } = render(<ResearchSection />);
    // Section is off → no card, no rows, nothing rendered.
    expect(container.firstChild).toBeNull();
    expect(screen.queryByText("Hidden")).toBeNull();
  });
});

describe("ResearchSection — author dropdown population", () => {
  it("renders every catalogue analyst as an option (plus the placeholder + External)", () => {
    seedStore({ researchReports: [{ id: "r1", type: "Macro", title: "", author: "", body: "", link: "" }] });
    render(<ResearchSection />);
    // The Author <select> is the second select in the row (Type is first).
    const selects = screen.getAllByRole("combobox");
    const authorSelect = selects[1] as HTMLSelectElement;
    const optionValues = Array.from(authorSelect.options).map((o) => o.value);
    expect(optionValues).toContain("");                  // placeholder
    expect(optionValues).toContain("a1");                // catalogue
    expect(optionValues).toContain("a2");
    expect(optionValues).toContain("a3");
    expect(optionValues).toContain("__external__");      // escape hatch
    // And the visible label text for each catalogue option is the
    // analyst's name (not their id).
    expect(screen.getByRole("option", { name: "Mariana Pérez" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Tomás García" })).toBeInTheDocument();
  });

  it("shows the analyst's id as the selected value when `analystId` is set in state", () => {
    seedStore({ researchReports: [{ id: "r1", type: "Macro", title: "", author: "", analystId: "a2", body: "", link: "" }] });
    render(<ResearchSection />);
    const authorSelect = screen.getAllByRole("combobox")[1] as HTMLSelectElement;
    expect(authorSelect.value).toBe("a2");
  });

  it("shows `__external__` and the free-text input when state has free-text `author` but no `analystId`", () => {
    seedStore({ researchReports: [{ id: "r1", type: "Macro", title: "", author: "Visiting Author", body: "", link: "" }] });
    render(<ResearchSection />);
    const authorSelect = screen.getAllByRole("combobox")[1] as HTMLSelectElement;
    expect(authorSelect.value).toBe("__external__");
    // The free-text input is revealed and pre-populated with the author.
    expect(screen.getByPlaceholderText("External author name")).toHaveValue("Visiting Author");
  });

  it("shows the empty placeholder when neither analystId nor author is set", () => {
    seedStore({ researchReports: [{ id: "r1", type: "Macro", title: "", author: "", body: "", link: "" }] });
    render(<ResearchSection />);
    const authorSelect = screen.getAllByRole("combobox")[1] as HTMLSelectElement;
    expect(authorSelect.value).toBe("");
    expect(screen.queryByPlaceholderText("External author name")).toBeNull();
  });
});

describe("ResearchSection — author dropdown interactions", () => {
  it("writes `analystId` to the store when the analyst dropdown changes", () => {
    seedStore({ researchReports: [{ id: "r1", type: "Macro", title: "", author: "", body: "", link: "" }] });
    render(<ResearchSection />);
    const authorSelect = screen.getAllByRole("combobox")[1];
    fireEvent.change(authorSelect, { target: { value: "a1" } });
    const updated = useDailyStore.getState().researchReports[0];
    expect(updated.analystId).toBe("a1");
  });

  it("clears free-text `author` when the analyst picks a catalogue entry", () => {
    // Analyst initially typed a free-text author, then later picks a
    // catalogue analyst. The resolved-name path (analystId → catalogue)
    // takes precedence, so the free-text field must be wiped or the
    // BBG/HTML output would show the wrong name.
    seedStore({ researchReports: [{ id: "r1", type: "Macro", title: "", author: "Stale Free Text", body: "", link: "" }] });
    render(<ResearchSection />);
    const authorSelect = screen.getAllByRole("combobox")[1];
    fireEvent.change(authorSelect, { target: { value: "a3" } });
    const updated = useDailyStore.getState().researchReports[0];
    expect(updated.analystId).toBe("a3");
    expect(updated.author).toBe("");
  });

  it("persists the __external__ sentinel + reveals the free-text input when 'External / other…' is picked", () => {
    // Regression: previously the onChange wrote analystId="", and
    // since `useExternal` required non-empty `author`, the select
    // snapped back to the placeholder before the user could type
    // — the External input never appeared. Now we persist the
    // sentinel so the dropdown stays on External across renders.
    seedStore({ researchReports: [{ id: "r1", type: "Macro", title: "", author: "", analystId: "a1", body: "", link: "" }] });
    render(<ResearchSection />);
    const authorSelect = screen.getAllByRole("combobox")[1];
    fireEvent.change(authorSelect, { target: { value: "__external__" } });
    const updated = useDailyStore.getState().researchReports[0];
    expect(updated.analystId).toBe("__external__");
    // The input appears on the re-render even though `author` is
    // still empty — the sentinel keeps the dropdown in External
    // mode so the user can type their text in.
    expect(screen.getByPlaceholderText("External author name")).toBeInTheDocument();
  });

  it("writes free-text typing back to `author` when in External mode", () => {
    seedStore({ researchReports: [{ id: "r1", type: "Macro", title: "", author: "Existing", body: "", link: "" }] });
    render(<ResearchSection />);
    const input = screen.getByPlaceholderText("External author name");
    fireEvent.change(input, { target: { value: "New Visiting Author" } });
    const updated = useDailyStore.getState().researchReports[0];
    expect(updated.author).toBe("New Visiting Author");
  });
});

describe("ResearchSection — type dropdown", () => {
  it("only exposes the strict ReportType union values", () => {
    seedStore({ researchReports: [{ id: "r1", type: "Macro", title: "", author: "", body: "", link: "" }] });
    render(<ResearchSection />);
    const typeSelect = screen.getAllByRole("combobox")[0] as HTMLSelectElement;
    const optionValues = Array.from(typeSelect.options).map((o) => o.value);
    // Must match REPORT_TYPES exactly — drift would silently allow
    // a free-text string into the persisted `ResearchReport.type`
    // union and break downstream rendering.
    expect(optionValues).toEqual(["Macro", "Weekly", "Strategy", "Sector", "Special"]);
  });

  it("writes the new type to the store on change", () => {
    seedStore({ researchReports: [{ id: "r1", type: "Macro", title: "", author: "", body: "", link: "" }] });
    render(<ResearchSection />);
    const typeSelect = screen.getAllByRole("combobox")[0];
    fireEvent.change(typeSelect, { target: { value: "Strategy" } });
    expect(useDailyStore.getState().researchReports[0].type).toBe("Strategy");
  });
});

describe("ResearchSection — row CRUD", () => {
  it("adds a new report row when '+ Add Research Report' is clicked", () => {
    render(<ResearchSection />);
    expect(useDailyStore.getState().researchReports).toHaveLength(0);
    fireEvent.click(screen.getByText("+ Add Research Report"));
    const reports = useDailyStore.getState().researchReports;
    expect(reports).toHaveLength(1);
    // New row defaults: type Macro, empty everything else.
    expect(reports[0].type).toBe("Macro");
    expect(reports[0].title).toBe("");
    expect(reports[0].analystId).toBe("");
  });

  it("removes the row when its × button is clicked", () => {
    seedStore({
      researchReports: [
        { id: "r1", type: "Macro", title: "Keep me", author: "", body: "", link: "" },
        { id: "r2", type: "Weekly", title: "Delete me", author: "", body: "", link: "" },
      ],
    });
    render(<ResearchSection />);
    // Find the X for the second row. The X UI helper renders
    // U+00D7 (×, the multiplication sign — NOT U+2715 ✕). Match
    // exactly so a future swap to a different glyph (e.g. an SVG
    // icon) is caught here rather than at a-11y review time.
    const removeButtons = screen.getAllByText("×");
    expect(removeButtons.length).toBe(2);
    fireEvent.click(removeButtons[1]);
    const remaining = useDailyStore.getState().researchReports;
    expect(remaining).toHaveLength(1);
    expect(remaining[0].id).toBe("r1");
  });
});

import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import RecipientList, { type Recipient } from "../components/RecipientList";

const sample: Recipient[] = [
  { id: "1", email: "a@x.com", name: "Alice", active: true },
  { id: "2", email: "b@y.com", name: "Bob", active: false },
  { id: "3", email: "c@z.com", name: "", active: true },
];

describe("RecipientList", () => {
  it("renders each recipient row with name + email", () => {
    render(<RecipientList recipients={sample} onToggle={() => {}} onRemove={() => {}} />);
    expect(screen.getByText("Alice <a@x.com>")).toBeInTheDocument();
    expect(screen.getByText("Bob <b@y.com>")).toBeInTheDocument();
    // Empty name falls back to bare email.
    expect(screen.getByText("c@z.com")).toBeInTheDocument();
  });

  it("shows the active count in the label", () => {
    render(<RecipientList recipients={sample} onToggle={() => {}} onRemove={() => {}} />);
    // 2 of 3 are active.
    expect(screen.getByText(/2 active of 3/)).toBeInTheDocument();
  });

  it("calls onToggle with the right id when a checkbox is clicked", () => {
    const onToggle = vi.fn();
    render(<RecipientList recipients={sample} onToggle={onToggle} onRemove={() => {}} />);
    // The Alice row's checkbox starts checked → click flips it off.
    const aliceRow = screen.getByText("Alice <a@x.com>").closest("div")!;
    const checkbox = aliceRow.querySelector("input[type='checkbox']") as HTMLInputElement;
    fireEvent.click(checkbox);
    expect(onToggle).toHaveBeenCalledWith("1", false);
  });

  it("calls onRemove with the row id when × is clicked", () => {
    const onRemove = vi.fn();
    render(<RecipientList recipients={sample} onToggle={() => {}} onRemove={onRemove} />);
    const removeButtons = screen.getAllByRole("button");
    fireEvent.click(removeButtons[0]); // first × — Alice's
    expect(onRemove).toHaveBeenCalledWith("1");
  });

  it("does NOT show the search/filter UI for short lists (<= 10)", () => {
    render(<RecipientList recipients={sample} onToggle={() => {}} onRemove={() => {}} />);
    expect(screen.queryByPlaceholderText(/Search name or email/)).toBeNull();
  });

  it("shows search + filters once the list has > 10 recipients", () => {
    const big: Recipient[] = Array.from({ length: 15 }, (_, i) => ({
      id: String(i),
      email: `u${i}@example.com`,
      name: `User ${i}`,
      active: i % 2 === 0,
    }));
    render(<RecipientList recipients={big} onToggle={() => {}} onRemove={() => {}} />);
    expect(screen.getByPlaceholderText(/Search name or email/)).toBeInTheDocument();
    // "Active only" toggle label
    expect(screen.getByText(/Active only/)).toBeInTheDocument();
  });

  it("filters by search query", () => {
    const big: Recipient[] = Array.from({ length: 12 }, (_, i) => ({
      id: String(i),
      email: i === 5 ? "needle@special.com" : `u${i}@example.com`,
      name: i === 5 ? "Needle" : `User ${i}`,
      active: true,
    }));
    render(<RecipientList recipients={big} onToggle={() => {}} onRemove={() => {}} />);
    const search = screen.getByPlaceholderText(/Search name or email/);
    fireEvent.change(search, { target: { value: "needle" } });
    expect(screen.getByText("Needle <needle@special.com>")).toBeInTheDocument();
    expect(screen.queryByText("User 0 <u0@example.com>")).toBeNull();
  });

  it("shows a helpful empty state when there are no recipients", () => {
    render(<RecipientList recipients={[]} onToggle={() => {}} onRemove={() => {}} />);
    expect(screen.getByText(/No recipients yet/)).toBeInTheDocument();
  });
});

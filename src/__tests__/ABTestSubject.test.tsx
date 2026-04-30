import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import ABTestSubject from "../components/ABTestSubject";

describe("ABTestSubject", () => {
  it("starts collapsed when not enabled", () => {
    render(
      <ABTestSubject enabled={false} onToggle={() => {}} subjectB="" onSubjectBChange={() => {}} />,
    );
    // The Variant B input only exists when enabled.
    expect(screen.queryByPlaceholderText(/Variant B subject line/)).toBeNull();
    expect(screen.getByRole("button", { name: "Enable" })).toBeInTheDocument();
  });

  it("shows the input and a Disable button when enabled", () => {
    render(
      <ABTestSubject enabled={true} onToggle={() => {}} subjectB="Foo" onSubjectBChange={() => {}} />,
    );
    expect(screen.getByPlaceholderText(/Variant B subject line/)).toHaveValue("Foo");
    expect(screen.getByRole("button", { name: "Disable" })).toBeInTheDocument();
  });

  it("calls onToggle when the toggle button is clicked", () => {
    const onToggle = vi.fn();
    render(
      <ABTestSubject enabled={false} onToggle={onToggle} subjectB="" onSubjectBChange={() => {}} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Enable" }));
    expect(onToggle).toHaveBeenCalledOnce();
  });

  it("calls onSubjectBChange as the user types", () => {
    const onChange = vi.fn();
    render(
      <ABTestSubject enabled={true} onToggle={() => {}} subjectB="" onSubjectBChange={onChange} />,
    );
    const input = screen.getByPlaceholderText(/Variant B subject line/);
    fireEvent.change(input, { target: { value: "Hello B" } });
    expect(onChange).toHaveBeenCalledWith("Hello B");
  });
});

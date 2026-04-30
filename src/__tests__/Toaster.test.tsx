import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import Toaster from "../components/Toaster";
import useToastStore, { toast } from "../store/useToastStore";

beforeEach(() => {
  // Reset between tests so previous toasts don't leak.
  useToastStore.setState({ toasts: [] });
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("Toaster", () => {
  it("renders nothing when there are no toasts", () => {
    const { container } = render(<Toaster />);
    expect(container.querySelectorAll("[role='status'], [role='alert']").length).toBe(0);
  });

  it("renders a success toast with its message", () => {
    render(<Toaster />);
    act(() => { toast.success("Saved!"); });
    expect(screen.getByText("Saved!")).toBeInTheDocument();
    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("renders an error toast with role='alert'", () => {
    render(<Toaster />);
    act(() => { toast.error("Boom"); });
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByText("Boom")).toBeInTheDocument();
  });

  it("auto-dismisses after the configured duration", () => {
    render(<Toaster />);
    act(() => { toast.success("Briefly", 1000); });
    expect(screen.getByText("Briefly")).toBeInTheDocument();
    act(() => { vi.advanceTimersByTime(1100); });
    expect(screen.queryByText("Briefly")).toBeNull();
  });

  it("dismisses on user click of the × button", () => {
    render(<Toaster />);
    act(() => { toast.info("Click me"); });
    const dismiss = screen.getByLabelText("Dismiss");
    fireEvent.click(dismiss);
    expect(screen.queryByText("Click me")).toBeNull();
  });

  it("renders an action button and fires its callback", () => {
    const onAction = vi.fn();
    render(<Toaster />);
    act(() => {
      toast.info("Pasted a link", { action: { label: "Add", onClick: onAction } });
    });
    const action = screen.getByRole("button", { name: "Add" });
    fireEvent.click(action);
    expect(onAction).toHaveBeenCalledOnce();
    // Action click also dismisses the toast.
    expect(screen.queryByText("Pasted a link")).toBeNull();
  });

  it("does not auto-dismiss when durationMs is 0", () => {
    render(<Toaster />);
    act(() => { toast.info("Sticky", { durationMs: 0 }); });
    act(() => { vi.advanceTimersByTime(60_000); });
    expect(screen.getByText("Sticky")).toBeInTheDocument();
  });
});

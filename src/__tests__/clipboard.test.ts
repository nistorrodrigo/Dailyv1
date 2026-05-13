import { describe, it, expect, vi, beforeEach } from "vitest";

// Hoisted spy so `vi.mock` factories can close over a defined value.
// See useAutoSnapshot.test.tsx for the same pattern + rationale.
const { toastSuccessMock, toastErrorMock } = vi.hoisted(() => ({
  toastSuccessMock: vi.fn(),
  toastErrorMock: vi.fn(),
}));
vi.mock("../store/useToastStore", () => ({
  toast: { success: toastSuccessMock, error: toastErrorMock, info: vi.fn() },
}));

import { copyText } from "../utils/clipboard";

beforeEach(() => {
  toastSuccessMock.mockClear();
  toastErrorMock.mockClear();
  // Reset clipboard between tests — each test installs its own spy.
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: { writeText: vi.fn(() => Promise.resolve()) },
  });
});

describe("copyText", () => {
  it("returns true and calls clipboard.writeText with the input text", async () => {
    const writeSpy = vi.fn(() => Promise.resolve());
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: writeSpy } });
    const ok = await copyText("hello world");
    expect(ok).toBe(true);
    expect(writeSpy).toHaveBeenCalledWith("hello world");
  });

  it("shows a success toast when `successMessage` is provided", async () => {
    await copyText("x", { successMessage: "Copied 5 emails" });
    expect(toastSuccessMock).toHaveBeenCalledWith("Copied 5 emails");
  });

  it("does NOT show a success toast when `successMessage` is omitted", async () => {
    await copyText("x");
    expect(toastSuccessMock).not.toHaveBeenCalled();
  });

  it("returns false and shows the default error toast when writeText rejects", async () => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: vi.fn(() => Promise.reject(new Error("NotAllowedError"))) },
    });
    const ok = await copyText("x");
    expect(ok).toBe(false);
    expect(toastErrorMock).toHaveBeenCalledTimes(1);
    expect(toastErrorMock.mock.calls[0][0]).toMatch(/couldn't copy/i);
  });

  it("uses a custom error message when provided", async () => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: vi.fn(() => Promise.reject(new Error("Permission denied"))) },
    });
    const ok = await copyText("x", { errorMessage: "Clipboard blocked in iframe" });
    expect(ok).toBe(false);
    expect(toastErrorMock).toHaveBeenCalledWith("Clipboard blocked in iframe");
  });

  it("suppresses the error toast when `errorMessage: null` is passed", async () => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: vi.fn(() => Promise.reject(new Error("denied"))) },
    });
    const ok = await copyText("x", { errorMessage: null });
    expect(ok).toBe(false);
    expect(toastErrorMock).not.toHaveBeenCalled();
  });

  it("does not throw on rejection — return value is the only failure signal", async () => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: vi.fn(() => Promise.reject(new Error("denied"))) },
    });
    // Was: unhandled rejection bubbling to window.onunhandledrejection
    // and into Sentry every Safari/iframe/screen-share session. The
    // helper must swallow + return false instead.
    await expect(copyText("x", { errorMessage: null })).resolves.toBe(false);
  });
});

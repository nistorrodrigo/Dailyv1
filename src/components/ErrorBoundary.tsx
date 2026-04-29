import React, { Component, type ErrorInfo } from "react";
import { BRAND } from "../constants/brand";

interface ErrorBoundaryProps {
  children: React.ReactNode;
  /** Optional sink so a parent can wire Sentry/etc. without coupling this file to a vendor. */
  onError?: (error: Error, info: ErrorInfo) => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  componentStack: string;
}

/**
 * App-root error boundary. Renders a recovery UI instead of a white screen
 * when a child throws during render/lifecycle. Three things this version
 * does that a vanilla boundary doesn't:
 *
 *  1. Calls `props.onError` so an external observer (Sentry, console
 *     logger, custom telemetry) can be wired without the component
 *     having to know about it.
 *  2. Captures the component stack so the recovery UI can show it
 *     (collapsed by default) and the user can copy it into a bug report.
 *  3. Subscribes to `window.error` and `window.unhandledrejection` to
 *     also catch errors thrown outside the React render tree (async
 *     callbacks, microtasks, event handlers in third-party code) — these
 *     don't reach `componentDidCatch` and would otherwise be invisible.
 */
export default class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null, componentStack: "" };
    this.handleWindowError = this.handleWindowError.bind(this);
    this.handleRejection = this.handleRejection.bind(this);
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidMount(): void {
    window.addEventListener("error", this.handleWindowError);
    window.addEventListener("unhandledrejection", this.handleRejection);
  }

  componentWillUnmount(): void {
    window.removeEventListener("error", this.handleWindowError);
    window.removeEventListener("unhandledrejection", this.handleRejection);
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    this.setState({ componentStack: info.componentStack || "" });
    console.error("[ErrorBoundary] caught:", error, info);
    this.props.onError?.(error, info);
  }

  handleWindowError(event: ErrorEvent): void {
    // window.onerror catches uncaught synchronous errors (e.g. throws in
    // setTimeout callbacks, image-load errors). React's componentDidCatch
    // doesn't see these, so we forward to onError for telemetry.
    if (event.error instanceof Error) {
      this.props.onError?.(event.error, { componentStack: "(window.error)" });
    }
  }

  handleRejection(event: PromiseRejectionEvent): void {
    const reason = event.reason instanceof Error ? event.reason : new Error(String(event.reason));
    console.error("[ErrorBoundary] unhandled rejection:", reason);
    this.props.onError?.(reason, { componentStack: "(unhandledrejection)" });
  }

  copyDetails = (): void => {
    const { error, componentStack } = this.state;
    if (!error) return;
    const text = [
      `Error: ${error.message}`,
      `Stack:\n${error.stack || "(no stack)"}`,
      componentStack ? `Component stack:\n${componentStack}` : "",
      `URL: ${window.location.href}`,
      `User agent: ${navigator.userAgent}`,
      `Time: ${new Date().toISOString()}`,
    ].filter(Boolean).join("\n\n");
    navigator.clipboard.writeText(text).catch(() => {
      // Fallback if clipboard write fails (no HTTPS, no user gesture, etc.)
      console.log(text);
    });
  };

  recoverWithoutReload = (): void => {
    // Some errors are recoverable just by remounting the tree. Try that
    // before falling back to a hard reload.
    this.setState({ hasError: false, error: null, componentStack: "" });
  };

  hardReload = (): void => {
    window.location.reload();
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    const { error, componentStack } = this.state;
    const isDev = (typeof import.meta !== "undefined" && (import.meta as { env?: { DEV?: boolean } }).env?.DEV) === true;

    return (
      <div style={{
        minHeight: "100vh", display: "flex", alignItems: "center",
        justifyContent: "center", background: "var(--bg-page)",
        fontFamily: "'Segoe UI',sans-serif", padding: 16,
      }}>
        <div style={{
          maxWidth: 560, width: "100%", padding: 32, textAlign: "left",
          background: "var(--bg-card)", borderRadius: 12,
          border: "1px solid var(--border-light)",
          boxShadow: "var(--shadow-panel)",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
            <div style={{ width: 36, height: 36, borderRadius: "50%", background: "rgba(231,76,60,0.12)", color: "#c0392b", fontSize: 20, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>!</div>
            <div>
              <h2 style={{ color: "var(--text-primary)", margin: 0, fontSize: 18, fontWeight: 600 }}>
                Something went wrong
              </h2>
              <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>
                Your draft is saved automatically — reloading is safe.
              </div>
            </div>
          </div>

          <div style={{
            background: "var(--bg-card-alt)", border: "1px solid var(--border-light)",
            borderRadius: 6, padding: "10px 14px", marginBottom: 16,
            fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
            fontSize: 12, color: "#c0392b", wordBreak: "break-word",
          }}>
            {error?.message || "An unexpected error occurred."}
          </div>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
            <button
              onClick={this.recoverWithoutReload}
              style={{ padding: "9px 18px", borderRadius: 6, border: "1px solid var(--border-input)", background: "transparent", color: "var(--text-primary)", fontSize: 12, fontWeight: 700, cursor: "pointer" }}
            >
              Try again
            </button>
            <button
              onClick={this.hardReload}
              style={{ padding: "9px 18px", borderRadius: 6, border: "none", background: BRAND.blue, color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer" }}
            >
              Reload app
            </button>
            <button
              onClick={this.copyDetails}
              style={{ padding: "9px 18px", borderRadius: 6, border: "1px dashed var(--border-input)", background: "transparent", color: "var(--text-muted)", fontSize: 12, fontWeight: 600, cursor: "pointer", marginLeft: "auto" }}
              title="Copy the error details to share with support"
            >
              Copy details
            </button>
          </div>

          {isDev && error?.stack && (
            <details style={{ marginTop: 14 }}>
              <summary style={{ cursor: "pointer", fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 0.5, fontWeight: 600 }}>
                Stack trace (dev only)
              </summary>
              <pre style={{ marginTop: 8, padding: 10, background: "var(--bg-card-alt)", borderRadius: 4, fontSize: 11, lineHeight: 1.5, overflow: "auto", maxHeight: 240, fontFamily: "ui-monospace, monospace" }}>
                {error.stack}
                {componentStack && "\n\n" + componentStack}
              </pre>
            </details>
          )}
        </div>
      </div>
    );
  }
}

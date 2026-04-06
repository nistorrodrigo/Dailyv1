import { Component } from "react";
import { BRAND } from "../constants/brand";

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error("ErrorBoundary caught:", error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: "100vh", display: "flex", alignItems: "center",
          justifyContent: "center", background: "var(--bg-page)",
          fontFamily: "'Segoe UI',sans-serif",
        }}>
          <div style={{
            maxWidth: 480, padding: 40, textAlign: "center",
            background: "var(--bg-card)", borderRadius: 12,
            border: "1px solid var(--border-light)",
            boxShadow: "var(--shadow-panel)",
          }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>!</div>
            <h2 style={{ color: "var(--text-primary)", marginBottom: 8, fontSize: 18 }}>
              Something went wrong
            </h2>
            <p style={{ color: "var(--text-muted)", fontSize: 13, marginBottom: 20, lineHeight: 1.5 }}>
              {this.state.error?.message || "An unexpected error occurred."}
            </p>
            <button
              onClick={() => {
                this.setState({ hasError: false, error: null });
                window.location.reload();
              }}
              style={{
                padding: "10px 24px", borderRadius: 6, border: "none",
                background: BRAND.blue, color: "#fff", fontSize: 13,
                fontWeight: 700, cursor: "pointer",
              }}
            >
              Reload App
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

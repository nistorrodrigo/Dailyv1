import { useState, useEffect } from "react";
import { BRAND, LOGO_WHITE_URL } from "../constants/brand";
import { supabase } from "../lib/supabase";

const ALLOWED_DOMAIN = "latinsecurities.ar";

export default function LoginGate({ children }) {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [mode, setMode] = useState("login"); // "login" | "signup"
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!supabase) { setLoading(false); return; }

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => listener?.subscription?.unsubscribe();
  }, []);

  // If no Supabase configured, skip auth
  if (!supabase) return children;
  if (loading) return null;
  if (session) return children;

  const validateDomain = (email) => {
    const domain = email.split("@")[1]?.toLowerCase();
    return domain === ALLOWED_DOMAIN;
  };

  const handleSubmit = async () => {
    setError("");
    if (!email.trim() || !password.trim()) { setError("Email and password required"); return; }
    if (!validateDomain(email)) { setError(`Only @${ALLOWED_DOMAIN} emails allowed`); return; }
    if (password.length < 6) { setError("Password must be at least 6 characters"); return; }

    setSubmitting(true);
    try {
      if (mode === "signup") {
        const { error: err } = await supabase.auth.signUp({ email: email.trim(), password });
        if (err) throw err;
        setError("");
        setMode("login");
        alert("Account created! You can now log in.");
      } else {
        const { error: err } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (err) throw err;
      }
    } catch (err) {
      setError(err.message || "Authentication failed");
    } finally {
      setSubmitting(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setSession(null);
  };

  return (
    <div style={{
      minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
      background: BRAND.navy, fontFamily: "'Segoe UI',Calibri,Arial,sans-serif",
    }}>
      <div style={{
        width: 380, padding: 40, borderRadius: 12,
        background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
        backdropFilter: "blur(20px)", textAlign: "center",
      }}>
        <img src={LOGO_WHITE_URL} alt="Latin Securities" style={{ height: 36, marginBottom: 8 }} />
        <div style={{ fontSize: 10, letterSpacing: 1.5, color: BRAND.sky, textTransform: "uppercase", marginBottom: 28 }}>
          Daily Builder
        </div>

        <input
          type="email"
          value={email}
          onChange={(e) => { setEmail(e.target.value); setError(""); }}
          placeholder="email@latinsecurities.ar"
          autoFocus
          style={{
            width: "100%", padding: "11px 14px", borderRadius: 8,
            border: "1px solid rgba(255,255,255,0.2)",
            background: "rgba(255,255,255,0.08)", color: "#fff",
            fontSize: 13, outline: "none", boxSizing: "border-box",
            marginBottom: 10,
          }}
        />
        <input
          type="password"
          value={password}
          onChange={(e) => { setPassword(e.target.value); setError(""); }}
          onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
          placeholder="Password"
          style={{
            width: "100%", padding: "11px 14px", borderRadius: 8,
            border: `1px solid ${error ? "#e74c3c" : "rgba(255,255,255,0.2)"}`,
            background: "rgba(255,255,255,0.08)", color: "#fff",
            fontSize: 13, outline: "none", boxSizing: "border-box",
          }}
        />
        {error && <div style={{ color: "#e74c3c", fontSize: 11, marginTop: 8, fontWeight: 600 }}>{error}</div>}

        <button
          onClick={handleSubmit}
          disabled={submitting}
          style={{
            width: "100%", padding: "12px 20px", borderRadius: 8,
            border: "none", background: submitting ? "#555" : BRAND.blue,
            color: "#fff", fontSize: 13, fontWeight: 700,
            cursor: submitting ? "default" : "pointer",
            marginTop: 16, textTransform: "uppercase", letterSpacing: 1,
          }}
        >
          {submitting ? "..." : mode === "signup" ? "Create Account" : "Log In"}
        </button>

        <button
          onClick={() => { setMode(mode === "login" ? "signup" : "login"); setError(""); }}
          style={{
            background: "none", border: "none", color: BRAND.sky,
            fontSize: 11, cursor: "pointer", marginTop: 12, display: "block",
            width: "100%", textAlign: "center",
          }}
        >
          {mode === "login" ? "Need an account? Sign up" : "Already have an account? Log in"}
        </button>

        <div style={{ fontSize: 10, color: "rgba(255,255,255,0.25)", marginTop: 16 }}>
          Access restricted to @{ALLOWED_DOMAIN}
        </div>
      </div>
    </div>
  );
}

// Export logout for use in Header
export async function logout() {
  if (supabase) await supabase.auth.signOut();
  window.location.reload();
}

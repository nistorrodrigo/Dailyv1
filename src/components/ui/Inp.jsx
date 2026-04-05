export const Inp = ({ label, value, onChange, multi, rows = 2, placeholder }) => (
  <div style={{ marginBottom: 10 }}>
    {label && (
      <label style={{
        fontSize: 11, fontWeight: 600, color: "var(--text-secondary)",
        textTransform: "uppercase", letterSpacing: 0.5,
        display: "block", marginBottom: 4,
      }}>
        {label}
      </label>
    )}
    {multi ? (
      <textarea
        className="themed-input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
        placeholder={placeholder}
        style={{
          width: "100%", padding: "8px 10px", borderRadius: 6,
          border: "1px solid var(--border-input)", fontSize: 13,
          fontFamily: "'Segoe UI',sans-serif", resize: "vertical",
          lineHeight: 1.5, boxSizing: "border-box",
          background: "var(--bg-input)", color: "var(--text-primary)",
        }}
      />
    ) : (
      <input
        className="themed-input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          width: "100%", padding: "8px 10px", borderRadius: 6,
          border: "1px solid var(--border-input)", fontSize: 13,
          fontFamily: "'Segoe UI',sans-serif", boxSizing: "border-box",
          background: "var(--bg-input)", color: "var(--text-primary)",
        }}
      />
    )}
  </div>
);

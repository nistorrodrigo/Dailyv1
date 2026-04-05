export const X = ({ onClick }) => (
  <button
    onClick={onClick}
    style={{
      background: "none", border: "none", color: "#c0392b",
      cursor: "pointer", fontSize: 18, padding: "0 4px", lineHeight: 1,
    }}
  >
    {"\u00D7"}
  </button>
);

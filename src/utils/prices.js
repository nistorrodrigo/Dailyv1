export const parsePrice = (s) => {
  if (!s) return null;
  const n = parseFloat(String(s).replace(/[^0-9.]/g, ""));
  return isNaN(n) ? null : n;
};

export const calcUpside = (tp, last) => {
  const t = parsePrice(tp);
  const l = parsePrice(last);
  if (!t || !l || l === 0) return null;
  return (t / l - 1) * 100;
};

export const fmtUpside = (tp, last) => {
  const u = calcUpside(tp, last);
  if (u === null) return "";
  return u >= 0 ? `Upside +${u.toFixed(1)}%` : `Downside ${u.toFixed(1)}%`;
};

export const upsideColor = (tp, last) => {
  const u = calcUpside(tp, last);
  if (u === null) return "#666";
  return u >= 0 ? "#27864a" : "#c0392b";
};

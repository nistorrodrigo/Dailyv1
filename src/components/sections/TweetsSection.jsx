import { useShallow } from "zustand/react/shallow";
import useDailyStore from "../../store/useDailyStore";
import { Card, X, DashBtn } from "../ui";
import { BRAND } from "../../constants/brand";

const is = { padding: "6px 8px", borderRadius: 4, border: "1px solid #d0d5dd", fontSize: 12, boxSizing: "border-box" };
const ss = { ...is, background: "#fff" };

const SENTIMENTS = ["Bullish", "Bearish", "Neutral"];
const IMPACT_TYPES = ["Market", "Sector", "Stock"];

const sentimentColor = (s) =>
  s === "Bullish" ? "#27864a" : s === "Bearish" ? "#c0392b" : "#888";
const sentimentBg = (s) =>
  s === "Bullish" ? "#e8f5e9" : s === "Bearish" ? "#fbe9e7" : "#f0f0f0";

export default function TweetsSection() {
    const { sections, tweets } = useDailyStore(useShallow((s) => ({ sections: s.sections, tweets: s.tweets })));
    const addTweet = useDailyStore((s) => s.addTweet);
  const updateTweet = useDailyStore((s) => s.updateTweet);
  const removeTweet = useDailyStore((s) => s.removeTweet);

  if (!sections.find((x) => x.key === "tweets")?.on) return null;

  return (
    <Card title="Tweets / Market Noise" color={BRAND.navy}>
      {tweets.map((tw, i) => (
        <div key={i} style={{ marginBottom: 14, padding: 12, background: "#f8f9fa", borderRadius: 6, position: "relative" }}>
          <div style={{ position: "absolute", top: 8, right: 8 }}>
            <X onClick={() => removeTweet(i)} />
          </div>

          <div style={{ marginBottom: 8 }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: "#555", textTransform: "uppercase", letterSpacing: 0.5, display: "block", marginBottom: 4 }}>
              Content
            </label>
            <textarea
              value={tw.content}
              onChange={(e) => updateTweet(i, "content", e.target.value)}
              rows={2}
              placeholder="Tweet / post content..."
              style={{ ...is, width: "100%", resize: "vertical", fontFamily: "'Segoe UI',sans-serif" }}
            />
          </div>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-end" }}>
            <div style={{ flex: 1, minWidth: 160 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: "#555", textTransform: "uppercase", letterSpacing: 0.5, display: "block", marginBottom: 4 }}>
                Link
              </label>
              <input
                value={tw.link}
                onChange={(e) => updateTweet(i, "link", e.target.value)}
                placeholder="https://..."
                style={{ ...is, width: "100%" }}
              />
            </div>
            <div style={{ width: 90 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: "#555", textTransform: "uppercase", letterSpacing: 0.5, display: "block", marginBottom: 4 }}>
                Time
              </label>
              <input
                value={tw.time}
                onChange={(e) => updateTweet(i, "time", e.target.value)}
                placeholder="HH:MM"
                style={{ ...is, width: "100%" }}
              />
            </div>
            <div style={{ width: 110 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: "#555", textTransform: "uppercase", letterSpacing: 0.5, display: "block", marginBottom: 4 }}>
                Sentiment
              </label>
              <select
                value={tw.sentiment}
                onChange={(e) => updateTweet(i, "sentiment", e.target.value)}
                style={{ ...ss, width: "100%" }}
              >
                {SENTIMENTS.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            <div>
              <span style={{
                fontSize: 10, fontWeight: 700, padding: "3px 10px", borderRadius: 10,
                color: sentimentColor(tw.sentiment), background: sentimentBg(tw.sentiment),
              }}>
                {tw.sentiment}
              </span>
            </div>
          </div>

          <div style={{ display: "flex", gap: 8, marginTop: 8, alignItems: "flex-end" }}>
            <div style={{ width: 120 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: "#555", textTransform: "uppercase", letterSpacing: 0.5, display: "block", marginBottom: 4 }}>
                Impact Type
              </label>
              <select
                value={tw.impactType}
                onChange={(e) => updateTweet(i, "impactType", e.target.value)}
                style={{ ...ss, width: "100%" }}
              >
                {IMPACT_TYPES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: "#555", textTransform: "uppercase", letterSpacing: 0.5, display: "block", marginBottom: 4 }}>
                Impact Value
              </label>
              <input
                value={tw.impactValue}
                onChange={(e) => updateTweet(i, "impactValue", e.target.value)}
                placeholder="e.g. VIST, Financials, S&P"
                style={{ ...is, width: "100%" }}
              />
            </div>
          </div>
        </div>
      ))}
      <DashBtn onClick={addTweet}>+ Add Tweet / Post</DashBtn>
    </Card>
  );
}

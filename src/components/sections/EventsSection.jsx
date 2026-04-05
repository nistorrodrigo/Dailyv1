import useDailyStore from "../../store/useDailyStore";
import { Card, Inp, X, DashBtn } from "../ui";
import { BRAND } from "../../constants/brand";

const is = { padding: "6px 8px", borderRadius: 4, border: "1px solid #d0d5dd", fontSize: 12, boxSizing: "border-box" };
const ss = { ...is, background: "#fff" };

const EVENT_TYPES = ["Data Release", "Earnings", "Fed", "Other"];

export default function EventsSection() {
  const sections = useDailyStore((s) => s.sections);
  const events = useDailyStore((s) => s.events);
  const addEvent = useDailyStore((s) => s.addEvent);
  const updateEvent = useDailyStore((s) => s.updateEvent);
  const removeEvent = useDailyStore((s) => s.removeEvent);

  if (!sections.find((x) => x.key === "events")?.on) return null;

  return (
    <Card title="Events" color={BRAND.blue}>
      {events.map((ev, i) => (
        <div key={i} style={{ marginBottom: 14, padding: 12, background: "#f8f9fa", borderRadius: 6, position: "relative" }}>
          <div style={{ position: "absolute", top: 8, right: 8 }}>
            <X onClick={() => removeEvent(i)} />
          </div>

          <div style={{ display: "flex", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
            <div style={{ flex: 1, minWidth: 160 }}>
              <Inp label="Title" value={ev.title} onChange={(v) => updateEvent(i, "title", v)} />
            </div>
            <div style={{ width: 140 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: "#555", textTransform: "uppercase", letterSpacing: 0.5, display: "block", marginBottom: 4 }}>
                Type
              </label>
              <select
                value={ev.type}
                onChange={(e) => updateEvent(i, "type", e.target.value)}
                style={{ ...ss, width: "100%" }}
              >
                {EVENT_TYPES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
            <div style={{ width: 140 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: "#555", textTransform: "uppercase", letterSpacing: 0.5, display: "block", marginBottom: 4 }}>
                Date
              </label>
              <input
                type="date"
                value={ev.date}
                onChange={(e) => updateEvent(i, "date", e.target.value)}
                style={{ ...is, width: "100%" }}
              />
            </div>
          </div>

          <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: "#555", textTransform: "uppercase", letterSpacing: 0.5, display: "block", marginBottom: 4 }}>
                Time (ET)
              </label>
              <input
                value={ev.timeET}
                onChange={(e) => updateEvent(i, "timeET", e.target.value)}
                placeholder="HH:MM"
                style={{ ...is, width: "100%" }}
              />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: "#555", textTransform: "uppercase", letterSpacing: 0.5, display: "block", marginBottom: 4 }}>
                Time (BUE)
              </label>
              <input
                value={ev.timeBUE}
                onChange={(e) => updateEvent(i, "timeBUE", e.target.value)}
                placeholder="HH:MM"
                style={{ ...is, width: "100%" }}
              />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: "#555", textTransform: "uppercase", letterSpacing: 0.5, display: "block", marginBottom: 4 }}>
                Time (LON)
              </label>
              <input
                value={ev.timeLON}
                onChange={(e) => updateEvent(i, "timeLON", e.target.value)}
                placeholder="HH:MM"
                style={{ ...is, width: "100%" }}
              />
            </div>
          </div>

          <Inp label="Description" value={ev.description} onChange={(v) => updateEvent(i, "description", v)} multi rows={2} />
          <Inp label="Link" value={ev.link} onChange={(v) => updateEvent(i, "link", v)} placeholder="https://..." />
        </div>
      ))}
      <DashBtn onClick={addEvent}>+ Add Event</DashBtn>
    </Card>
  );
}

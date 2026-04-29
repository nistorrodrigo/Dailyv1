import React, { useState, useEffect } from "react";
import { BRAND } from "../constants/brand";
import { listRecipients, addRecipient, toggleRecipient, removeRecipient } from "../lib/recipientsApi";
import { fetchSendGridLists, fetchSendGridContacts, type SendGridList, type SendGridContact } from "../lib/sendgridApi";
import { supabase } from "../lib/supabase";
import useDailyStore from "../store/useDailyStore";
import { generateHTML } from "../utils/generateHTML";
import { formatDate } from "../utils/dates";

interface EmailSendPanelProps {
  open: boolean;
  onClose: () => void;
}

interface Recipient {
  id: string | number;
  email: string;
  name: string;
  active: boolean;
}

interface EmailLog {
  id: string;
  daily_date: string;
  recipients_count: number;
  list_name?: string;
  is_test: boolean;
  sent_at: string;
}

interface SendResult {
  type: "success" | "error";
  message: string;
}

export default function EmailSendPanel({ open, onClose }: EmailSendPanelProps): React.ReactElement | null {
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [sending, setSending] = useState<boolean>(false);
  const [newEmail, setNewEmail] = useState<string>("");
  const [newName, setNewName] = useState<string>("");
  const date = useDailyStore((s) => s.date);
  const [subject, setSubject] = useState<string>("");
  const [pin, setPin] = useState<string>("");
  const [pinError, setPinError] = useState<string>("");
  const [sendResult, setSendResult] = useState<SendResult | null>(null);
  const [sgLists, setSgLists] = useState<SendGridList[]>([]);
  const [selectedListName, setSelectedListName] = useState<string>("");
  const [emailLogs, setEmailLogs] = useState<EmailLog[]>([]);
  const [showLogs, setShowLogs] = useState<boolean>(false);
  const [sgLoading, setSgLoading] = useState<boolean>(false);
  const [sgProgress, setSgProgress] = useState<string>("");

  useEffect(() => {
    if (open) {
      setSubject(`Argentina Daily - ${formatDate(date)}`);
      if (supabase) {
        setLoading(true);
        listRecipients().then(setRecipients).finally(() => setLoading(false));
      }
    }
  }, [open, date]);

  if (!open) return null;

  const handleAdd = async (): Promise<void> => {
    if (!newEmail.trim()) return;
    if (supabase) {
      try {
        const r = await addRecipient(newEmail.trim(), newName.trim());
        if (r) setRecipients((prev) => [...prev, r]);
      } catch (err) {
        alert("Failed to add: " + (err as Error).message);
      }
    } else {
      setRecipients((prev) => [...prev, { id: Date.now(), email: newEmail.trim(), name: newName.trim(), active: true }]);
    }
    setNewEmail("");
    setNewName("");
  };

  const handleToggle = async (id: string | number, active: boolean): Promise<void> => {
    setRecipients((prev) => prev.map((r) => (r.id === id ? { ...r, active } : r)));
    if (supabase) {
      try { await toggleRecipient(String(id), active); } catch (err) { console.error(err); }
    }
  };

  const handleRemove = async (id: string | number): Promise<void> => {
    setRecipients((prev) => prev.filter((r) => r.id !== id));
    if (supabase) {
      try { await removeRecipient(String(id)); } catch (err) { console.error(err); }
    }
  };

  const handleSend = async (): Promise<void> => {
    const activeRecipients = recipients.filter((r) => r.active).map((r) => r.email);
    if (!activeRecipients.length) return alert("No active recipients selected");
    if (!subject.trim()) return alert("Subject is required");
    if (!pin.trim()) { setPinError("Enter PIN to send"); return; }
    if (!window.confirm(`Send daily to ${activeRecipients.length} recipient(s)?\n\nRecipients:\n${activeRecipients.join("\n")}`)) return;

    setSending(true);
    setPinError("");
    try {
      const html = generateHTML(useDailyStore.getState());
      const resp = await fetch("/api/send-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          html, subject: subject.trim(), recipients: activeRecipients, pin: pin.trim(),
          dailyDate: date, listName: selectedListName || null,
          attachments: (window as Record<string, unknown>)._emailAttachment ? [(window as Record<string, unknown>)._emailAttachment] : undefined,
          abTest: (document.getElementById("ab-subject") as HTMLInputElement)?.value ? { enabled: true, subjectB: (document.getElementById("ab-subject") as HTMLInputElement).value } : undefined,
        }),
      });
      const data = await resp.json();
      if (!data.ok) throw new Error(data.error);
      setSendResult({ type: "success", message: `\u2713 Email sent to ${data.sent} recipient(s)!` });
      setPin("");
    } catch (err) {
      if ((err as Error).message.includes("Invalid PIN")) {
        setPinError("Invalid PIN. Try again.");
      } else {
        setSendResult({ type: "error", message: `Send failed: ${(err as Error).message}` });
      }
    } finally {
      setSending(false);
    }
  };

  return (
    <div style={{
      position: "fixed", top: 0, right: 0, bottom: 0, width: 400,
      background: "var(--bg-card)", boxShadow: "var(--shadow-panel)",
      zIndex: 1000, display: "flex", flexDirection: "column", animation: "slideInRight 0.2s ease",
    }}>
      <div style={{
        background: BRAND.navy, padding: "16px 20px",
        display: "flex", justifyContent: "space-between", alignItems: "center",
      }}>
        <span style={{ color: "#fff", fontSize: 14, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1 }}>
          Send Email
        </span>
        <button onClick={onClose} style={{
          background: "none", border: "none", color: BRAND.sky,
          fontSize: 20, cursor: "pointer",
        }}>
          {"\u00D7"}
        </button>
      </div>
      <div style={{ flex: 1, overflow: "auto", padding: 16 }}>
        <div style={{ marginBottom: 16 }}>
          <label className="block mb-1 text-[11px] font-semibold text-[var(--text-secondary)] uppercase tracking-wide">
            Subject
          </label>
          <div className="flex gap-2">
            <input
              value={subject}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSubject(e.target.value)}
              className="themed-input flex-1 px-2.5 py-2 rounded-md border border-[var(--border-input)] text-[13px] bg-[var(--bg-input)] text-[var(--text-primary)]"
            />
            <button
              onClick={() => setSubject(`Argentina Daily - ${formatDate(date)}`)}
              className="px-2.5 py-2 rounded-md border border-[var(--border-input)] bg-transparent text-[var(--text-muted)] text-[10px] font-semibold cursor-pointer whitespace-nowrap"
              title="Reset to default"
            >
              Reset
            </button>
          </div>
          <div className="text-[10px] text-[var(--text-muted)] mt-1">
            Default: Argentina Daily - {formatDate(date)}
          </div>
        </div>

        {/* SendGrid Lists */}
        <div style={{ marginBottom: 16 }}>
          <label className="block mb-1 text-[11px] font-semibold text-[var(--text-secondary)] uppercase tracking-wide">
            Import from SendGrid List
          </label>
          <div className="flex gap-1.5 flex-wrap">
            {sgLists.length === 0 && (
              <button
                onClick={async () => {
                  setSgLoading(true);
                  try {
                    const lists = await fetchSendGridLists();
                    setSgLists(lists);
                  } catch (err) {
                    setSendResult({ type: "error", message: "Failed to load lists: " + (err as Error).message });
                  } finally {
                    setSgLoading(false);
                  }
                }}
                disabled={sgLoading}
                className="px-3 py-1.5 rounded-md border border-[var(--border-input)] bg-transparent text-[var(--text-secondary)] text-[11px] font-semibold cursor-pointer"
              >
                {sgLoading ? "Loading..." : "Load SendGrid Lists"}
              </button>
            )}
            {sgLists.map((list) => (
              <button
                key={list.id}
                onClick={async () => {
                  setSgLoading(true);
                  setSgProgress("");
                  try {
                    const contacts = await fetchSendGridContacts(list.id, {
                      onProgress: (msg) => setSgProgress(msg.replace("contacts...", `${list.count} contacts...`)),
                    });
                    const newRecipients = contacts
                      .filter((c: SendGridContact) => !recipients.find((r) => r.email === c.email))
                      .map((c: SendGridContact) => ({ id: `sg${Date.now()}${Math.random()}`, email: c.email, name: c.name, active: true }));
                    setRecipients((prev) => [...prev, ...newRecipients]);
                    setSelectedListName(list.name);
                    setSendResult({ type: "success", message: `Imported ${newRecipients.length} contacts from "${list.name}"` });
                  } catch (err) {
                    setSendResult({ type: "error", message: "Import failed: " + (err as Error).message });
                  } finally {
                    setSgLoading(false);
                    setSgProgress("");
                  }
                }}
                disabled={sgLoading}
                className="px-2.5 py-1.5 rounded text-[10px] font-bold border border-[var(--border-input)] bg-transparent text-[var(--text-primary)] cursor-pointer hover:bg-[var(--bg-hover)]"
              >
                {list.name} ({list.count})
              </button>
            ))}
          </div>
          {sgProgress && (
            <div className="mt-1 text-[10px] text-[var(--text-muted)] italic">{sgProgress}</div>
          )}
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 11, fontWeight: 600, color: "var(--text-secondary)", textTransform: "uppercase", display: "block", marginBottom: 4 }}>
            Add Recipient
          </label>
          <div style={{ display: "flex", gap: 6 }}>
            <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Name" style={{ flex: 1, padding: "6px 8px", borderRadius: 4, border: "1px solid #d0d5dd", fontSize: 12 }} />
            <input value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="email@..." style={{ flex: 2, padding: "6px 8px", borderRadius: 4, border: "1px solid #d0d5dd", fontSize: 12 }} />
            <button onClick={handleAdd} style={{ padding: "6px 12px", borderRadius: 4, border: "none", background: BRAND.blue, color: "#fff", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>+</button>
          </div>
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 11, fontWeight: 600, color: "#555", textTransform: "uppercase", display: "block", marginBottom: 4 }}>
            Recipients ({recipients.filter((r) => r.active).length} active)
          </label>
          {loading && <p style={{ fontSize: 12, color: "#666" }}>Loading...</p>}
          {recipients.map((r) => (
            <div key={r.id} style={{
              display: "flex", alignItems: "center", gap: 8,
              padding: "6px 8px", marginBottom: 4, borderRadius: 4,
              background: r.active ? "#f0f6ff" : "#fafafa",
              border: `1px solid ${r.active ? BRAND.sky + "40" : "#eee"}`,
            }}>
              <input
                type="checkbox"
                checked={r.active}
                onChange={(e) => handleToggle(r.id, e.target.checked)}
              />
              <span style={{ flex: 1, fontSize: 12, color: r.active ? "#333" : "#999" }}>
                {r.name ? `${r.name} <${r.email}>` : r.email}
              </span>
              <button onClick={() => handleRemove(r.id)} style={{
                background: "none", border: "none", color: "#c0392b",
                cursor: "pointer", fontSize: 14, padding: 0,
              }}>
                {"\u00D7"}
              </button>
            </div>
          ))}
        </div>
      </div>
      <div style={{ padding: 16, borderTop: "1px solid var(--border-light)" }}>
        {sendResult && (
          <div
            className="mb-3 p-3 rounded-md text-sm font-semibold flex items-center justify-between"
            style={{
              background: sendResult.type === "success" ? "rgba(172,212,132,0.15)" : "rgba(231,76,60,0.15)",
              color: sendResult.type === "success" ? "#27864a" : "#e74c3c",
              border: `1px solid ${sendResult.type === "success" ? "rgba(172,212,132,0.3)" : "rgba(231,76,60,0.3)"}`,
            }}
          >
            <span>{sendResult.message}</span>
            <button
              onClick={() => setSendResult(null)}
              className="bg-transparent border-none cursor-pointer text-inherit text-lg leading-none ml-2"
            >{"\u00D7"}</button>
          </div>
        )}
        <div className="mb-3">
          {/* A/B Test */}
          <div className="mb-3 p-3 rounded-md bg-[var(--bg-card-alt)] border border-[var(--border-light)]">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] font-semibold text-[var(--text-secondary)] uppercase tracking-wide">A/B Test Subject</span>
              <button
                onClick={() => setField("_abEnabled", !((window as Record<string, boolean>)._abEnabled))}
                className="text-[10px] text-[var(--text-muted)] bg-transparent border-none cursor-pointer"
                id="ab-toggle"
              >
                {document.getElementById("ab-subject") ? "Disable" : "Enable"}
              </button>
            </div>
            <input
              id="ab-subject"
              placeholder="Variant B subject line (50% of recipients get this)"
              className="themed-input w-full px-2.5 py-2 rounded-md border border-[var(--border-input)] text-[12px] bg-[var(--bg-input)] text-[var(--text-primary)]"
            />
            <div className="text-[9px] text-[var(--text-muted)] mt-1">Recipients split 50/50. Track opens per variant in Dashboard.</div>
          </div>

          {/* Attachments */}
          <div className="mb-3 p-3 rounded-md bg-[var(--bg-card-alt)] border border-[var(--border-light)]">
            <span className="text-[11px] font-semibold text-[var(--text-secondary)] uppercase tracking-wide block mb-1">Attach PDF</span>
            <input
              type="file"
              accept=".pdf"
              id="email-attachment"
              className="text-xs"
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                const file = e.target.files?.[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = () => {
                  const base64 = (reader.result as string).split(",")[1];
                  (window as Record<string, unknown>)._emailAttachment = { content: base64, filename: file.name, type: file.type };
                };
                reader.readAsDataURL(file);
              }}
            />
            <div className="text-[9px] text-[var(--text-muted)] mt-1">PDF will be attached to the email.</div>
          </div>

          <label className="block mb-1 text-[11px] font-semibold text-[var(--text-secondary)] uppercase tracking-wide">
            Security PIN
          </label>
          <input
            type="password"
            value={pin}
            onChange={(e) => { setPin(e.target.value); setPinError(""); }}
            placeholder="Enter PIN to authorize send"
            className="themed-input w-full px-2.5 py-2 rounded-md border text-sm bg-[var(--bg-input)] text-[var(--text-primary)]"
            style={{ borderColor: pinError ? "#e74c3c" : "var(--border-input)" }}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
          />
          {pinError && <div className="text-[11px] text-red-500 mt-1 font-semibold">{pinError}</div>}
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => {
              if (!pin.trim()) { setPinError("Enter PIN"); return; }
              const testEmail = prompt("Send test to which email?", "rodrigo.nistor@latinsecurities.ar");
              if (!testEmail) return;
              setSending(true);
              setPinError("");
              const html = generateHTML(useDailyStore.getState());
              fetch("/api/send-email", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ html, subject: `[TEST] ${subject.trim()}`, recipients: [testEmail], pin: pin.trim(), isTest: true, dailyDate: date }),
              }).then(r => r.json()).then(data => {
                if (!data.ok) throw new Error(data.error);
                setSendResult({ type: "success", message: `\u2713 Test email sent to ${testEmail}` });
              }).catch(err => {
                if (err.message?.includes("Invalid PIN")) setPinError("Invalid PIN");
                else setSendResult({ type: "error", message: `Test failed: ${err.message}` });
              }).finally(() => setSending(false));
            }}
            disabled={sending || !pin.trim()}
            style={{
              flex: 1, padding: "12px 16px", borderRadius: 6,
              border: `2px solid ${BRAND.orange}`, background: "transparent",
              color: BRAND.orange, fontSize: 12, fontWeight: 700,
              cursor: sending || !pin.trim() ? "default" : "pointer", textTransform: "uppercase",
              opacity: sending || !pin.trim() ? 0.5 : 1,
            }}
          >
            {sending ? "..." : "Test Email"}
          </button>
          <button
            onClick={handleSend}
            disabled={sending || !pin.trim()}
            style={{
              flex: 2, padding: "12px 20px", borderRadius: 6,
              border: "none", background: sending || !pin.trim() ? "#999" : BRAND.blue,
              color: "#fff", fontSize: 13, fontWeight: 700,
              cursor: sending || !pin.trim() ? "default" : "pointer", textTransform: "uppercase",
            }}
          >
            {sending ? "Sending..." : "Send Daily Email"}
          </button>
        </div>

        {/* Send History */}
        <button
          onClick={async () => {
            setShowLogs(!showLogs);
            if (!showLogs && emailLogs.length === 0) {
              const resp = await fetch("/api/analytics?type=email-log");
              const data = await resp.json();
              if (data.ok) setEmailLogs(data.logs);
            }
          }}
          className="w-full mt-3 py-2 rounded-md border border-[var(--border-input)] bg-transparent text-[var(--text-muted)] text-xs font-semibold cursor-pointer"
        >
          {showLogs ? "Hide Send History" : "Show Send History"}
        </button>
        {showLogs && (
          <div className="mt-2 max-h-48 overflow-auto">
            {emailLogs.length === 0 && <p className="text-xs text-[var(--text-muted)] text-center py-2">No emails sent yet</p>}
            {emailLogs.map((log) => (
              <div key={log.id} className="flex items-center gap-2 py-1.5 border-b border-[var(--border-light)] text-xs">
                <span className={`w-2 h-2 rounded-full flex-shrink-0 ${log.is_test ? "bg-amber-400" : "bg-green-500"}`} />
                <span className="text-[var(--text-primary)] font-semibold">{log.daily_date}</span>
                <span className="text-[var(--text-muted)]">{log.recipients_count} recipients</span>
                {log.list_name && <span className="text-[var(--text-muted)]">({log.list_name})</span>}
                <span className="text-[var(--text-muted)] ml-auto">{new Date(log.sent_at).toLocaleTimeString()}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

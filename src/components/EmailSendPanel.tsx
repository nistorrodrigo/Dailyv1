import React, { useState, useEffect } from "react";
import { BRAND } from "../constants/brand";
import { listRecipients, addRecipient, toggleRecipient, removeRecipient } from "../lib/recipientsApi";
import { fetchSendGridLists, fetchSendGridContacts, type SendGridList, type SendGridContact } from "../lib/sendgridApi";
import { supabase } from "../lib/supabase";
import useDailyStore from "../store/useDailyStore";
import { generateHTML } from "../utils/generateHTML";
import { formatDate } from "../utils/dates";
import SendConfirmModal from "./SendConfirmModal";
import RecipientList, { type Recipient } from "./RecipientList";
import ABTestSubject from "./ABTestSubject";
import AttachmentInput, { type EmailAttachment } from "./AttachmentInput";

interface EmailSendPanelProps {
  open: boolean;
  onClose: () => void;
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
  const [abEnabled, setAbEnabled] = useState<boolean>(false);
  const [abSubjectB, setAbSubjectB] = useState<string>("");
  const [attachment, setAttachment] = useState<EmailAttachment | null>(null);
  const [confirmOpen, setConfirmOpen] = useState<boolean>(false);

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

  /** Pre-flight checks. Returns true if ready to open the confirmation modal. */
  const handleSendClick = (): void => {
    const activeRecipients = recipients.filter((r) => r.active).map((r) => r.email);
    if (!activeRecipients.length) { alert("No active recipients selected"); return; }
    if (!subject.trim()) { alert("Subject is required"); return; }
    if (!pin.trim()) { setPinError("Enter PIN to send"); return; }
    setPinError("");
    setConfirmOpen(true);
  };

  /** Actually fires the send. Called from the confirmation modal after the user clicks "Confirm". */
  const performSend = async (): Promise<void> => {
    setConfirmOpen(false);
    const activeRecipients = recipients.filter((r) => r.active).map((r) => r.email);
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
          attachments: attachment ? [attachment] : undefined,
          abTest: abEnabled && abSubjectB.trim() ? { enabled: true, subjectB: abSubjectB.trim() } : undefined,
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

  /** Build a top-N domain breakdown for the confirmation modal. */
  const recipientStats = (): { total: number; domains: { domain: string; count: number }[]; sample: string[] } => {
    const active = recipients.filter((r) => r.active);
    const byDomain: Record<string, number> = {};
    active.forEach((r) => {
      const d = r.email.split("@")[1] || "(no domain)";
      byDomain[d] = (byDomain[d] || 0) + 1;
    });
    const domains = Object.entries(byDomain)
      .map(([domain, count]) => ({ domain, count }))
      .sort((a, b) => b.count - a.count);
    return { total: active.length, domains, sample: active.slice(0, 5).map((r) => r.email) };
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

        <RecipientList
          recipients={recipients}
          loading={loading}
          onToggle={handleToggle}
          onRemove={handleRemove}
        />
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
          <ABTestSubject
            enabled={abEnabled}
            onToggle={() => setAbEnabled((v) => !v)}
            subjectB={abSubjectB}
            onSubjectBChange={setAbSubjectB}
          />

          <AttachmentInput
            attachment={attachment}
            onChange={setAttachment}
          />

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
            onKeyDown={(e) => e.key === "Enter" && handleSendClick()}
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
            onClick={handleSendClick}
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
              try {
                const resp = await fetch("/api/analytics?type=email-log");
                const data = await resp.json();
                if (!resp.ok || !data.ok) throw new Error(data.error || `HTTP ${resp.status}`);
                setEmailLogs(data.logs);
              } catch (err) {
                setSendResult({ type: "error", message: "Failed to load history: " + (err as Error).message });
              }
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

      <SendConfirmModal
        open={confirmOpen}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={performSend}
        {...recipientStats()}
        subject={subject}
        abSubjectB={abEnabled ? abSubjectB : undefined}
        selectedListName={selectedListName || undefined}
        attachmentFilename={attachment?.filename}
      />
    </div>
  );
}

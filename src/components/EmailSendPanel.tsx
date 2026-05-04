import React, { useState, useEffect } from "react";
import { BRAND } from "../constants/brand";
import { listRecipients, addRecipient, toggleRecipient, removeRecipient } from "../lib/recipientsApi";
import { fetchSendGridLists, fetchSendGridContacts, type SendGridList, type SendGridContact } from "../lib/sendgridApi";
import { supabase } from "../lib/supabase";
import useDailyStore from "../store/useDailyStore";
import { generateHTML } from "../utils/generateHTML";
import { generateBBG } from "../utils/generateBBG";
import { formatDate, fmtRelativeTime } from "../utils/dates";
import SendConfirmModal from "./SendConfirmModal";
import RecipientList, { type Recipient } from "./RecipientList";
import ABTestSubject from "./ABTestSubject";
import AttachmentInput, { type EmailAttachment } from "./AttachmentInput";
import { toast } from "../store/useToastStore";
import { useCurrentUser } from "../hooks/useCurrentUser";
import { displayNameFromUser, displayNameFromEmail } from "../utils/displayName";
import { authedFetch } from "../lib/authedFetch";

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
  /** Email of the analyst who fired the send (or fromEmail for legacy
   *  rows that pre-date per-user identity tracking). */
  sent_by?: string | null;
}

interface SendResult {
  type: "success" | "error" | "auth";
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
  const [testFormOpen, setTestFormOpen] = useState<boolean>(false);
  const [testEmailAddress, setTestEmailAddress] = useState<string>("");
  // The most recent NON-test send for today's daily_date, if any. Used
  // to render the "already sent X ago" warning that prevents accidental
  // double-sends when two analysts are working in parallel.
  const [lastSendToday, setLastSendToday] = useState<EmailLog | null>(null);
  const [lastSendDismissed, setLastSendDismissed] = useState<boolean>(false);
  const currentUser = useCurrentUser();
  // Auth method label that the SendConfirmModal renders. "session" when
  // we're logged in with Supabase; "none" otherwise (the server rejects).
  // The shared-PIN fallback was removed when we audited auth surface area.
  const authMethod: "session" | "none" = currentUser ? "session" : "none";
  const sendDisabled = sending || !currentUser;
  // The "From" name we attach to every send. Lets each analyst's mail
  // show up in the recipient's inbox under their own name instead of a
  // generic shared label. The server validates and falls back to a
  // default if missing/invalid, so this is opportunistic — never blocking.
  const fromName = currentUser ? displayNameFromUser(currentUser.user) : null;

  useEffect(() => {
    if (open) {
      setSubject(`Argentina Daily - ${formatDate(date)}`);
      setLastSendDismissed(false);
      if (supabase) {
        setLoading(true);
        listRecipients().then(setRecipients).finally(() => setLoading(false));
      }
      // Fetch the most-recent non-test send for today's daily_date so we
      // can warn if the daily was already sent. We always re-fetch on open
      // (rather than caching) because another analyst may have sent in
      // the time the panel was closed.
      (async () => {
        try {
          const resp = await authedFetch(`/api/analytics?type=email-log&date=${encodeURIComponent(date)}`);
          const data = await resp.json();
          if (!resp.ok || !data.ok) {
            setLastSendToday(null);
            return;
          }
          const logs = (data.logs as EmailLog[] | undefined) || [];
          const realSend = logs.find((l) => !l.is_test && l.daily_date === date) || null;
          setLastSendToday(realSend);
        } catch {
          // Non-fatal — the warning is purely advisory, so silently skip
          // when the analytics endpoint is unreachable.
          setLastSendToday(null);
        }
      })();
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
        toast.error("Failed to add: " + (err as Error).message);
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
    if (!activeRecipients.length) { toast.error("No active recipients selected"); return; }
    if (!subject.trim()) { toast.error("Subject is required"); return; }
    if (!currentUser) {
      setSendResult({ type: "auth", message: "Log in before sending. The server only accepts authenticated requests." });
      return;
    }
    setConfirmOpen(true);
  };

  /** Actually fires the send. Called from the confirmation modal after the user clicks "Confirm". */
  const performSend = async (): Promise<void> => {
    setConfirmOpen(false);
    const activeRecipients = recipients.filter((r) => r.active).map((r) => r.email);
    setSending(true);
    try {
      // Re-check the session right before sending. Catches the case where
      // the user opened the modal, walked away for hours, and came back to
      // confirm — the JWT may have expired. Without this we'd blindly send
      // and let the server return 403, then the user has to start over.
      if (supabase) {
        const { data } = await supabase.auth.getSession();
        if (!data?.session?.access_token) {
          throw new Error("Your session has expired. Log out and back in to continue.");
        }
      }

      const state = useDailyStore.getState();
      const html = generateHTML(state);
      const text = generateBBG(state); // plain-text fallback for the multipart MIME
      const resp = await authedFetch("/api/send-email", {
        method: "POST",
        body: JSON.stringify({
          html, text, subject: subject.trim(), recipients: activeRecipients,
          fromName,
          dailyDate: date, listName: selectedListName || null,
          attachments: attachment ? [attachment] : undefined,
          abTest: abEnabled && abSubjectB.trim() ? { enabled: true, subjectB: abSubjectB.trim() } : undefined,
        }),
      });
      const data = await resp.json();
      if (!data.ok) throw new Error(data.error);
      setSendResult({ type: "success", message: `\u2713 Email sent to ${data.sent} recipient(s)!` });
    } catch (err) {
      const msg = (err as Error).message;
      const isAuth = /session|authent|log\s*(in|out)/i.test(msg);
      setSendResult({ type: isAuth ? "auth" : "error", message: isAuth ? msg : `Send failed: ${msg}` });
    } finally {
      setSending(false);
    }
  };

  /** Default address for the test email (first signature, or empty). */
  const defaultTestAddress = (): string => {
    const first = useDailyStore.getState().signatures[0];
    return first?.email || "";
  };

  /** Open the inline "send test to which email?" form. */
  const handleTestEmailClick = (): void => {
    if (!currentUser) {
      setSendResult({ type: "auth", message: "Log in before sending. The server only accepts authenticated requests." });
      return;
    }
    setTestEmailAddress(testEmailAddress || defaultTestAddress());
    setTestFormOpen(true);
  };

  /** Fire the test send for the email currently in `testEmailAddress`. */
  const performTestSend = async (): Promise<void> => {
    const addr = testEmailAddress.trim();
    if (!addr) { toast.info("Enter an email address"); return; }
    setTestFormOpen(false);
    setSending(true);
    try {
      const state = useDailyStore.getState();
      const html = generateHTML(state);
      const text = generateBBG(state);
      const resp = await authedFetch("/api/send-email", {
        method: "POST",
        body: JSON.stringify({
          html,
          text,
          subject: `[TEST] ${subject.trim()}`,
          recipients: [addr],
          fromName,
          isTest: true,
          dailyDate: date,
        }),
      });
      const data = await resp.json();
      if (!data.ok) throw new Error(data.error);
      setSendResult({ type: "success", message: `✓ Test email sent to ${addr}` });
    } catch (err) {
      const msg = (err as Error).message;
      const isAuth = /session|authent|log\s*(in|out)/i.test(msg);
      setSendResult({ type: isAuth ? "auth" : "error", message: isAuth ? msg : `Test failed: ${msg}` });
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
        {/* Last-sent warning. Shows when today's daily was already sent
            (non-test) by anyone — defends against double-sends when two
            analysts are editing in parallel. Dismissable in case the
            analyst genuinely wants to re-send (e.g. correction). */}
        {lastSendToday && !lastSendDismissed && (
          <div
            className="mb-3 p-3 rounded-md text-[12px]"
            style={{
              background: "rgba(231,158,76,0.12)",
              color: "#c97a2c",
              border: "1px solid rgba(231,158,76,0.45)",
            }}
          >
            <div className="flex items-start gap-2">
              <span className="font-bold">⚠</span>
              <div className="flex-1 leading-snug">
                <div className="font-bold">Today's daily was already sent</div>
                <div className="mt-1 text-[11px]" style={{ color: "var(--text-primary)" }}>
                  {fmtRelativeTime(lastSendToday.sent_at)}
                  {lastSendToday.sent_by ? <> by <strong>{displayNameFromEmail(lastSendToday.sent_by)}</strong></> : null}
                  {" "}to <strong>{lastSendToday.recipients_count.toLocaleString()}</strong> recipient{lastSendToday.recipients_count === 1 ? "" : "s"}
                  {lastSendToday.list_name ? <> ({lastSendToday.list_name})</> : null}.
                </div>
              </div>
              <button
                aria-label="Dismiss already-sent warning"
                onClick={() => setLastSendDismissed(true)}
                className="bg-transparent border-none cursor-pointer text-inherit text-base leading-none -mt-0.5"
                title="Dismiss"
              >
                {"×"}
              </button>
            </div>
          </div>
        )}
        <div style={{ marginBottom: 16 }}>
          <label className="block mb-1 text-[11px] font-semibold text-[var(--text-secondary)] uppercase tracking-wide">
            Subject
          </label>
          <div className="flex gap-2">
            <input
              aria-label="Email subject"
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
            <input aria-label="New recipient name" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Name" style={{ flex: 1, padding: "6px 8px", borderRadius: 4, border: "1px solid #d0d5dd", fontSize: 12 }} />
            <input aria-label="New recipient email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="email@..." style={{ flex: 2, padding: "6px 8px", borderRadius: 4, border: "1px solid #d0d5dd", fontSize: 12 }} />
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
              background:
                sendResult.type === "success" ? "rgba(172,212,132,0.15)" :
                sendResult.type === "auth"    ? "rgba(231,158,76,0.15)" :
                                                 "rgba(231,76,60,0.15)",
              color:
                sendResult.type === "success" ? "#27864a" :
                sendResult.type === "auth"    ? "#c97a2c" :
                                                 "#e74c3c",
              border: `1px solid ${
                sendResult.type === "success" ? "rgba(172,212,132,0.3)" :
                sendResult.type === "auth"    ? "rgba(231,158,76,0.35)" :
                                                 "rgba(231,76,60,0.3)"
              }`,
            }}
          >
            <span>
              {sendResult.type === "auth" ? "🔒 " : ""}
              {sendResult.message}
            </span>
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

          {/* No-auth notice. Should never render in production because
              LoginGate gates the whole app, but kept for the dev/fork
              scenario where Supabase env vars aren't configured. */}
          {!currentUser && (
            <div
              className="mt-1 p-2 rounded-md text-[11px] font-semibold"
              style={{
                background: "rgba(231,158,76,0.12)",
                color: "#c97a2c",
                border: "1px solid rgba(231,158,76,0.35)",
              }}
            >
              ⚠ Not signed in — log in via the gate to enable sending.
            </div>
          )}
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleTestEmailClick}
            disabled={sendDisabled}
            style={{
              flex: 1, padding: "12px 16px", borderRadius: 6,
              border: `2px solid ${BRAND.orange}`, background: "transparent",
              color: BRAND.orange, fontSize: 12, fontWeight: 700,
              cursor: sendDisabled ? "default" : "pointer", textTransform: "uppercase",
              opacity: sendDisabled ? 0.5 : 1,
            }}
          >
            {sending ? "..." : "Test Email"}
          </button>
          <button
            onClick={handleSendClick}
            disabled={sendDisabled}
            style={{
              flex: 2, padding: "12px 20px", borderRadius: 6,
              border: "none", background: sendDisabled ? "#999" : BRAND.blue,
              color: "#fff", fontSize: 13, fontWeight: 700,
              cursor: sendDisabled ? "default" : "pointer", textTransform: "uppercase",
            }}
          >
            {sending ? "Sending..." : "Send Daily Email"}
          </button>
        </div>
        {testFormOpen && (
          <div className="mt-2 p-3 rounded-md border" style={{ background: "var(--bg-card-alt)", borderColor: BRAND.orange + "40" }}>
            <label className="block mb-1 text-[10px] font-bold uppercase tracking-wide" style={{ color: BRAND.orange }}>
              Send test to which email?
            </label>
            <div className="flex gap-2">
              <input
                aria-label="Test email recipient address"
                value={testEmailAddress}
                onChange={(e) => setTestEmailAddress(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") performTestSend(); if (e.key === "Escape") setTestFormOpen(false); }}
                autoFocus
                placeholder="email@latinsecurities.ar"
                className="themed-input flex-1 px-2.5 py-1.5 rounded border border-[var(--border-input)] text-[12px] bg-[var(--bg-input)] text-[var(--text-primary)]"
              />
              <button
                onClick={performTestSend}
                disabled={sending}
                className="px-3 py-1.5 rounded text-[10px] font-bold border-none cursor-pointer text-white disabled:opacity-50"
                style={{ background: BRAND.orange }}
              >Send Test</button>
              <button
                onClick={() => setTestFormOpen(false)}
                className="px-3 py-1.5 rounded text-[10px] font-bold cursor-pointer bg-transparent text-[var(--text-muted)]"
                style={{ border: "1px solid var(--border-input)" }}
              >Cancel</button>
            </div>
          </div>
        )}

        {/* Send History */}
        <button
          onClick={async () => {
            setShowLogs(!showLogs);
            if (!showLogs && emailLogs.length === 0) {
              try {
                const resp = await authedFetch("/api/analytics?type=email-log");
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
            {emailLogs.map((log) => {
              const senderName = displayNameFromEmail(log.sent_by);
              return (
                <div key={log.id} className="flex items-center gap-2 py-1.5 border-b border-[var(--border-light)] text-xs">
                  <span className={`w-2 h-2 rounded-full flex-shrink-0 ${log.is_test ? "bg-amber-400" : "bg-green-500"}`} />
                  <span className="text-[var(--text-primary)] font-semibold">{log.daily_date}</span>
                  <span className="text-[var(--text-muted)]">{log.recipients_count} recipients</span>
                  {senderName && (
                    <span
                      className="text-[10px] text-[var(--text-muted)] italic"
                      title={log.sent_by || undefined}
                    >
                      by {senderName}
                    </span>
                  )}
                  {log.list_name && <span className="text-[var(--text-muted)]">({log.list_name})</span>}
                  <span className="text-[var(--text-muted)] ml-auto">{new Date(log.sent_at).toLocaleTimeString()}</span>
                </div>
              );
            })}
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
        html={confirmOpen ? generateHTML(useDailyStore.getState()) : undefined}
        authedAs={currentUser?.user.email || null}
        authMethod={authMethod}
      />
    </div>
  );
}

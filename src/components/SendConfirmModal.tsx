import React from "react";
import { BRAND } from "../constants/brand";

export interface SendConfirmModalProps {
  open: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  /** Total active recipients about to receive the email. */
  total: number;
  /** Pre-computed domain breakdown, sorted by count desc. */
  domains: { domain: string; count: number }[];
  /** Sample of the first ~5 recipient emails to show in the modal. */
  sample: string[];
  subject: string;
  /** Optional A/B test variant B subject. */
  abSubjectB?: string;
  /** Name of the SendGrid list contacts were imported from, if any. */
  selectedListName?: string;
  /** Filename of attached PDF, if any. */
  attachmentFilename?: string;
}

/**
 * Pre-flight confirmation dialog before sending the daily email to many
 * recipients. Shows total, top-5 domain breakdown, sample of first few emails,
 * subject (+ A/B variant if any), source list, and attachment.
 *
 * Designed to make accidental "send to 4000 people" hard: red-themed,
 * the confirm button label includes the recipient count.
 */
export default function SendConfirmModal({
  open,
  onCancel,
  onConfirm,
  total,
  domains,
  sample,
  subject,
  abSubjectB,
  selectedListName,
  attachmentFilename,
}: SendConfirmModalProps): React.ReactElement | null {
  if (!open) return null;

  const topDomains = domains.slice(0, 5);
  const otherDomainCount = domains.slice(5).reduce((s, d) => s + d.count, 0);

  return (
    <div
      onClick={onCancel}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.5)",
        zIndex: 2000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "var(--bg-card)",
          borderRadius: 8,
          maxWidth: 520,
          width: "100%",
          maxHeight: "90vh",
          overflow: "auto",
          boxShadow: "0 10px 40px rgba(0,0,0,0.3)",
        }}
      >
        <div style={{ background: BRAND.navy, padding: "14px 20px", borderTopLeftRadius: 8, borderTopRightRadius: 8 }}>
          <div style={{ color: "#fff", fontSize: 13, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1 }}>
            Confirm Send
          </div>
        </div>
        <div style={{ padding: 20 }}>
          <div className="mb-4 p-3 rounded-md" style={{ background: "rgba(231,76,60,0.08)", border: "1px solid rgba(231,76,60,0.25)" }}>
            <div className="text-[11px] font-bold uppercase tracking-wide" style={{ color: "#c0392b" }}>
              You are about to send to
            </div>
            <div className="text-3xl font-bold mt-1" style={{ color: "#c0392b" }}>
              {total.toLocaleString()} recipient{total === 1 ? "" : "s"}
            </div>
            <div className="text-[11px] mt-1" style={{ color: "var(--text-muted)" }}>
              This is irreversible. Make sure you tested first.
            </div>
          </div>

          <div className="mb-4">
            <div className="text-[10px] font-bold uppercase tracking-wide mb-1" style={{ color: "var(--text-secondary)" }}>
              Subject
            </div>
            <div className="text-[13px] font-semibold" style={{ color: "var(--text-primary)" }}>{subject}</div>
            {abSubjectB && abSubjectB.trim() && (
              <div className="text-[12px] mt-1 italic" style={{ color: "var(--text-muted)" }}>
                A/B variant B: {abSubjectB}
              </div>
            )}
          </div>

          {selectedListName && (
            <div className="mb-4">
              <div className="text-[10px] font-bold uppercase tracking-wide mb-1" style={{ color: "var(--text-secondary)" }}>
                Imported from list
              </div>
              <div className="text-[12px]" style={{ color: "var(--text-primary)" }}>{selectedListName}</div>
            </div>
          )}

          {attachmentFilename && (
            <div className="mb-4">
              <div className="text-[10px] font-bold uppercase tracking-wide mb-1" style={{ color: "var(--text-secondary)" }}>
                Attachment
              </div>
              <div className="text-[12px]" style={{ color: "var(--text-primary)" }}>📎 {attachmentFilename}</div>
            </div>
          )}

          <div className="mb-4">
            <div className="text-[10px] font-bold uppercase tracking-wide mb-2" style={{ color: "var(--text-secondary)" }}>
              Domain breakdown ({domains.length} domain{domains.length === 1 ? "" : "s"})
            </div>
            <div className="flex flex-col gap-1">
              {topDomains.map((d) => (
                <div key={d.domain} className="flex items-center justify-between text-[12px]">
                  <span style={{ color: "var(--text-primary)" }}>{d.domain}</span>
                  <span style={{ color: "var(--text-muted)" }}>
                    {d.count.toLocaleString()} ({Math.round((d.count / total) * 100)}%)
                  </span>
                </div>
              ))}
              {otherDomainCount > 0 && (
                <div className="flex items-center justify-between text-[12px] italic">
                  <span style={{ color: "var(--text-muted)" }}>+ {domains.length - 5} other domains</span>
                  <span style={{ color: "var(--text-muted)" }}>{otherDomainCount.toLocaleString()}</span>
                </div>
              )}
            </div>
          </div>

          <div className="mb-4">
            <div className="text-[10px] font-bold uppercase tracking-wide mb-1" style={{ color: "var(--text-secondary)" }}>
              Sample (first 5)
            </div>
            <div className="text-[11px] font-mono" style={{ color: "var(--text-muted)" }}>
              {sample.map((e) => <div key={e}>{e}</div>)}
              {total > sample.length && (
                <div className="italic">… and {(total - sample.length).toLocaleString()} more</div>
              )}
            </div>
          </div>

          <div className="flex gap-2 mt-5">
            <button
              onClick={onCancel}
              className="flex-1 py-2.5 rounded-md border bg-transparent text-[12px] font-bold cursor-pointer uppercase"
              style={{ borderColor: "var(--border-input)", color: "var(--text-secondary)" }}
            >
              Cancel
            </button>
            <button
              onClick={onConfirm}
              className="flex-1 py-2.5 rounded-md border-none text-white text-[12px] font-bold cursor-pointer uppercase"
              style={{ background: "#c0392b" }}
            >
              Confirm Send to {total.toLocaleString()}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

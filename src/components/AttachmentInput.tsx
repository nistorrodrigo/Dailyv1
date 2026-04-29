import React, { useRef } from "react";

export interface EmailAttachment {
  content: string;
  filename: string;
  type: string;
}

export interface AttachmentInputProps {
  attachment: EmailAttachment | null;
  onChange: (attachment: EmailAttachment | null) => void;
}

/**
 * PDF file picker that base64-encodes the chosen file for the SendGrid
 * `attachments` payload. Shows the current filename with a Remove button.
 */
export default function AttachmentInput({ attachment, onChange }: AttachmentInputProps): React.ReactElement {
  const inputRef = useRef<HTMLInputElement | null>(null);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) {
      onChange(null);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = (reader.result as string).split(",")[1];
      onChange({ content: base64, filename: file.name, type: file.type });
    };
    reader.readAsDataURL(file);
  };

  const handleRemove = () => {
    onChange(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  return (
    <div className="mb-3 p-3 rounded-md bg-[var(--bg-card-alt)] border border-[var(--border-light)]">
      <span className="text-[11px] font-semibold text-[var(--text-secondary)] uppercase tracking-wide block mb-1">Attach PDF</span>
      <input
        ref={inputRef}
        type="file"
        accept=".pdf"
        className="text-xs"
        onChange={handleFile}
      />
      {attachment && (
        <div className="text-[10px] text-[var(--text-secondary)] mt-1">
          Attached: <strong>{attachment.filename}</strong>
          <button
            onClick={handleRemove}
            className="ml-2 text-red-500 bg-transparent border-none cursor-pointer"
          >Remove</button>
        </div>
      )}
      <div className="text-[9px] text-[var(--text-muted)] mt-1">PDF will be attached to the email.</div>
    </div>
  );
}

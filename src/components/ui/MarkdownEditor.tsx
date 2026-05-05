import { useState, useRef, Suspense } from "react";
import { BRAND } from "../../constants/brand";
import { lazyWithReload } from "../../lib/lazyWithReload";

// Lazy import the preview-only renderer so react-markdown +
// remark-gfm (~150 KB / ~50 KB gzip combined) don't ship in the
// editor's eager chunk. Most editing time is spent in the textarea
// side, so the preview chunk often never downloads.
// `lazyWithReload` recovers from stale-bundle errors after a deploy.
const MarkdownPreviewLazy = lazyWithReload(() => import("./MarkdownPreviewLazy"));

interface MarkdownEditorProps {
  value: string;
  onChange: (v: string) => void;
  rows?: number;
  placeholder?: string;
  /** Optional paste hook — invoked on `onPaste` of the textarea. */
  onPaste?: (e: React.ClipboardEvent<HTMLTextAreaElement>) => void;
}

function wrapSelection(textareaRef: React.RefObject<HTMLTextAreaElement | null>, before: string, after: string) {
  const ta = textareaRef.current;
  if (!ta) return null;
  const start = ta.selectionStart;
  const end = ta.selectionEnd;
  const text = ta.value;
  const selected = text.substring(start, end);
  const newText = text.substring(0, start) + before + selected + after + text.substring(end);
  return { newText, cursorPos: start + before.length + selected.length + after.length };
}

export default function MarkdownEditor({ value, onChange, rows = 4, placeholder, onPaste }: MarkdownEditorProps) {
  const [showPreview, setShowPreview] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const applyFormat = (before: string, after: string) => {
    const result = wrapSelection(textareaRef, before, after);
    if (result) {
      onChange(result.newText);
      setTimeout(() => {
        textareaRef.current?.focus();
        textareaRef.current?.setSelectionRange(result.cursorPos, result.cursorPos);
      }, 0);
    }
  };

  const btnStyle = {
    padding: "3px 8px", border: "1px solid #d0d5dd", borderRadius: 3,
    background: "#fff", cursor: "pointer", fontSize: 12, fontWeight: 700,
    color: "#555",
  };

  return (
    <div>
      <div style={{ display: "flex", gap: 4, marginBottom: 4, alignItems: "center" }}>
        <button type="button" onClick={() => applyFormat("**", "**")} style={btnStyle} title="Bold">B</button>
        <button type="button" onClick={() => applyFormat("*", "*")} style={{ ...btnStyle, fontStyle: "italic" }} title="Italic">I</button>
        <button type="button" onClick={() => applyFormat("\n- ", "")} style={btnStyle} title="Bullet">&#8226;</button>
        <div style={{ flex: 1 }} />
        <button
          type="button"
          onClick={() => setShowPreview(!showPreview)}
          style={{
            ...btnStyle, fontSize: 10, fontWeight: 600,
            color: showPreview ? BRAND.blue : "#999",
            border: showPreview ? `1px solid ${BRAND.blue}` : "1px solid #d0d5dd",
          }}
        >
          {showPreview ? "Edit" : "Preview"}
        </button>
      </div>
      {showPreview ? (
        <div style={{
          padding: "8px 10px", borderRadius: 6, border: "1px solid #d0d5dd",
          fontSize: 13, lineHeight: 1.5, minHeight: rows * 20,
          background: "#fafbfc",
        }}>
          <Suspense fallback={<div style={{ color: "#999", fontSize: 11 }}>Loading preview…</div>}>
            <MarkdownPreviewLazy value={value || ""} />
          </Suspense>
        </div>
      ) : (
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onPaste={onPaste}
          rows={rows}
          placeholder={placeholder}
          style={{
            width: "100%", padding: "8px 10px", borderRadius: 6,
            border: "1px solid #d0d5dd", fontSize: 13,
            fontFamily: "'Segoe UI',sans-serif", resize: "vertical",
            lineHeight: 1.5, boxSizing: "border-box",
          }}
        />
      )}
    </div>
  );
}

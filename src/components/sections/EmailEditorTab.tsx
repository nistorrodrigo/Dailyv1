import React, { useState, useRef, useEffect, useCallback } from "react";
import { BRAND } from "../../constants/brand";
import useDailyStore from "../../store/useDailyStore";
import { generateHTML } from "../../utils/generateHTML";
import { toast } from "../../store/useToastStore";

export default function EmailEditorTab(): React.ReactElement {
  const [html, setHtml] = useState("");
  const [editMode, setEditMode] = useState<"preview" | "code">("preview");
  const [codeValue, setCodeValue] = useState("");
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Generate HTML from current state
  const regenerate = useCallback(() => {
    const state = useDailyStore.getState();
    const generated = generateHTML(state);
    setHtml(generated);
    setCodeValue(generated);
  }, []);

  useEffect(() => { regenerate(); }, [regenerate]);

  const handleCodeChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setCodeValue(e.target.value);
    setHtml(e.target.value);
  };

  const copyHtml = () => {
    navigator.clipboard.writeText(html).then(() => {
      toast.success("HTML copied to clipboard");
    });
  };

  return (
    <div className="max-w-[1200px] mx-auto p-5">
      {/* Toolbar */}
      <div className="flex items-center gap-3 mb-4 p-3 rounded-lg border border-[var(--border-light)] bg-[var(--bg-card)]">
        <div className="flex gap-1.5">
          <button
            onClick={() => setEditMode("preview")}
            className={`px-3 py-1.5 rounded text-xs font-bold border-none cursor-pointer ${
              editMode === "preview" ? "bg-navy text-white" : "bg-[var(--bg-card-alt)] text-[var(--text-muted)]"
            }`}
          >
            Visual Preview
          </button>
          <button
            onClick={() => setEditMode("code")}
            className={`px-3 py-1.5 rounded text-xs font-bold border-none cursor-pointer ${
              editMode === "code" ? "bg-navy text-white" : "bg-[var(--bg-card-alt)] text-[var(--text-muted)]"
            }`}
          >
            HTML Code
          </button>
        </div>
        <div className="flex-1" />
        <button
          onClick={regenerate}
          className="px-3 py-1.5 rounded text-xs font-semibold border border-[var(--border-input)] bg-transparent text-[var(--text-secondary)] cursor-pointer"
        >
          Regenerate from Editor
        </button>
        <button
          onClick={copyHtml}
          className="px-3 py-1.5 rounded text-xs font-bold border-none cursor-pointer text-white"
          style={{ background: BRAND.blue }}
        >
          Copy HTML
        </button>
      </div>

      {/* Editor Area */}
      {editMode === "preview" ? (
        <div className="rounded-lg border border-[var(--border-light)] overflow-hidden bg-white" style={{ boxShadow: "var(--shadow-panel)" }}>
          <iframe
            ref={iframeRef}
            srcDoc={html}
            className="w-full border-none"
            style={{ height: "80vh" }}
            title="Email Editor Preview"
          />
        </div>
      ) : (
        <div className="flex gap-4" style={{ height: "80vh" }}>
          {/* Code editor */}
          <div className="flex-1 flex flex-col">
            <div className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider mb-2">HTML Source</div>
            <textarea
              value={codeValue}
              onChange={handleCodeChange}
              className="flex-1 p-4 rounded-lg border border-[var(--border-light)] bg-[var(--bg-card)] text-[var(--text-primary)] text-[12px] font-mono leading-relaxed resize-none"
              spellCheck={false}
            />
          </div>
          {/* Live preview */}
          <div className="flex-1 flex flex-col">
            <div className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider mb-2">Live Preview</div>
            <div className="flex-1 rounded-lg border border-[var(--border-light)] overflow-hidden bg-white">
              <iframe
                srcDoc={html}
                className="w-full h-full border-none"
                title="Live Preview"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

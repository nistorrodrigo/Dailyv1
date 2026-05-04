import React, { useState } from "react";
import useDailyStore from "../../store/useDailyStore";
import useUIStore from "../../store/useUIStore";
import { toast } from "../../store/useToastStore";
import { authedFetch } from "../../lib/authedFetch";
import { estimateCost } from "./AIModelPicker";

interface CopyPromptBtnProps {
  section: string;
  currentText: string;
}

export function CopyPromptBtn({ section, currentText }: CopyPromptBtnProps): React.ReactElement {
  const [copied, setCopied] = useState(false);
  const date = useDailyStore((s) => s.date);

  const handleCopy = () => {
    const prompt = `You are a senior Argentina macro analyst at Latin Securities, a Buenos Aires-based investment bank.

Today is ${date}. Write a professional ${section} section for our Argentina Daily morning report sent to institutional investors.

Style: English, concise, factual, sell-side research tone. 2-4 sentences per block. Include specific numbers. Use UPPERCASE titles.

${currentText ? `Here is my current draft to improve or expand:\n\n${currentText}\n\n` : ""}Please write 2-3 blocks. Each block should have:
- A clear UPPERCASE title (e.g. TREASURY AUCTION RESULTS, FX / BCRA)
- A body with key facts and market impact
- An optional "LS View:" with a brief trade recommendation

Format as plain text, one block after another.`;

    navigator.clipboard.writeText(prompt).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <button
      onClick={handleCopy}
      className="px-2.5 py-1.5 rounded text-[10px] font-bold border cursor-pointer whitespace-nowrap"
      style={{
        borderColor: copied ? "#1a7a3a" : "var(--border-input)",
        color: copied ? "#1a7a3a" : "var(--text-muted)",
        background: "transparent",
      }}
      title="Copy a prompt to paste in claude.ai"
    >
      {copied ? "\u2713 Copied!" : "Copy Prompt"}
    </button>
  );
}

interface ImproveBtnProps {
  text: string;
  onImprove: (improved: string) => void;
  context?: string;
}

export function ImproveBtn({ text, onImprove, context = "macro/political section" }: ImproveBtnProps): React.ReactElement {
  const [loading, setLoading] = useState(false);

  const handleImprove = async () => {
    if (!text.trim()) { toast.info("Write something first, then click Improve"); return; }
    setLoading(true);
    try {
      const resp = await authedFetch("/api/ai-draft", {
        method: "POST",
        body: JSON.stringify({
          context: `IMPROVE THIS TEXT for the ${context} of an Argentina Daily report. Make it more professional, concise, and factual. Keep the same information but improve the writing quality. Return ONLY the improved text, no JSON, no explanation.\n\nOriginal text:\n${text}`,
          date: new Date().toISOString().split("T")[0],
          model: "haiku",
          mode: "macro",
        }),
      });
      const data = await resp.json();
      if (!data.ok) throw new Error(data.error);

      // The API returns blocks array, but we sent free-form text
      // The response might be in blocks[0].body or blocks[0].title
      const blocks = data.blocks || [];
      if (blocks.length > 0) {
        const improved = blocks.map((b: { title?: string; body?: string }) =>
          (b.body || b.title || "").trim()
        ).join("\n\n");
        if (improved) {
          onImprove(improved);
          // Surface real cost — Improve always uses Haiku, so this is
          // typically <$0.005 per click but the analyst should still
          // see it accumulate when clicking through several blocks.
          const inputTokens = data.usage?.input || 0;
          const outputTokens = data.usage?.output || 0;
          const cost = estimateCost("haiku", inputTokens, outputTokens);
          const tokens = inputTokens + outputTokens;
          toast.success(`Improved (${tokens.toLocaleString()} tokens · $${cost.toFixed(4)})`);
          return;
        }
      }
      toast.info("Could not improve — try again or edit manually");
    } catch (err) {
      toast.error("Improve failed: " + (err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleImprove}
      disabled={loading || !text.trim()}
      className="px-2.5 py-1.5 rounded text-[10px] font-bold border cursor-pointer whitespace-nowrap disabled:opacity-50"
      style={{
        borderColor: "#8b5cf6",
        color: "#8b5cf6",
        background: "transparent",
      }}
      title="Improve this text with AI (Haiku)"
    >
      {loading ? "Improving..." : "\u2728 Improve"}
    </button>
  );
}

import { type AIModelKey, estimateCost } from "../components/ui/AIModelPicker";
import { authedFetch } from "./authedFetch";

interface AICallOptions {
  prompt: string;
  model?: AIModelKey;
  maxTokens?: number;
}

interface AICallResult {
  text: string;
  /** Total tokens used (input + output). */
  tokens: number;
  /** Computed USD cost using the AIModelPicker rate card. Surfaces the
   *  real spend so callers can show it inline next to the result
   *  (every Anthropic-API surface in this app shows a $cost). */
  cost: number;
  model: string;
}

/**
 * Shape of the /api/ai-draft `mode: "macro"` response. Plain JS on
 * the server side means there's no shared type — this is the
 * contract the server emits, mirrored here so the client can
 * type-check the access without `any`.
 */
interface AIDraftMacroResponse {
  ok: boolean;
  error?: string;
  blocks?: { title?: string; body?: string; lsPick?: string }[];
  usage?: { input?: number; output?: number };
  model?: string;
  truncated?: boolean;
  parseRecovered?: boolean;
}

export async function aiCall({ prompt, model = "haiku", maxTokens = 1024 }: AICallOptions): Promise<AICallResult> {
  // `maxTokens` is currently unused — the server picks per-mode.
  // Keep the parameter so callers can pass it; once /api/ai-draft
  // honours a `max_tokens` body field we'll wire it through.
  void maxTokens;
  const resp = await authedFetch("/api/ai-draft", {
    method: "POST",
    body: JSON.stringify({
      context: prompt,
      date: new Date().toISOString().split("T")[0],
      model,
      mode: "macro",
    }),
  });
  const data = (await resp.json()) as AIDraftMacroResponse;
  if (!data.ok) throw new Error(data.error || "AI request failed");

  const text = (data.blocks ?? [])
    .map((b) => [b.title, b.body].filter(Boolean).join("\n"))
    .join("\n\n");

  const inputTokens = data.usage?.input || 0;
  const outputTokens = data.usage?.output || 0;

  return {
    text,
    tokens: inputTokens + outputTokens,
    cost: estimateCost(model, inputTokens, outputTokens),
    model: data.model || model,
  };
}

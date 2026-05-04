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

export async function aiCall({ prompt, model = "haiku", maxTokens = 1024 }: AICallOptions): Promise<AICallResult> {
  const resp = await authedFetch("/api/ai-draft", {
    method: "POST",
    body: JSON.stringify({
      context: prompt,
      date: new Date().toISOString().split("T")[0],
      model,
      mode: "macro",
    }),
  });
  const data = await resp.json();
  if (!data.ok) throw new Error(data.error);

  const text = data.blocks?.map((b: { title?: string; body?: string }) =>
    [b.title, b.body].filter(Boolean).join("\n")
  ).join("\n\n") || "";

  const inputTokens = data.usage?.input || 0;
  const outputTokens = data.usage?.output || 0;

  return {
    text,
    tokens: inputTokens + outputTokens,
    cost: estimateCost(model, inputTokens, outputTokens),
    model: data.model || model,
  };
}

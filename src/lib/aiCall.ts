import type { AIModelKey } from "../components/ui/AIModelPicker";
import { authedFetch } from "./authedFetch";

interface AICallOptions {
  prompt: string;
  model?: AIModelKey;
  maxTokens?: number;
}

interface AICallResult {
  text: string;
  tokens: number;
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

  return {
    text,
    tokens: (data.usage?.input || 0) + (data.usage?.output || 0),
    model: data.model || model,
  };
}

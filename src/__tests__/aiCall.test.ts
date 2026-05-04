import { describe, it, expect, beforeEach, vi } from "vitest";
import { aiCall } from "../lib/aiCall";

function jsonResp(body: unknown, status = 200): Response {
  return {
    status,
    ok: status >= 200 && status < 300,
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(JSON.stringify(body)),
  } as unknown as Response;
}

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("aiCall", () => {
  it("flattens blocks into a single text string with title + body", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResp({
        ok: true,
        blocks: [
          { title: "T1", body: "B1" },
          { title: "T2", body: "B2" },
        ],
        usage: { input: 100, output: 200 },
        model: "haiku",
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await aiCall({ prompt: "go" });
    expect(result.text).toBe("T1\nB1\n\nT2\nB2");
    expect(result.tokens).toBe(300);
    expect(result.model).toBe("haiku");
    // Cost from rate card (Haiku $1 in / $5 out per MTok):
    // 100/1e6 + 200×5/1e6 = 0.0001 + 0.001 = 0.0011
    expect(result.cost).toBeCloseTo(0.0011, 6);
  });

  it("posts to /api/ai-draft with the right body", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResp({ ok: true, blocks: [] }));
    vi.stubGlobal("fetch", fetchMock);

    await aiCall({ prompt: "hi", model: "sonnet" });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/ai-draft");
    expect(init.method).toBe("POST");
    const body = JSON.parse(init.body as string);
    expect(body.context).toBe("hi");
    expect(body.model).toBe("sonnet");
    expect(body.mode).toBe("macro");
    expect(body.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("throws when ok=false", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResp({ ok: false, error: "rate-limited" }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(aiCall({ prompt: "x" })).rejects.toThrow(/rate-limited/);
  });

  it("returns empty text when blocks is missing", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResp({ ok: true }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await aiCall({ prompt: "x" });
    expect(result.text).toBe("");
    expect(result.tokens).toBe(0);
    expect(result.cost).toBe(0);
  });

  it("skips empty title/body when joining", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResp({
        ok: true,
        blocks: [
          { title: "Only Title" },
          { body: "Only Body" },
          { title: "Both", body: "Both Body" },
        ],
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await aiCall({ prompt: "x" });
    expect(result.text).toBe("Only Title\n\nOnly Body\n\nBoth\nBoth Body");
  });

  it("falls back to the requested model name when server omits it", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResp({ ok: true, blocks: [] }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await aiCall({ prompt: "x", model: "opus" });
    expect(result.model).toBe("opus");
  });
});

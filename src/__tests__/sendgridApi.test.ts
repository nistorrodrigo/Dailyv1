import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  fetchSendGridLists,
  fetchSendGridContacts,
  invalidateSendGridListsCache,
} from "../lib/sendgridApi";

// Helper to build a fetch Response-shaped object.
function jsonResp(body: unknown, init: { status?: number; ok?: boolean } = {}): Response {
  const status = init.status ?? 200;
  const ok = init.ok ?? (status >= 200 && status < 300);
  return {
    status,
    ok,
    text: () => Promise.resolve(JSON.stringify(body)),
  } as unknown as Response;
}

function htmlResp(html: string, status = 200): Response {
  return {
    status,
    ok: status >= 200 && status < 300,
    text: () => Promise.resolve(html),
  } as unknown as Response;
}

beforeEach(() => {
  invalidateSendGridListsCache();
  vi.restoreAllMocks();
});

describe("fetchSendGridLists", () => {
  it("returns lists on success", async () => {
    const lists = [{ id: "a", name: "List A", count: 10 }];
    const fetchMock = vi.fn().mockResolvedValue(jsonResp({ ok: true, lists }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchSendGridLists();
    expect(result).toEqual(lists);
    expect(fetchMock).toHaveBeenCalledWith("/api/sendgrid-lists");
  });

  it("caches results for 5 minutes", async () => {
    const lists = [{ id: "a", name: "List A", count: 10 }];
    const fetchMock = vi.fn().mockResolvedValue(jsonResp({ ok: true, lists }));
    vi.stubGlobal("fetch", fetchMock);

    await fetchSendGridLists();
    await fetchSendGridLists();
    await fetchSendGridLists();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("force=true bypasses cache", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResp({ ok: true, lists: [] }));
    vi.stubGlobal("fetch", fetchMock);

    await fetchSendGridLists();
    await fetchSendGridLists(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("invalidateSendGridListsCache forces refetch on next call", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResp({ ok: true, lists: [] }));
    vi.stubGlobal("fetch", fetchMock);

    await fetchSendGridLists();
    invalidateSendGridListsCache();
    await fetchSendGridLists();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("throws helpful error on 404 with HTML body (vite dev case)", async () => {
    const fetchMock = vi.fn().mockResolvedValue(htmlResp("<html><body>404</body></html>", 404));
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchSendGridLists()).rejects.toThrow(/vercel dev/);
  });

  it("throws when ok=false in body", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResp({ ok: false, error: "API key missing" }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchSendGridLists()).rejects.toThrow(/API key missing/);
  });

  it("throws on non-JSON 200 response", async () => {
    const fetchMock = vi.fn().mockResolvedValue(htmlResp("<!doctype html>not json", 200));
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchSendGridLists()).rejects.toThrow(/non-JSON/);
  });

  it("returns empty array when server returns no lists field", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResp({ ok: true }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchSendGridLists();
    expect(result).toEqual([]);
  });
});

describe("fetchSendGridContacts", () => {
  it("returns contacts directly when server returns them synchronously (small list)", async () => {
    const contacts = [{ email: "a@x.com", name: "A" }];
    const fetchMock = vi.fn().mockResolvedValue(jsonResp({ ok: true, contacts }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchSendGridContacts("list-1");
    expect(result).toEqual(contacts);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith("/api/sendgrid-lists?listId=list-1", expect.any(Object));
  });

  it("polls until status=ready, then returns contacts", async () => {
    const contacts = [{ email: "a@x.com", name: "A" }, { email: "b@y.com", name: "B" }];
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResp({ ok: true, exportId: "xp1", status: "pending" }))
      .mockResolvedValueOnce(jsonResp({ ok: true, status: "pending" }))
      .mockResolvedValueOnce(jsonResp({ ok: true, status: "pending" }))
      .mockResolvedValueOnce(jsonResp({ ok: true, status: "ready", contacts }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchSendGridContacts("list-1", { pollIntervalMs: 1, maxAttempts: 10 });
    expect(result).toEqual(contacts);
    // 1 start + 3 polls
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it("invokes onProgress on each poll attempt", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResp({ ok: true, exportId: "xp1", status: "pending" }))
      .mockResolvedValueOnce(jsonResp({ ok: true, status: "ready", contacts: [] }));
    vi.stubGlobal("fetch", fetchMock);

    const messages: string[] = [];
    await fetchSendGridContacts("list-1", {
      pollIntervalMs: 1,
      onProgress: (m) => messages.push(m),
    });

    expect(messages[0]).toMatch(/Starting export/i);
    expect(messages.some((m) => /Exporting/.test(m))).toBe(true);
  });

  it("throws on poll status=failure", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResp({ ok: true, exportId: "xp1", status: "pending" }))
      .mockResolvedValueOnce(jsonResp({ ok: true, status: "failure" }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      fetchSendGridContacts("list-1", { pollIntervalMs: 1 })
    ).rejects.toThrow(/export failure/i);
  });

  it("throws on timeout when polls never reach ready", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResp({ ok: true, exportId: "xp1", status: "pending" }))
      .mockResolvedValue(jsonResp({ ok: true, status: "pending" }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      fetchSendGridContacts("list-1", { pollIntervalMs: 1, maxAttempts: 3 })
    ).rejects.toThrow(/timed out/i);
  });

  it("throws if start response has neither contacts nor exportId", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResp({ ok: true }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      fetchSendGridContacts("list-1", { pollIntervalMs: 1 })
    ).rejects.toThrow(/neither contacts nor exportId/);
  });

  it("propagates ok=false from start response", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResp({ ok: false, error: "Invalid list" }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      fetchSendGridContacts("list-1", { pollIntervalMs: 1 })
    ).rejects.toThrow(/Invalid list/);
  });

  it("throws on AbortSignal", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResp({ ok: true, exportId: "xp1", status: "pending" }))
      .mockResolvedValue(jsonResp({ ok: true, status: "pending" }));
    vi.stubGlobal("fetch", fetchMock);

    const controller = new AbortController();
    const promise = fetchSendGridContacts("list-1", {
      pollIntervalMs: 5,
      maxAttempts: 100,
      signal: controller.signal,
    });
    // Abort after the first poll round.
    setTimeout(() => controller.abort(), 15);

    await expect(promise).rejects.toThrow(/aborted/i);
  });

  it("URL-encodes the listId", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResp({ ok: true, contacts: [] }));
    vi.stubGlobal("fetch", fetchMock);

    await fetchSendGridContacts("list with spaces & ampersands", { pollIntervalMs: 1 });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/sendgrid-lists?listId=list%20with%20spaces%20%26%20ampersands",
      expect.any(Object)
    );
  });
});

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock node:dns BEFORE importing the helper so the helper's
// top-level `import dns from "node:dns"` picks up the mock. The
// helper calls `dns.lookup(host, {all, family}, cb)` — we control
// what addresses it sees.
//
// vi.mock factory has to declare the lookup spy fresh; we attach
// it back to the module export shape Node exposes.
const dnsLookupMock = vi.fn();
vi.mock("node:dns", () => ({
  default: { lookup: dnsLookupMock },
  lookup: dnsLookupMock,
}));

// fetch is mocked per-test via vi.stubGlobal so we can assert
// what URL the helper tried to reach and respond appropriately.
let fetchMock: ReturnType<typeof vi.fn>;
beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
  // Default DNS mock: fail closed (test must opt into a specific
  // result via mockDnsResolves). Prevents tests from hanging
  // forever on an unmocked DNS lookup.
  dnsLookupMock.mockImplementation((_host, _opts, cb) => {
    cb(new Error("DNS mock not configured for this test"), null);
  });
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  dnsLookupMock.mockReset();
});

/** Helper — make dnsLookupMock resolve to the given IPs for the
 *  next call. The helper expects an `{all: true}` lookup so it
 *  receives an array. */
function mockDnsResolves(ips: string[]) {
  dnsLookupMock.mockImplementation((_host, _opts, cb) => {
    cb(null, ips.map((address) => ({ address, family: address.includes(":") ? 6 : 4 })));
  });
}

/** Importing the helper inside each test (not top-of-file) lets us
 *  guarantee fresh dns mock state since the module's static
 *  imports are hoisted. */
async function load() {
  return import("../../api/_helpers.js");
}

describe("extractLinkMeta SSRF guards", () => {
  it("rejects non-http(s) schemes", async () => {
    const { extractLinkMeta } = await load();
    for (const url of [
      "javascript:alert(1)",
      "data:text/html,<script>",
      "file:///etc/passwd",
      "ftp://example.com/",
      "vbscript:msgbox(1)",
    ]) {
      const r = await extractLinkMeta(url);
      expect(r.ok).toBe(false);
      expect(r.error).toMatch(/http and https/i);
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects literal private IPs (no DNS needed)", async () => {
    const { extractLinkMeta } = await load();
    for (const url of [
      "http://127.0.0.1/",
      "http://10.0.0.5/",
      "http://192.168.1.1/",
      "http://169.254.169.254/",          // AWS metadata
      "http://172.17.0.1/",                // Docker bridge default
      "http://[::1]/",                     // IPv6 loopback
      "http://[fe80::1]/",                 // link-local
      "http://[fc00::1]/",                 // ULA
    ]) {
      const r = await extractLinkMeta(url);
      expect(r.ok).toBe(false);
      expect(r.error).toMatch(/private|hostname|not allowed/i);
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects hostnames that DNS-resolve to private ranges", async () => {
    const { extractLinkMeta } = await load();
    mockDnsResolves(["169.254.169.254"]);  // attacker-controlled DNS → AWS metadata
    const r = await extractLinkMeta("http://metadata.attacker.example/");
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/private range/i);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects IPv4-mapped IPv6 literals", async () => {
    const { extractLinkMeta } = await load();
    const r = await extractLinkMeta("http://[::ffff:127.0.0.1]/");
    expect(r.ok).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects when any of multiple DNS results is private", async () => {
    const { extractLinkMeta } = await load();
    // First A record is public, second is private — must reject.
    mockDnsResolves(["8.8.8.8", "127.0.0.1"]);
    const r = await extractLinkMeta("http://mixed-resolve.example/");
    expect(r.ok).toBe(false);
  });

  it("rejects when DNS fails entirely", async () => {
    const { extractLinkMeta } = await load();
    dnsLookupMock.mockImplementation((_host, _opts, cb) => {
      cb(new Error("ENOTFOUND"), null);
    });
    const r = await extractLinkMeta("http://does-not-exist.example/");
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/dns/i);
  });

  it("re-validates a redirect target before following", async () => {
    const { extractLinkMeta } = await load();
    // Two DNS calls (initial URL + redirect target). First is
    // public, second is private. Use mockImplementationOnce in
    // order — they're consumed FIFO by each successive call.
    dnsLookupMock
      .mockImplementationOnce((_host, _opts, cb) => cb(null, [{ address: "8.8.8.8", family: 4 }]))
      .mockImplementationOnce((_host, _opts, cb) => cb(null, [{ address: "169.254.169.254", family: 4 }]));
    fetchMock.mockResolvedValueOnce({
      status: 302,
      ok: false,
      // fetch Response API — headers is a Headers-like with a
      // .get(name) method. The Map shim used previously didn't
      // satisfy that contract.
      headers: { get: (k: string) => (k.toLowerCase() === "location" ? "http://metadata.attacker.example/secret" : null) },
    });
    const r = await extractLinkMeta("http://legit-then-malicious.example/");
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/redirect rejected/i);
    // Only the first hop should have been fetched — we bailed
    // before following.
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("happy path: public host with HTML response returns parsed meta", async () => {
    const { extractLinkMeta } = await load();
    mockDnsResolves(["8.8.8.8"]);
    const headers = new Map([["content-type", "text/html; charset=utf-8"]]);
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: { get: (k: string) => headers.get(k.toLowerCase()) || null },
      body: null,
      text: async () => `<html><head>
        <meta property="og:title" content="Hello World" />
        <meta name="author" content="Jane Analyst" />
        <meta property="og:description" content="A test page" />
      </head></html>`,
    });
    const r = await extractLinkMeta("https://news.example/article");
    expect(r.ok).toBe(true);
    expect(r.title).toBe("Hello World");
    expect(r.author).toBe("Jane Analyst");
    expect(r.description).toBe("A test page");
  });
});

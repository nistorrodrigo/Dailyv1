import { describe, it, expect } from "vitest";
import type { User } from "@supabase/supabase-js";
import { displayNameFromUser, displayNameFromEmail } from "../utils/displayName";

/** Build a minimal User-shaped object for testing — only the fields the
 *  helper actually reads. We cast through unknown because the real User
 *  type has dozens of required fields we don't care about here. */
function makeUser(opts: { email?: string | null; full_name?: string | null }): User {
  return {
    email: opts.email ?? undefined,
    user_metadata: opts.full_name == null ? {} : { full_name: opts.full_name },
  } as unknown as User;
}

describe("displayNameFromUser", () => {
  it("uses user_metadata.full_name when present", () => {
    const u = makeUser({ email: "rodrigo.nistor@latinsecurities.ar", full_name: "Rodrigo Nistor" });
    expect(displayNameFromUser(u)).toBe("Rodrigo Nistor");
  });

  it("trims whitespace around full_name", () => {
    const u = makeUser({ email: "x@y.com", full_name: "  Padded  Name  " });
    expect(displayNameFromUser(u)).toBe("Padded  Name");
  });

  it("falls back to title-cased email local-part with dot separator", () => {
    const u = makeUser({ email: "rodrigo.nistor@latinsecurities.ar" });
    expect(displayNameFromUser(u)).toBe("Rodrigo Nistor");
  });

  it("title-cases an underscore-separated local part", () => {
    const u = makeUser({ email: "ana_maria@latinsecurities.ar" });
    expect(displayNameFromUser(u)).toBe("Ana Maria");
  });

  it("title-cases a hyphen-separated local part", () => {
    const u = makeUser({ email: "juan-carlos@latinsecurities.ar" });
    expect(displayNameFromUser(u)).toBe("Juan Carlos");
  });

  it("handles a single-word local part", () => {
    const u = makeUser({ email: "rodrigo@latinsecurities.ar" });
    expect(displayNameFromUser(u)).toBe("Rodrigo");
  });

  it("normalises mixed-case input to title case", () => {
    const u = makeUser({ email: "RODRIGO.NISTOR@latinsecurities.ar" });
    expect(displayNameFromUser(u)).toBe("Rodrigo Nistor");
  });

  it("ignores empty full_name and falls back to email", () => {
    const u = makeUser({ email: "rodrigo.nistor@latinsecurities.ar", full_name: "   " });
    expect(displayNameFromUser(u)).toBe("Rodrigo Nistor");
  });

  it("returns empty string when there is no email and no metadata", () => {
    const u = makeUser({ email: null, full_name: null });
    expect(displayNameFromUser(u)).toBe("");
  });

  it("collapses consecutive separators", () => {
    const u = makeUser({ email: "rodrigo..nistor@latinsecurities.ar" });
    expect(displayNameFromUser(u)).toBe("Rodrigo Nistor");
  });
});

describe("displayNameFromEmail", () => {
  it("title-cases dot-separated local part", () => {
    expect(displayNameFromEmail("rodrigo.nistor@latinsecurities.ar")).toBe("Rodrigo Nistor");
  });

  it("handles single-word local part", () => {
    expect(displayNameFromEmail("rodrigo@x.com")).toBe("Rodrigo");
  });

  it("returns empty string for null/undefined/empty", () => {
    expect(displayNameFromEmail(null)).toBe("");
    expect(displayNameFromEmail(undefined)).toBe("");
    expect(displayNameFromEmail("")).toBe("");
  });

  it("returns empty string for an email with no local part", () => {
    expect(displayNameFromEmail("@latinsecurities.ar")).toBe("");
  });

  it("normalises mixed-case input", () => {
    expect(displayNameFromEmail("RODRIGO.NISTOR@LATINSECURITIES.AR")).toBe("Rodrigo Nistor");
  });
});

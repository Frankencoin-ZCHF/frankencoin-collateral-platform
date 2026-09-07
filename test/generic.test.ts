import { describe, expect, it } from "vitest";
import { assertSafeUrl, guardedLookup, isPrivateIp, DEFAULT_ALLOWED_HOSTS } from "@/upstream/generic";

describe("SSRF guard", () => {
  it("classifies private addresses", () => {
    for (const ip of ["10.0.0.1", "127.0.0.1", "169.254.169.254", "172.16.5.5", "192.168.1.1", "100.64.0.1", "0.0.0.0", "::1", "fe80::1", "fd00::1", "::ffff:127.0.0.1"]) {
      expect(isPrivateIp(ip), ip).toBe(true);
    }
    for (const ip of ["8.8.8.8", "1.1.1.1", "2606:4700::1111"]) expect(isPrivateIp(ip), ip).toBe(false);
  });

  it("rejects non-https, credentials, localhost and private IP literals", () => {
    expect(() => assertSafeUrl("http://example.com/x")).toThrow(/https/);
    expect(() => assertSafeUrl("https://user:pw@example.com/x")).toThrow(/Credentials/);
    expect(() => assertSafeUrl("https://localhost/x")).toThrow(/Blocked host/);
    expect(() => assertSafeUrl("https://169.254.169.254/latest/meta-data")).toThrow(/private/);
    expect(() => assertSafeUrl("https://[::1]/x")).toThrow(/private/);
    expect(() => assertSafeUrl("not a url")).toThrow(/Invalid URL/);
  });

  it("accepts a public https URL", () => {
    expect(assertSafeUrl("https://api.llama.fi/tvl/lido").hostname).toBe("api.llama.fi");
  });

  it("ships a production allowlist of known public data hosts", () => {
    expect(DEFAULT_ALLOWED_HOSTS).toContain("api.llama.fi");
    expect(DEFAULT_ALLOWED_HOSTS).toContain("api.coingecko.com");
    expect(DEFAULT_ALLOWED_HOSTS.every((h) => !/localhost|internal/.test(h))).toBe(true);
  });

  it("guardedLookup refuses hosts that resolve to private addresses (DNS rebinding / redirect targets)", async () => {
    const result = await new Promise<{ err: Error | null; addr?: unknown }>((resolve) => {
      guardedLookup("localhost", { all: false }, (err, addr) => resolve({ err: err as Error | null, addr }));
    });
    expect(result.err).not.toBeNull();
    expect(String(result.err?.message)).toMatch(/private address/);
  });
});

import { describe, expect, it } from "vitest";
import { assertSafeUrl, isPrivateIp } from "@/upstream/generic";

describe("SSRF guard", () => {
  it("classifies private addresses", () => {
    for (const ip of ["10.0.0.1", "127.0.0.1", "169.254.169.254", "172.16.5.5", "192.168.1.1", "100.64.0.1", "0.0.0.0", "::1", "fe80::1", "fd00::1", "::ffff:127.0.0.1"]) {
      expect(isPrivateIp(ip), ip).toBe(true);
    }
    for (const ip of ["8.8.8.8", "1.1.1.1", "2606:4700::1111"]) expect(isPrivateIp(ip), ip).toBe(false);
  });

  it("rejects non-https, credentials, localhost and private IP literals without DNS", async () => {
    await expect(assertSafeUrl("http://example.com/x", { resolve: false })).rejects.toThrow(/https/);
    await expect(assertSafeUrl("https://user:pw@example.com/x", { resolve: false })).rejects.toThrow(/Credentials/);
    await expect(assertSafeUrl("https://localhost/x", { resolve: false })).rejects.toThrow(/Blocked host/);
    await expect(assertSafeUrl("https://169.254.169.254/latest/meta-data", { resolve: false })).rejects.toThrow(/private/);
    await expect(assertSafeUrl("https://[::1]/x", { resolve: false })).rejects.toThrow(/private/);
    await expect(assertSafeUrl("not a url", { resolve: false })).rejects.toThrow(/Invalid URL/);
  });

  it("accepts a public https URL (no DNS)", async () => {
    const u = await assertSafeUrl("https://api.llama.fi/tvl/lido", { resolve: false });
    expect(u.hostname).toBe("api.llama.fi");
  });
});

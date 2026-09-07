// Refresh test/fixtures/bridges.json: registered bridge minters (Ponder) + on-chain reads.
// Usage: node scripts/capture-bridges.mjs
import { writeFileSync } from "node:fs";
const RPCS = ["https://ethereum-rpc.publicnode.com", "https://eth.llamarpc.com", "https://cloudflare-eth.com"];
const S = { horizon: "0x1ce832b5", limit: "0xa4d66daf", minted: "0x4f02c420", chf: "0x37b272b0" };
let rpc = null;
for (const u of RPCS) {
  try {
    const j = await fetch(u, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_blockNumber", params: [] }), signal: AbortSignal.timeout(8000) }).then((r) => r.json());
    if (j.result) { rpc = u; break; }
  } catch { /* next */ }
}
if (!rpc) throw new Error("no RPC reachable");
const call = async (to, data) => (await fetch(rpc, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_call", params: [{ to, data }, "latest"] }), signal: AbortSignal.timeout(15000) }).then((r) => r.json())).result;
const q = await fetch("https://ponder.frankencoin.com", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ query: "{ frankencoinMinters(limit: 100) { items { chainId minter applyMessage applyDate denyDate txHash } } }" }) }).then((r) => r.json());
const minters = q.data.frankencoinMinters.items.filter((m) => m.chainId === 1 && /bridge/i.test(m.applyMessage) && !(m.denyDate && Number(m.denyDate) > 0));
const out = [];
for (const m of minters) {
  const [h, l, mi, c] = await Promise.all([call(m.minter, S.horizon), call(m.minter, S.limit), call(m.minter, S.minted), call(m.minter, S.chf)]);
  const ok = [h, l, mi, c].every((x) => typeof x === "string" && x.length === 66);
  out.push({ bridge: m.minter.toLowerCase(), message: m.applyMessage, appliedAt: Number(m.applyDate), txHash: m.txHash, ok, horizon: ok ? Number(BigInt(h)) : null, limitRaw: ok ? BigInt(l).toString() : null, mintedRaw: ok ? BigInt(mi).toString() : null, chf: ok ? "0x" + c.slice(26) : null, fetchedAt: new Date().toISOString() });
}
writeFileSync(new URL("../test/fixtures/bridges.json", import.meta.url), JSON.stringify(out, null, 2));
console.log(out.map((b) => `${b.message}: minted ${b.mintedRaw && (Number(BigInt(b.mintedRaw) / 10n ** 12n) / 1e6).toFixed(0)} / limit ${b.limitRaw && (Number(BigInt(b.limitRaw) / 10n ** 12n) / 1e6).toFixed(0)} · horizon ${b.horizon && new Date(b.horizon * 1000).toISOString().slice(0, 10)}`).join(String.fromCharCode(10)));

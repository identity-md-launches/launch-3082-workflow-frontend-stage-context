import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join, relative } from "node:path";
import { createHash } from "node:crypto";
import { abiHash } from "./hashing.mjs";
const web = fileURLToPath(new URL("../", import.meta.url));
const dist = join(web, "../dist");
const read = (p) => JSON.parse(readFileSync(p));
const m = read(join(dist, "imd-deployment.json"));
const h = read(join(web, "deployment.handoff.json"));
const n = read(join(web, "network.handoff.json"));
// While pinned worker inputs exist, also compare the build copies to those inputs.
for (const [file, copy] of [
  ["deployment.json", h],
  ["network.json", n],
]) {
  const pinned = join(web, "../.imd/reads", file);
  if (existsSync(pinned)) assert.deepEqual(copy, read(pinned));
}

assert.deepEqual(
  Object.keys(m).sort(),
  [
    "version",
    "launchId",
    "chainId",
    "sourceCommit",
    "attestationHash",
    "contracts",
    "poolKey",
    "network",
    "walletAddChain",
    "assets",
  ].sort(),
);
for (const key of [
  "version",
  "launchId",
  "chainId",
  "sourceCommit",
  "attestationHash",
])
  assert.deepEqual(m[key], h[key]);
assert.deepEqual(m.network, n.network);
assert.deepEqual(m.walletAddChain, n.walletAddChain);
assert.deepEqual(
  m.contracts.map(({ name, address, abiHash }) => ({ name, address, abiHash })),
  h.contracts.map(({ name, address, abiHash }) => ({ name, address, abiHash })),
);
if (h.poolKey) assert.deepEqual(m.poolKey, h.poolKey);
for (const c of m.contracts) {
  assert.match(c.abiPath, /^abi\/[A-Za-z0-9_]+\.json$/);
  assert.equal(abiHash(read(join(dist, c.abiPath))), c.abiHash);
  assert.match(c.abiHash, /^[a-f0-9]{64}$/);
}
function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? walk(p) : [relative(dist, p)];
  });
}
assert.deepEqual(
  m.assets.map((a) => a.path).sort(),
  walk(dist)
    .filter((p) => p !== "imd-deployment.json")
    .sort(),
);
assert(m.assets.length <= 128);
let bytes = 0;
for (const a of m.assets) {
  assert(
    !a.path.includes("..") && !a.path.startsWith("/") && !a.path.includes(":"),
  );
  assert.match(a.sha256, /^[a-f0-9]{64}$/);
  const b = readFileSync(join(dist, a.path));
  bytes += b.length;
  assert(b.length <= 8388608);
  assert.equal(createHash("sha256").update(b).digest("hex"), a.sha256);
}
assert(bytes < 32 * 1024 * 1024);
assert(m.assets.some((a) => a.path === "index.html"));
assert(
  !m.assets.some((a) => /(?:node_modules|\.cache|\.tgz$|\.map$)/.test(a.path)),
);
const index = readFileSync(join(dist, "index.html"), "utf8");
assert(!/(?:src|href)="\/(?!\/)/.test(index));
console.log(
  JSON.stringify(
    {
      result: "PASS",
      assets: m.assets.length,
      exportBytes: bytes,
      abiHashes: "match pinned handoff",
      network: "exact match",
      poolKey: m.poolKey,
    },
    null,
    2,
  ),
);

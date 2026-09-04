#!/usr/bin/env node
/**
 * Deploy both GenSurvival contracts to GenLayer studionet and patch
 * src/chain/addresses.ts with the new addresses.
 *
 * Usage (from repo root):
 *   node deploy/deploy-studionet.mjs                # both contracts
 *   node deploy/deploy-studionet.mjs registry       # just player_registry.py
 *   node deploy/deploy-studionet.mjs oracle         # just disaster_oracle.py
 *
 * Deploying resets all player state: registrations, inventories, houses and
 * the leaderboard all start empty at the new addresses.
 */

import { readFileSync, writeFileSync } from "fs";
import { resolve, dirname, join } from "path";
import { fileURLToPath } from "url";
import { createRequire } from "module";
import { loadOrCreateDeployer, KEY_PATH } from "./keystore.mjs";

const __dir = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dir, "..");
const req = createRequire(join(root, "package.json"));

const { createClient } = req("genlayer-js");
const { studionet } = req("genlayer-js/chains");
const { TransactionStatus } = req("genlayer-js/types");

const RPC = "https://studio.genlayer.com/api";

const CONTRACTS = {
  registry: {
    source: "contracts/player_registry.py",
    key: "PLAYER_REGISTRY",
    label: "GenSurvivalGame",
  },
  oracle: {
    source: "contracts/disaster_oracle.py",
    key: "DISASTER_ORACLE",
    label: "DisasterOracle",
  },
};

const requested = process.argv.slice(2).filter((a) => !a.startsWith("-"));
const targets = requested.length ? requested : Object.keys(CONTRACTS);
for (const t of targets) {
  if (!CONTRACTS[t]) {
    console.error(`Unknown target "${t}". Expected: ${Object.keys(CONTRACTS).join(", ")}`);
    process.exit(1);
  }
}

async function rpc(method, params, rawBody) {
  const body = rawBody ?? JSON.stringify({ jsonrpc: "2.0", id: 1, method, params });
  const res = await fetch(RPC, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
  });
  const json = await res.json();
  if (json.error) throw new Error(`RPC ${method}: ${json.error.message}`);
  return json.result;
}

// ── 1. Persistent deployer key ───────────────────────────────────────────────
const { account, created } = loadOrCreateDeployer();
if (created) {
  console.log(`Created a new deployer key at ${KEY_PATH} — back it up.`);
}
console.log(`Deployer: ${account.address}`);

// ── 2. Top up from the studionet faucet if the balance is low ────────────────
const rawBalance = await rpc("eth_getBalance", [account.address, "latest"]);
let gen = parseInt(rawBalance, 16) / 1e18;
console.log(`Balance:  ${gen.toFixed(0)} GEN`);

if (gen < 100) {
  console.log("Balance low — requesting 1000 GEN from sim_fundAccount…");
  // Amount must be a plain JSON integer (not hex, not quoted) — build the raw
  // body to avoid JS float precision loss on 1e21.
  await rpc(
    "sim_fundAccount",
    null,
    `{"jsonrpc":"2.0","id":1,"method":"sim_fundAccount","params":["${account.address}",1000000000000000000000]}`,
  );
  gen = parseInt(await rpc("eth_getBalance", [account.address, "latest"]), 16) / 1e18;
  console.log(`Balance:  ${gen.toFixed(0)} GEN`);
}

// ── 3. Deploy ────────────────────────────────────────────────────────────────
const client = createClient({ chain: studionet, account });
const deployed = {};

for (const name of targets) {
  const { source, key, label } = CONTRACTS[name];
  const code = readFileSync(resolve(root, source), "utf8");

  console.log(`\nDeploying ${label} (${source})…`);
  const txHash = await client.deployContract({ code, args: [] });
  console.log(`TX:       ${txHash}`);
  console.log("Waiting for FINALIZED (1–4 min)…");

  const receipt = await client.waitForTransactionReceipt({
    hash: txHash,
    status: TransactionStatus.FINALIZED,
    retries: 120,
    interval: 3000,
  });

  const address = receipt?.data?.contract_address ?? receipt?.contractAddress;
  if (!address) {
    console.error(`Could not read ${label}'s address from the receipt:`);
    console.error(JSON.stringify(receipt, null, 2));
    process.exit(1);
  }

  deployed[key] = address;
  console.log(`${label}: ${address}`);
}

// ── 4. Patch src/chain/addresses.ts ──────────────────────────────────────────
const addressesTs = resolve(root, "src/chain/addresses.ts");
let src = readFileSync(addressesTs, "utf8");
let patchedAll = true;

for (const [key, address] of Object.entries(deployed)) {
  const pattern = new RegExp(`(${key}:\\s*')0x[0-9a-fA-F]+(')`);
  if (!pattern.test(src)) {
    patchedAll = false;
    console.warn(`\nWarning: could not find ${key} in addresses.ts. Set it manually:`);
    console.warn(`  ${key}: '${address}'`);
    continue;
  }
  src = src.replace(pattern, `$1${address}$2`);
}

if (patchedAll) {
  writeFileSync(addressesTs, src, "utf8");
  console.log("\nPatched  src/chain/addresses.ts ✓");
}

console.log("\nPlayer state is empty at the new addresses.");
console.log("Next: commit src/chain/addresses.ts and push to deploy the frontend.");

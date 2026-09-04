#!/usr/bin/env node
/**
 * Show the deployer address, creating the key on first run.
 *
 * Usage (from repo root):
 *   node deploy/wallet.mjs
 *
 * Prints the address only. The key is written to ~/.genlayer/deployer.key and
 * never printed, so it cannot end up in scrollback, a screenshot or a chat log.
 */

import { loadOrCreateDeployer, KEY_PATH } from "./keystore.mjs";

const { account, created } = loadOrCreateDeployer();

if (created) {
  console.log("Created a new deployer key.");
  console.log(`Stored at: ${KEY_PATH}`);
  console.log("Back it up — lose it and you lose owner control of every");
  console.log("contract deployed with it.\n");
} else {
  console.log(`Using existing deployer key at ${KEY_PATH}\n`);
}

console.log(`Deployer address: ${account.address}`);
console.log("\nFund this address with GEN, then run:");
console.log("  node deploy/deploy-studionet.mjs");

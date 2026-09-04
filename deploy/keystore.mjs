/**
 * Shared GenLayer deployer key.
 *
 * The key lives outside the repos, at ~/.genlayer/deployer.key, so ChainTales
 * and GenSurvival deploy from the same funded address and there is only one
 * secret to back up. Override the location with GENLAYER_DEPLOYER_KEY.
 *
 * This is a real credential: whoever holds it owns every contract deployed with
 * it. Do not commit it, paste it, or send it to anyone.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync, chmodSync } from "fs";
import { resolve, dirname, join } from "path";
import { fileURLToPath } from "url";
import { createRequire } from "module";

const __dir = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dir, "..");
const req = createRequire(join(root, "package.json"));

const { createAccount, generatePrivateKey } = req("genlayer-js");

const HOME = process.env.USERPROFILE || process.env.HOME;
if (!HOME) throw new Error("Cannot resolve a home directory for the deployer key.");

export const KEY_PATH =
  process.env.GENLAYER_DEPLOYER_KEY || resolve(HOME, ".genlayer", "deployer.key");

/**
 * Load the deployer key, creating one on first use.
 * Returns { account, created } — never the key itself.
 */
export function loadOrCreateDeployer() {
  if (existsSync(KEY_PATH)) {
    const pk = readFileSync(KEY_PATH, "utf8").trim();
    if (!/^0x[0-9a-fA-F]{64}$/.test(pk)) {
      throw new Error(
        `${KEY_PATH} does not contain a 0x-prefixed 32-byte hex key. ` +
          `Delete it to generate a fresh one, or restore the correct key.`,
      );
    }
    return { account: createAccount(pk), created: false };
  }

  mkdirSync(dirname(KEY_PATH), { recursive: true });
  const pk = generatePrivateKey();
  writeFileSync(KEY_PATH, pk + "\n", { encoding: "utf8", mode: 0o600 });
  try {
    chmodSync(KEY_PATH, 0o600);
  } catch {
    /* best-effort; POSIX modes do not map to NTFS ACLs */
  }
  return { account: createAccount(pk), created: true };
}

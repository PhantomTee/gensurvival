# GenSurvival

A browser survival game whose world is written by an AI reading today's news, on
[GenLayer](https://genlayer.com) Intelligent Contracts.

Gather, craft and build in a shared world — where the era you're surviving in,
the value of what you build, and what your improvised crafting produces are all
decided on-chain by an AI no single player controls.

---

## Why this needs GenLayer

GenLayer contracts can call an LLM and fetch the live web from inside the
contract, and reach validator consensus on the result. Three parts of this game
are built on that, and none of them work on a conventional chain:

**The world is shared, and authored.** `refresh_world` reads real headlines and
writes one era every player is subject to — a name, a danger level, a bountiful
resource and a scarce one. This is the part that genuinely needs consensus: a
private AI event could be produced by any server, but strangers agreeing on one
world cannot be. It isn't flavour either — the bountiful resource changes what
mining, chopping and fishing actually pay out, identically for everyone.

**Buildings are graded, not counted.** Minting a house sends your real placed
tiles to the contract, which renders them and has its LLM judge what you
actually built — structure type and quality 1–5, which set the NFT's rarity and
your XP. It reads the layout, not the claim. An empty 4×4 plot submitted as
*"a vast marble palace with towers and a great hall"* comes back `HOVEL,
quality 1/5`.

**Crafting is open.** The fixed recipe table is still there as the fast path,
but `craft_freeform` lets you combine anything with a stated intent and has the
contract rule on the result. Three logs and "split the logs into planks" gives
you planks. One plank and "forge a legendary iron greatsword" gives you nothing,
and costs you the plank.

The contract trusts its own output because it produced it — but not blindly.
Grants are whitelisted and capped, quality is clamped, era resources come from a
fixed list.

---

## Gameplay

| Key | Action |
|-----|--------|
| `WASD` | Move |
| `J` | Attack / Mine / Shoot |
| `F` | Pick up items / Catch chicken / Tame dog |
| `E` | Eat equipped food |
| `K` | Interact / Fish |
| `RMB` | Place equipped item |
| `1–5` | Select hotbar slot |
| `I` | Inventory (and IMPROVISE crafting) |
| `M` | Map (WASD to pan) |
| `L` | Leaderboard |
| `ESC` | Pause |

---

## Architecture

**Frontend:** Phaser 3.90 with a React 19 UI overlay. Movement, combat and
animation run in the browser at frame rate. Economic actions — gathering,
crafting, building — are verified on-chain.

**Blockchain:** one Python [GenLayer Intelligent Contract](https://docs.genlayer.com)
on Studionet.

| Contract | Address | Role |
|----------|---------|------|
| `GenSurvivalGame` | `0x5613649C8C8FE4460e3C3B5888d9014375a5182C` | Everything: registry, inventory, gathering, crafting, houses, leaderboard, the shared world era and AI events |

It was previously two contracts. A separate oracle could only *recommend* an
event, and the registry receiving that recommendation had no way to tell it from
a player asking for free items — so every positive reward was silently
discarded and "good" events existed only in the UI. Generating and applying the
event in one transaction is what makes them real.

**Database:** Supabase mirrors progress for analytics. The in-game leaderboard
reads from the contract, not from Supabase.

---

## What goes on-chain

| Off-chain (free, instant) | On-chain (verified, permanent) |
|---------------------------|--------------------------------|
| Movement & camera | Player name & profile |
| Health / energy during play | Inventory, XP and score |
| Animations & combat state | Terrain and tree verification |
| Chunk rendering | Mining / chopping / fishing results |
| | Build tile placements |
| | House NFTs and their AI grade |
| | The shared world era |
| | AI event outcomes |
| | Leaderboard |

The contract derives terrain and tree placement from the same hash the client
uses, so it verifies gathering rather than trusting the client's word for it.
Gathering is additionally rate-, distance- and volume-limited, because the world
is infinite and one-shot-per-coordinate cannot bound farming on its own.

---

## The world era

Every 6 hours a new epoch begins, and for the first 3 hours anyone may call
`refresh_world`. The first caller pays for the refresh and everyone lives under
the result. The contract fetches headlines from BBC, The Guardian and NPR,
feeds them to an LLM under an equivalence principle, and writes a single era:

```json
{
  "era_name": "Shadow of Sabotage",
  "danger_level": 4,
  "bountiful_item": "COAL",
  "scarce_item": "FISH",
  "headline_basis": "Europe faces sabotage and Russia-linked attacks, while
                     Ukraine endures drone strikes and global tensions rise."
}
```

Separately, each player may trigger up to 4 personal world events per 24 hours.
These read your inventory, XP and houses from contract storage — never from the
client — and apply the result atomically.

---

## Stack

- **Game engine:** [Phaser 3](https://phaser.io)
- **UI:** React 19 + Zustand
- **Blockchain:** [GenLayer](https://genlayer.com) (Python Intelligent Contracts)
- **Chain client:** [genlayer-js](https://github.com/genlayer/genlayer-js)
- **Database:** [Supabase](https://supabase.com)
- **Build:** Vite + TypeScript

---

## Local development

```bash
npm install
npm run dev
```

The game runs without a wallet or Supabase config — on-chain actions and
analytics skip silently. Connect an EVM wallet on GenLayer Studionet for the
full flow.

Supabase is optional; copy `.env.example` to `.env.local` to enable it. The anon
key is public by design, so enable Row Level Security on the project — without
it the mirror tables accept arbitrary rows.

```bash
npm run build
```

---

## Contracts

```
contracts/
  player_registry.py   # GenSurvivalGame — the whole game
```

```bash
node deploy/wallet.mjs             # show the deployer address to fund
node deploy/deploy-studionet.mjs   # deploy and patch src/chain/addresses.ts
```

The deployer key lives at `~/.genlayer/deployer.key`, outside the repo, and is
reused across deploys — whoever holds it owns the deployed contract. **Deploying
resets all player state.**

Two things about the contract header cost a day of silent failures, both
documented at the top of `player_registry.py`: the `py-genlayer` version must be
pinned, because the floating `test` tag is broken on Studionet, and a blank line
must follow the header, because GenVM parses the comment lines beneath it as
further directives. Both failures produce an entirely empty error.

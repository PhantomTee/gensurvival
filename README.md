# GenSurvival

A blockchain-powered browser survival game built on [GenLayer](https://genlayer.com) Intelligent Contracts.

Gather resources, craft tools, build houses, and face AI-driven world events shaped by real-world news — all recorded on-chain.

---

## Gameplay

| Key | Action |
|-----|--------|
| `WASD` | Move |
| `J` | Attack / Mine / Shoot |
| `F` | Pick up items / Tame dog |
| `E` | Eat equipped food |
| `K` | Interact / Fish |
| `RMB` | Place equipped item |
| `1–5` | Select hotbar slot |
| `I` | Inventory |
| `M` | Map (WASD to pan) |
| `L` | Leaderboard |
| `ESC` | Pause |

---

## Architecture

**Frontend:** Phaser 3.90 game engine with a React 19 UI overlay. All game logic (movement, combat, animations) runs entirely off-chain in the browser. Economic actions — crafting, mining, building, fishing — are verified on-chain.

**Blockchain:** Two Python [GenLayer Intelligent Contracts](https://docs.genlayer.com) deployed on Studionet.

| Contract | Address | Role |
|----------|---------|------|
| `GenSurvivalGame` | `0x50ec5288387c51015642a476Fc1094FE96BF90e9` | Player registry, inventory, crafting, houses, leaderboard |
| `DisasterOracle` | `0x48a1ab06633f1891f006398737C91d1Eec83e808` | AI events — fetches live news, runs LLM, reaches validator consensus |

**Database:** Supabase mirrors on-chain state for real-time leaderboard reads.

---

## What Goes On-Chain

| Off-chain (free, instant) | On-chain (verified, permanent) |
|--------------------------|-------------------------------|
| Movement & camera | Player name & profile |
| Health / energy during play | Crafted item deltas |
| Tile map & chunk data | Mining / chopping / fishing results |
| Combat state | Build tile placements |
| Animations | House NFT ownership |
| | AI event outcomes |
| | Global leaderboard scores |

---

## AI Events

Every 6 hours a submission window opens (1 hour). During the window, players can submit their current stats to `DisasterOracle`. The contract:

1. Fetches live headlines from BBC, Reuters, and AP News
2. Feeds them + the player's game state into an LLM prompt
3. Reaches strict consensus across all GenLayer validators
4. Returns a signed event: disaster, good, or neutral — with health, energy, XP, and inventory deltas

Events are shaped by real-world news. A war headline triggers a zombie siege. A scientific breakthrough restores energy. A market crash drains resources. Rate limited to 4 submissions per 24 hours.

---

## Stack

- **Game engine:** [Phaser 3](https://phaser.io)
- **UI:** React 19 + Zustand
- **Blockchain:** [GenLayer](https://genlayer.com) (Python Intelligent Contracts)
- **Chain client:** [genlayer-js](https://github.com/genlayer/genlayer-js)
- **Database:** [Supabase](https://supabase.com)
- **Build:** Vite + TypeScript

---

## Local Development

```bash
# Install dependencies
npm install

# Create environment file
echo "VITE_SUPABASE_ANON_KEY=your_anon_key_here" > .env.local

# Start dev server
npm run dev
```

The game runs without a wallet or Supabase key — on-chain actions and DB sync simply skip silently. Connect MetaMask to a GenLayer Studionet node to enable the full blockchain flow.

```bash
# Production build
npm run build
```

---

## Contracts

Both contracts are in `contracts/`. Deploy via [GenLayer Studio](https://studio.genlayer.com).

```
contracts/
  player_registry.py   # GenSurvivalGame — main game contract
  disaster_oracle.py   # DisasterOracle  — AI event oracle
```

After redeployment, update the addresses in `src/chain/addresses.ts`.

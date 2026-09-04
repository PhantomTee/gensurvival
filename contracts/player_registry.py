# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }

# Two things about the two lines above, both of which cost a day of failed
# deploys:
#   * The version is pinned. "py-genlayer:test" is a floating tag and is
#     currently broken on studionet - a contract that deploys fine with this
#     hash fails with nothing but an empty GenVM error when using it.
#   * The blank line is required. GenVM reads the run of comment lines
#     directly beneath the Depends header as further header directives, so
#     prose there fails the deploy the same silent way.

#
# GenSurvivalGame — main game contract.
# Previously called PlayerRegistry; renamed because this contract now handles
# registration, state, mining, chopping, fishing, crafting, build tiles,
# house minting, house state, and leaderboard in one canonical place.
# The frontend addresses.ts still references it as PLAYER_REGISTRY (address-based,
# not class-name-based) so the rename has no effect on deployed ABI.

from genlayer import *
from datetime import datetime, timezone
import json
import re


# ── Recipes ───────────────────────────────────────────────────────────────────
RECIPES = {
    # Hand (no station needed)
    "wood_plank":   {"inputs": {"WOOD_LOG": 1},                               "output": "WOOD_PLANK",   "output_count": 4,  "station": "HAND"},
    "wood_stick":   {"inputs": {"WOOD_PLANK": 1},                             "output": "WOOD_STICK",   "output_count": 4,  "station": "HAND"},
    "torch":        {"inputs": {"WOOD_STICK": 1, "COAL": 1},                  "output": "TORCH",        "output_count": 4,  "station": "HAND"},
    "wood_wall":    {"inputs": {"WOOD_PLANK": 4},                             "output": "WOOD_WALL",    "output_count": 1,  "station": "HAND"},
    "wood_floor":   {"inputs": {"WOOD_PLANK": 2},                             "output": "WOOD_FLOOR",   "output_count": 1,  "station": "HAND"},
    "bench":        {"inputs": {"WOOD_PLANK": 8},                             "output": "BENCH",        "output_count": 1,  "station": "HAND"},
    "wood_sword":   {"inputs": {"WOOD_PLANK": 3, "WOOD_STICK": 2},            "output": "WOOD_SWORD",   "output_count": 1,  "station": "HAND"},
    "wood_axe":     {"inputs": {"WOOD_PLANK": 3, "WOOD_STICK": 2},            "output": "WOOD_AXE",     "output_count": 1,  "station": "HAND"},
    "wood_pickaxe": {"inputs": {"WOOD_PLANK": 3, "WOOD_STICK": 2},            "output": "WOOD_PICKAXE", "output_count": 1,  "station": "HAND"},
    "fishing_rod":  {"inputs": {"WOOD_STICK": 3, "WOOD_PLANK": 1},            "output": "FISHING_ROD",  "output_count": 1,  "station": "HAND"},
    "bread":        {"inputs": {"WHEAT": 3},                                  "output": "BREAD",        "output_count": 2,  "station": "HAND"},
    # Bench
    "chest":        {"inputs": {"WOOD_PLANK": 8},                             "output": "CHEST",        "output_count": 1,  "station": "BENCH"},
    "furnace":      {"inputs": {"STONE": 8},                                  "output": "FURNACE",      "output_count": 1,  "station": "BENCH"},
    "lantern":      {"inputs": {"TORCH": 4, "STONE": 4},                      "output": "LANTERN",      "output_count": 1,  "station": "BENCH"},
    "iron_sword":   {"inputs": {"IRON_INGOT": 4, "WOOD_STICK": 2},            "output": "IRON_SWORD",   "output_count": 1,  "station": "BENCH"},
    "iron_pickaxe": {"inputs": {"IRON_INGOT": 3, "WOOD_STICK": 2},            "output": "IRON_PICKAXE", "output_count": 1,  "station": "BENCH"},
    "iron_axe":     {"inputs": {"IRON_INGOT": 3, "WOOD_STICK": 2},            "output": "IRON_AXE",     "output_count": 1,  "station": "BENCH"},
    "tnt_craft":    {"inputs": {"COAL": 3, "STONE": 4},                       "output": "TNT",          "output_count": 1,  "station": "BENCH"},
    "bed":          {"inputs": {"WOOD_PLANK": 6},                             "output": "BED",          "output_count": 1,  "station": "BENCH"},
    "bullet":       {"inputs": {"IRON_INGOT": 1, "COAL": 2},                  "output": "BULLET",       "output_count": 10, "station": "BENCH"},
    "pistol":       {"inputs": {"IRON_INGOT": 4, "WOOD_STICK": 2, "COAL": 2}, "output": "PISTOL",       "output_count": 1,  "station": "BENCH"},
    "rifle":        {"inputs": {"IRON_INGOT": 6, "WOOD_STICK": 3, "COAL": 3}, "output": "RIFLE",        "output_count": 1,  "station": "BENCH"},
    # Furnace
    "iron_ingot":   {"inputs": {"IRON_ORE": 2, "COAL": 1},                   "output": "IRON_INGOT",   "output_count": 1,  "station": "FURNACE"},
    "cooked_meat":  {"inputs": {"RAW_MEAT": 1, "COAL": 1},                   "output": "COOKED_MEAT",  "output_count": 1,  "station": "FURNACE"},
    # No "house_deed" entry on purpose. The client intercepts that recipe id in
    # doCraft() and routes it to mint_house instead of craft(), so it never
    # reached this table through the UI - but it was still reachable over raw
    # RPC, where it burned a full house's materials for a HOUSE_DEED item that
    # mint_house neither requires nor consumes. craft() now rejects it as an
    # unknown recipe. The cost the player actually pays is HOUSE_MATERIAL_COST
    # below, deducted once in mint_house; the client keeps its own house_deed
    # entry in src/game/registry/RECIPES.ts purely to price the Build button.
}

# ── Placeable items ───────────────────────────────────────────────────────────
PLACEABLE_ITEMS = {
    "WOOD_WALL":  {"kind": "tile",   "tile": "WOOD_WALL"},
    "WOOD_FLOOR": {"kind": "tile",   "tile": "WOOD_FLOOR"},
    "BENCH":      {"kind": "entity", "tile": "BENCH"},
    "CHEST":      {"kind": "entity", "tile": "CHEST"},
    "FURNACE":    {"kind": "entity", "tile": "FURNACE"},
    "TORCH":      {"kind": "entity", "tile": "TORCH"},
    "LANTERN":    {"kind": "entity", "tile": "LANTERN"},
    "BED":        {"kind": "entity", "tile": "BED"},
    "TNT":        {"kind": "entity", "tile": "TNT"},
}

# ── World data ────────────────────────────────────────────────────────────────
FISHING_DROPS  = ["FISH", "FISH", "FISH", "WOOD_STICK", "STONE"]  # 60 % fish
MINEABLE_DROPS = {"ROCK": "STONE", "COAL_ORE": "COAL", "IRON_ORE": "IRON_ORE"}

# Material cost for minting a house, deducted once in mint_house. Keep this in
# step with the house_deed entry in src/game/registry/RECIPES.ts, which is what
# the crafting UI shows the player before they build.
HOUSE_MATERIAL_COST = {
    "WOOD_PLANK": 40, "STONE": 30, "WOOD_WALL": 16,
    "WOOD_FLOOR": 16, "IRON_INGOT": 8, "COAL": 5,
}

# -- Anti-cheat: gathering limits ---------------------------------------------
# The world is infinite and every one-shot key is namespaced by address, so
# "one action per coordinate" cannot bound resource generation by itself - a
# script just walks the coordinate space. These three limits do bound it:
#   * a minimum interval between gathers (kills burst scripting),
#   * a maximum jump between consecutive gather coordinates (a script that
#     sweeps the map cannot teleport; a real player walks),
#   * a rolling 24 h ceiling.
DAY_SECONDS         = 24 * 3600
MIN_GATHER_INTERVAL = 2      # seconds between two gather actions
MAX_GATHER_STEP     = 48     # tiles between consecutive gather coordinates
MAX_GATHERS_PER_DAY = 600

# ── AI world events ──────────────────────────────────────────────────────────
# Live RSS feeds, verified reachable. Reuters retired its public RSS and
# apnews.com/rss now 404s, so both were replaced.
NEWS_SOURCES = [
    "https://feeds.bbci.co.uk/news/world/rss.xml",
    "https://www.theguardian.com/world/rss",
    "https://feeds.npr.org/1004/rss.xml",
]

EPOCH_DURATION    = 6 * 3600
CALL_WINDOW       = 3 * 3600   # half of each epoch, so the feature is reachable
MAX_CALLS_PER_DAY = 4

# Bounds on what one event may hand out. The contract trusts its own LLM output
# because it produced it, but "produced it" is not "is sane" - a hallucinated
# {"WOOD_LOG": 999999999} would otherwise mint itself straight into inventory.
# Grants are also restricted to a known item list so the model cannot invent
# items that no recipe, icon or drop table knows about.
EVENT_GRANTABLE_ITEMS = [
    "WOOD_LOG", "WOOD_PLANK", "WOOD_STICK", "STONE", "COAL",
    "IRON_ORE", "FISH", "RAW_MEAT", "WHEAT", "BREAD",
]
MAX_EVENT_ITEM_GRANT = 8
MAX_EVENT_ITEM_TYPES = 4
MAX_EVENT_XP_DELTA   = 40

# Trees are placed by a per-coordinate hash so the contract can verify one
# exists. src/game/world/WorldGenerator.ts uses the identical rule.
# The leaderboard is kept as a maintained top-N rather than rebuilt by scanning
# every registered player on read - that scan grew without bound and would
# eventually stop returning.
LEADERBOARD_SIZE    = 100

TREE_HASH_SALT      = 53
TREE_HASH_THRESHOLD = 850    # 8.5 % of coordinates carry a tree


# ─────────────────────────────────────────────────────────────────────────────
class GenSurvivalGame(gl.Contract):
    # Player registry
    players:         TreeMap[str, str]   # addr_hex -> profile JSON
    player_states:   TreeMap[str, str]   # addr_hex -> state JSON
    registered_at:   TreeMap[str, u256]
    player_addresses: DynArray[str]

    # World actions (one-shot per coord per player)
    mined_tiles:   TreeMap[str, bool]    # "addr:x:y" -> True
    chopped_trees: TreeMap[str, bool]    # "addr:x:y" -> True
    build_tiles:   TreeMap[str, str]     # "addr:x:y" -> tile type

    # House NFTs
    houses:       TreeMap[u256, str]     # token_id -> metadata JSON
    owner_houses: TreeMap[str, str]      # addr_hex -> JSON array of token_ids
    next_house_id: u256

    # World events: rate-limit log and the last event applied, per player.
    # No replay-protection map is needed any more - an event is generated and
    # applied inside one transaction, so there is no window to replay it in.
    call_log:   TreeMap[str, str]   # addr_hex -> JSON array of unix timestamps
    last_event: TreeMap[str, str]   # addr_hex -> last applied event JSON

    # Anti-cheat gather log - addr_hex -> "last_ts:last_x:last_y:window_start:count"
    gather_log: TreeMap[str, str]

    # Maintained top-N ranking - key "data" -> JSON array, score-descending
    leaderboard_top: TreeMap[str, str]

    def __init__(self) -> None:
        self.next_house_id = u256(1)

    # ── Internal helpers ──────────────────────────────────────────────────────

    def _now(self) -> int:
        raw = gl.message_raw["datetime"]
        if raw.endswith("Z"):
            raw = raw[:-1] + "+00:00"
        parsed = datetime.fromisoformat(raw)
        if parsed.tzinfo is None:
            parsed = parsed.replace(tzinfo=timezone.utc)
        return int(parsed.timestamp())

    def _epoch(self, ts: int) -> int:
        return ts // EPOCH_DURATION

    def _in_window(self, ts: int) -> bool:
        return (ts - self._epoch(ts) * EPOCH_DURATION) < CALL_WINDOW

    def _calls_in_day(self, addr_hex: str, now: int) -> int:
        if addr_hex not in self.call_log:
            return 0
        cutoff = now - DAY_SECONDS
        count = 0
        for timestamp in json.loads(self.call_log[addr_hex]):
            if timestamp > cutoff:
                count += 1
        return count

    def _record_call(self, addr_hex: str, now: int) -> None:
        calls = json.loads(self.call_log[addr_hex]) if addr_hex in self.call_log else []
        cutoff = now - DAY_SECONDS
        kept = [t for t in calls if t > cutoff]
        kept.append(now)
        self.call_log[addr_hex] = json.dumps(kept, sort_keys=True)

    def _pick_event_house(self, addr_hex: str) -> int:
        """Choose which house an event damages, on-chain.

        The client used to pass houses[0], so every house after the first was
        permanently immune. Prefer the best undamaged house, else the first.
        """
        owned = json.loads(self.owner_houses[addr_hex]) if addr_hex in self.owner_houses else []
        if len(owned) == 0:
            return -1
        best_id = -1
        best_quality = -1
        for house_id in owned:
            meta = json.loads(self.houses[u256(int(house_id))])
            if meta.get("damaged", False):
                continue
            quality = int(meta.get("quality", 1))
            if quality > best_quality:
                best_quality = quality
                best_id = int(house_id)
        return best_id if best_id >= 0 else int(owned[0])

    def _coord_key(self, addr_hex: str, x: int, y: int) -> str:
        return addr_hex + ":" + str(x) + ":" + str(y)

    def _hash(self, seed: int, x: int, y: int, salt: int) -> int:
        """32-bit avalanche mix, bit-identical to chainHash() in the client.

        Every step is masked to 32 bits because JavaScript's bitwise operators
        coerce to int32 and cannot be made to match Python's arbitrary-precision
        integers. The previous version did not mask, so client and contract
        disagreed on 99.9 % of coordinates - the contract was validating a
        different world than the one the player could see.
        """
        mask = 0xFFFFFFFF
        h = (seed + x * 374761393 + y * 668265263 + salt * 1442695041) & mask
        h ^= h >> 15
        h = (h * 2246822519) & mask
        h ^= h >> 13
        h = (h * 3266489917) & mask
        h ^= h >> 16
        return h % 10000

    def _terrain_at(self, seed: int, x: int, y: int) -> str:
        quarry = self._quarry_rock_at(seed, x, y)
        if len(quarry) > 0:
            return quarry
        region   = self._hash(seed, x // 48, y // 48, 11)
        shoulder = self._hash(seed, x // 16, y // 16, 13)
        detail   = self._hash(seed, x, y, 17)
        vein     = self._hash(seed, x, y, 29)
        water    = self._hash(seed, x // 7, y // 7, 41)
        if water < 650:
            return "WATER"
        if region > 5400 and shoulder > 1400 and detail > 900:
            if vein > 9100:
                return "IRON_ORE"
            if vein > 7200:
                return "COAL_ORE"
            return "ROCK"
        if detail < 900:
            return "SAND"
        return "GRASS"

    def _quarry_rock_at(self, seed: int, x: int, y: int) -> str:
        # WORLD_SIZE / 2 + offset, matching the client's quarryRockTile().
        cx, cy = 256 + 40, 256 + 8
        dx, dy = x - cx, y - cy
        # Scaled integer ellipse test - the client uses the identical form so
        # the two never disagree on a boundary tile through float rounding.
        ridge_scaled = (dx * dx * 10000) // (38 * 38) + (dy * dy * 10000) // (24 * 24)
        chipped_edge = self._hash(seed, x, y, 71) > 1150
        if ridge_scaled > 10000 or not chipped_edge:
            return ""
        vein = self._hash(seed, x, y, 73)
        if vein > 9300:
            return "IRON_ORE"
        if vein > 7600:
            return "COAL_ORE"
        return "ROCK"

    def _tree_at(self, seed: int, x: int, y: int) -> bool:
        if self._terrain_at(seed, x, y) != "GRASS":
            return False
        return self._hash(seed, x, y, 53) < 850

    def _default_state(self, addr_hex: str, name: str) -> dict:
        return {
            "address":       addr_hex,
            "name":          name,
            "inventory":     {},
            "xp":            0,
            "days_survived": 0,
            "house_count":   0,
            "score":         0,
            "updated_at":    self._now(),
        }

    def _get_state(self, addr_hex: str) -> dict:
        if addr_hex in self.player_states:
            return json.loads(self.player_states[addr_hex])
        name = ""
        if addr_hex in self.players:
            profile = json.loads(self.players[addr_hex])
            name = profile.get("name", "")
        return self._default_state(addr_hex, name)

    def _score(self, state: dict) -> int:
        inventory = state.get("inventory", {})
        xp    = int(state.get("xp", 0))
        days  = int(state.get("days_survived", 0))
        houses = int(state.get("house_count", 0))
        score = xp + houses * 500 + days * 10
        for _, count in inventory.items():
            if int(count) > 0:
                score += int(count) * 2
        return score

    def _save_state(self, addr_hex: str, state: dict) -> None:
        state["address"]    = addr_hex
        state["score"]      = self._score(state)
        state["updated_at"] = self._now()
        self.player_states[addr_hex] = json.dumps(state, sort_keys=True)
        self._update_leaderboard(addr_hex, state.get("name", ""), int(state["score"]))

        profile = json.loads(self.players[addr_hex])
        profile["name"]        = state.get("name", profile.get("name", ""))
        profile["house_count"] = int(state.get("house_count", 0))
        profile["score"]       = state["score"]
        profile["address"]     = addr_hex
        if "registered_at" not in profile:
            profile["registered_at"] = int(self.registered_at[addr_hex])
        self.players[addr_hex] = json.dumps(profile, sort_keys=True)

    def _update_leaderboard(self, addr_hex: str, name: str, score: int) -> None:
        """Keep a score-ordered top-N so get_leaderboard is O(1) in player count.

        Writing is skipped entirely for players who are neither ranked nor good
        enough to displace the last ranked entry, so the common case costs
        nothing. One caveat: a ranked player whose score *falls* keeps their
        slot until someone outside the list next acts and displaces them, since
        promoting the right replacement would need the full scan this exists to
        avoid. The ranking self-corrects as play continues.
        """
        raw = self.leaderboard_top["data"] if "data" in self.leaderboard_top else "[]"
        entries = json.loads(raw)

        kept = []
        was_ranked = False
        for e in entries:
            if e["address"] == addr_hex:
                was_ranked = True
            else:
                kept.append(e)

        if (not was_ranked
                and len(kept) >= LEADERBOARD_SIZE
                and int(score) <= int(kept[-1]["score"])):
            return

        kept.append({"address": addr_hex, "name": name, "score": int(score)})
        kept.sort(key=lambda e: -int(e["score"]))
        self.leaderboard_top["data"] = json.dumps(kept[:LEADERBOARD_SIZE], sort_keys=True)

    def _apply_inventory_delta(self, state: dict, delta: dict) -> None:
        inventory = state.get("inventory", {})
        for item, amount in delta.items():
            next_amount = int(inventory.get(item, 0)) + int(amount)
            if next_amount > 0:
                inventory[item] = next_amount
            elif item in inventory:
                del inventory[item]
        state["inventory"] = inventory

    def _deduct_items(self, state: dict, cost: dict, quantity: int) -> dict:
        inventory = state.get("inventory", {})
        deduct = {}
        for item, needed in cost.items():
            total_needed = int(needed) * quantity
            have = int(inventory.get(item, 0))
            assert have >= total_needed, "Insufficient materials: need " + str(total_needed) + " " + item
            deduct[item] = total_needed
        for item, amount in deduct.items():
            remaining = int(inventory[item]) - amount
            if remaining > 0:
                inventory[item] = remaining
            else:
                del inventory[item]
        state["inventory"] = inventory
        return deduct

    def _grant_items(self, state: dict, grant: dict) -> None:
        inventory = state.get("inventory", {})
        for item, amount in grant.items():
            inventory[item] = int(inventory.get(item, 0)) + int(amount)
        state["inventory"] = inventory

    def _require_registered(self, addr_hex: str) -> None:
        assert addr_hex in self.players, "Not registered"

    def _tree_exists_at(self, x: int, y: int) -> bool:
        """Per-coordinate tree placement - mirrored exactly by the client."""
        return self._hash(0, int(x), int(y), TREE_HASH_SALT) < TREE_HASH_THRESHOLD

    def _assert_and_record_gather(self, addr_hex: str, x: int, y: int) -> None:
        """Rate-, distance- and volume-limit resource gathering.

        Without this, mine/chop/fish are unbounded: the coordinate space is
        infinite and each one-shot key is per-player, so a script can farm
        forever. See the constants block for the reasoning behind each limit.
        """
        now = self._now()

        if addr_hex not in self.gather_log:
            self.gather_log[addr_hex] = (
                str(now) + ":" + str(int(x)) + ":" + str(int(y)) + ":" + str(now) + ":1"
            )
            return

        parts        = self.gather_log[addr_hex].split(":")
        last_ts      = int(parts[0])
        last_x       = int(parts[1])
        last_y       = int(parts[2])
        window_start = int(parts[3])
        count        = int(parts[4])

        assert now - last_ts >= MIN_GATHER_INTERVAL, "Gathering too fast"

        step = max(abs(int(x) - last_x), abs(int(y) - last_y))
        assert step <= MAX_GATHER_STEP, "Gather coordinate too far from your last action"

        if now - window_start >= DAY_SECONDS:
            window_start = now
            count = 0
        assert count < MAX_GATHERS_PER_DAY, "Daily gathering limit reached"

        self.gather_log[addr_hex] = (
            str(now) + ":" + str(int(x)) + ":" + str(int(y)) + ":"
            + str(window_start) + ":" + str(count + 1)
        )

    # ── Registration ──────────────────────────────────────────────────────────

    @gl.public.write
    def register(self, player_name: str) -> None:
        addr_hex = gl.message.sender_address.as_hex
        assert len(player_name) > 0, "Player name cannot be empty"
        assert addr_hex not in self.players, "Already registered"

        timestamp = u256(self._now())
        profile = {
            "address":      addr_hex,
            "name":         player_name,
            "house_count":  0,
            "score":        0,
            "registered_at": self._now(),
        }
        state = self._default_state(addr_hex, player_name)
        self.players[addr_hex]       = json.dumps(profile, sort_keys=True)
        self.player_states[addr_hex] = json.dumps(state, sort_keys=True)
        self.registered_at[addr_hex] = timestamp
        self.player_addresses.append(addr_hex)
        self._update_leaderboard(addr_hex, player_name, 0)

    @gl.public.write
    def update_profile(self, profile_json: str) -> None:
        addr_hex = gl.message.sender_address.as_hex
        self._require_registered(addr_hex)
        assert len(profile_json) > 0, "Profile JSON cannot be empty"

        incoming = json.loads(profile_json)
        assert isinstance(incoming, dict), "Profile must be an object"
        current = json.loads(self.players[addr_hex])
        protected_address      = current.get("address", addr_hex)
        protected_registered_at = current.get("registered_at", int(self.registered_at[addr_hex]))

        for key, value in incoming.items():
            if key not in ("address", "registered_at", "score"):
                current[key] = value

        current["address"]      = protected_address
        current["registered_at"] = protected_registered_at
        self.players[addr_hex]  = json.dumps(current, sort_keys=True)

        state = self._get_state(addr_hex)
        if "name" in incoming and len(str(incoming["name"])) > 0:
            state["name"] = incoming["name"]
            self._save_state(addr_hex, state)

    @gl.public.write
    def record_survival_day(self, day_number: int) -> str:
        addr_hex = gl.message.sender_address.as_hex
        self._require_registered(addr_hex)

        # A game day is one real 24 h cycle (see DAY_STAGES in the client), so
        # the highest day a player can honestly be on is bounded by how long
        # they have been registered. Without this, day_number is free score.
        elapsed = self._now() - int(self.registered_at[addr_hex])
        max_day = 1 + max(0, elapsed) // DAY_SECONDS
        assert int(day_number) >= 1, "Day number must be at least 1"
        assert int(day_number) <= max_day, "Day number ahead of real elapsed time"

        state = self._get_state(addr_hex)
        if int(day_number) > int(state.get("days_survived", 0)):
            state["days_survived"] = int(day_number)
            self._save_state(addr_hex, state)
        return self.player_states[addr_hex]

    # ── World actions ─────────────────────────────────────────────────────────

    @gl.public.write
    def mine_tile(self, x: int, y: int, terrain_type: str) -> str:
        # The contract derives the terrain itself - terrain_type is kept in the
        # signature only for ABI compatibility and must agree with what we
        # compute. Rock/ore placement is identical here and in the client's
        # chainRockTile().
        addr_hex = gl.message.sender_address.as_hex
        self._require_registered(addr_hex)
        key = self._coord_key(addr_hex, int(x), int(y))
        assert key not in self.mined_tiles, "Tile already mined"

        actual = self._terrain_at(0, int(x), int(y))
        assert actual in MINEABLE_DROPS, "No mineable tile at these coordinates"
        assert terrain_type == actual, "Claimed terrain does not match the world"
        self._assert_and_record_gather(addr_hex, int(x), int(y))

        drop  = MINEABLE_DROPS[actual]
        state = self._get_state(addr_hex)
        grant = {drop: 1}
        self._grant_items(state, grant)
        state["xp"] = int(state.get("xp", 0)) + 1
        self.mined_tiles[key] = True
        self._save_state(addr_hex, state)

        return json.dumps({"deduct": {}, "grant": grant, "inventory": state["inventory"], "xp": state["xp"], "score": state["score"]}, sort_keys=True)

    @gl.public.write
    def chop_tree(self, x: int, y: int) -> str:
        # Tree placement is a per-coordinate hash, so the contract can verify a
        # tree is really there. The client uses the same rule, restricted to
        # walkable land - client trees are a subset of contract-valid ones.
        addr_hex = gl.message.sender_address.as_hex
        self._require_registered(addr_hex)
        key = self._coord_key(addr_hex, int(x), int(y))
        assert key not in self.chopped_trees, "Tree already chopped"
        assert self._tree_exists_at(int(x), int(y)), "No tree at these coordinates"
        self._assert_and_record_gather(addr_hex, int(x), int(y))

        state = self._get_state(addr_hex)
        grant = {"WOOD_LOG": 3}
        self._grant_items(state, grant)
        state["xp"] = int(state.get("xp", 0)) + 1
        self.chopped_trees[key] = True
        self._save_state(addr_hex, state)

        return json.dumps({"deduct": {}, "grant": grant, "inventory": state["inventory"], "xp": state["xp"], "score": state["score"]}, sort_keys=True)

    @gl.public.write
    def fish_tile(self, x: int, y: int) -> str:
        addr_hex = gl.message.sender_address.as_hex
        self._require_registered(addr_hex)

        neighbors = [(int(x)-1, int(y)), (int(x)+1, int(y)), (int(x), int(y)-1), (int(x), int(y)+1)]
        near_water = any(self._terrain_at(0, nx, ny) == "WATER" for nx, ny in neighbors)
        assert near_water, "Must fish adjacent to water"
        self._assert_and_record_gather(addr_hex, int(x), int(y))

        # Deterministic drop from address entropy so the same spot gives variety per player
        h = self._hash(0, int(x) + ord(addr_hex[2]) * 7, int(y) + ord(addr_hex[3]) * 13, 99)
        drop  = FISHING_DROPS[h % len(FISHING_DROPS)]
        state = self._get_state(addr_hex)
        grant = {drop: 1}
        self._grant_items(state, grant)
        state["xp"] = int(state.get("xp", 0)) + 1
        self._save_state(addr_hex, state)

        return json.dumps({"deduct": {}, "grant": grant, "inventory": state["inventory"], "xp": state["xp"], "score": state["score"]}, sort_keys=True)

    # ── Crafting ──────────────────────────────────────────────────────────────

    @gl.public.write
    def craft(self, recipe_id: str, at_station: str, quantity: int, station_x: int, station_y: int) -> str:
        addr_hex = gl.message.sender_address.as_hex
        self._require_registered(addr_hex)
        assert recipe_id in RECIPES, "Unknown recipe"
        assert 1 <= int(quantity) <= 64, "Quantity must be 1-64"

        recipe           = RECIPES[recipe_id]
        required_station = recipe["station"]
        assert at_station == required_station, "Wrong crafting station"

        if required_station != "HAND":
            station_key = self._coord_key(addr_hex, int(station_x), int(station_y))
            assert station_key in self.build_tiles, "Station not placed on-chain"
            assert self.build_tiles[station_key] == required_station, "Wrong on-chain station type"

        state  = self._get_state(addr_hex)
        deduct = self._deduct_items(state, recipe["inputs"], int(quantity))
        grant  = {recipe["output"]: int(recipe["output_count"]) * int(quantity)}
        self._grant_items(state, grant)
        state["xp"] = int(state.get("xp", 0)) + int(quantity)
        self._save_state(addr_hex, state)

        return json.dumps({"deduct": deduct, "grant": grant, "inventory": state["inventory"], "xp": state["xp"], "score": state["score"]}, sort_keys=True)

    # ── Build tiles ───────────────────────────────────────────────────────────

    @gl.public.write
    def place_build_tile(self, x: int, y: int, item_id: str) -> str:
        addr_hex = gl.message.sender_address.as_hex
        self._require_registered(addr_hex)
        assert item_id in PLACEABLE_ITEMS, "Item cannot be placed"

        key = self._coord_key(addr_hex, int(x), int(y))
        assert key not in self.build_tiles, "Coordinate already occupied"

        state  = self._get_state(addr_hex)
        deduct = self._deduct_items(state, {item_id: 1}, 1)
        placed = PLACEABLE_ITEMS[item_id]
        self.build_tiles[key] = placed["tile"]
        self._save_state(addr_hex, state)

        return json.dumps({"deduct": deduct, "grant": {}, "inventory": state["inventory"], "placed": {"x": int(x), "y": int(y), "item_id": item_id, "tile": placed["tile"], "kind": placed["kind"]}}, sort_keys=True)

    # ── House minting ─────────────────────────────────────────────────────────

    def _house_not_claimed(self, addr_hex: str, x: int, y: int, width: int, height: int) -> bool:
        existing = json.loads(self.owner_houses[addr_hex]) if addr_hex in self.owner_houses else []
        for house_id in existing:
            meta = json.loads(self.houses[u256(int(house_id))])
            overlap_x = int(x) < int(meta["x"]) + int(meta["width"])  and int(meta["x"]) < int(x) + int(width)
            overlap_y = int(y) < int(meta["y"]) + int(meta["height"]) and int(meta["y"]) < int(y) + int(height)
            if overlap_x and overlap_y:
                return False
        return True

    def _is_house_shape(self, addr_hex: str, x: int, y: int, width: int, height: int) -> bool:
        if width < 3 or height < 3 or width > 12 or height > 12:
            return False
        for ix in range(x, x + width):
            top    = self._coord_key(addr_hex, ix, y)
            bottom = self._coord_key(addr_hex, ix, y + height - 1)
            if top    not in self.build_tiles or self.build_tiles[top]    != "WOOD_WALL":
                return False
            if bottom not in self.build_tiles or self.build_tiles[bottom] != "WOOD_WALL":
                return False
        for iy in range(y + 1, y + height - 1):
            left  = self._coord_key(addr_hex, x,             iy)
            right = self._coord_key(addr_hex, x + width - 1, iy)
            if left  not in self.build_tiles or self.build_tiles[left]  != "WOOD_WALL":
                return False
            if right not in self.build_tiles or self.build_tiles[right] != "WOOD_WALL":
                return False
        floor_count = 0
        for iy in range(y + 1, y + height - 1):
            for ix in range(x + 1, x + width - 1):
                key = self._coord_key(addr_hex, ix, iy)
                if key in self.build_tiles and self.build_tiles[key] == "WOOD_FLOOR":
                    floor_count += 1
        return floor_count > 0

    @gl.public.write
    def mint_house(self, x: int, y: int, width: int, height: int, name: str) -> u256:
        addr_hex = gl.message.sender_address.as_hex
        self._require_registered(addr_hex)
        assert self._is_house_shape(addr_hex, int(x), int(y), int(width), int(height)), "No complete on-chain house at coordinates"
        assert self._house_not_claimed(addr_hex, int(x), int(y), int(width), int(height)), "House footprint already minted"

        # Validate and deduct materials atomically — prevents minting without paying
        state = self._get_state(addr_hex)
        self._deduct_items(state, HOUSE_MATERIAL_COST, 1)

        house_id              = self.next_house_id
        self.next_house_id    = self.next_house_id + u256(1)
        meta = {
            "token_id":  int(house_id),
            "owner":     addr_hex,
            "x":         int(x),
            "y":         int(y),
            "width":     int(width),
            "height":    int(height),
            "name":      name if len(name) > 0 else "House",
            "quality":   1,
            "damaged":   False,
            "minted_at": self._now(),
        }
        self.houses[house_id] = json.dumps(meta, sort_keys=True)

        owned = json.loads(self.owner_houses[addr_hex]) if addr_hex in self.owner_houses else []
        owned.append(int(house_id))
        self.owner_houses[addr_hex] = json.dumps(owned, sort_keys=True)

        # Reuse the already-deducted state rather than fetching fresh (which would
        # undo the material deduction that happened above)
        state["house_count"] = len(owned)
        state["xp"]          = int(state.get("xp", 0)) + 50
        self._save_state(addr_hex, state)

        return house_id

    # ── AI world events ───────────────────────────────────────────────────────
    #
    # The LLM call and the state change happen in one transaction, which is the
    # entire reason this lives here rather than in a separate oracle contract.
    # An oracle can only recommend; a registry receiving a recommendation cannot
    # tell it apart from a player asking for free items. That is why the old
    # split silently discarded every positive delta - "good" events existed in
    # the UI and granted nothing. The contract now produces the event itself, so
    # it can act on the result, bounded by the caps in EVENT_GRANTABLE_ITEMS,
    # MAX_EVENT_ITEM_GRANT and MAX_EVENT_XP_DELTA.

    @gl.public.write
    def trigger_world_event(self) -> str:
        addr_hex = gl.message.sender_address.as_hex
        self._require_registered(addr_hex)
        now = self._now()

        assert self._in_window(now), "World events are closed right now - check back next epoch"
        assert self._calls_in_day(addr_hex, now) < MAX_CALLS_PER_DAY, \
            "Rate limit: " + str(MAX_CALLS_PER_DAY) + " world events per 24 hours"

        # ── Snapshot from storage, not from the caller ────────────────────────
        # These used to arrive as a client-authored JSON blob, so a player could
        # declare any inventory or house list they liked. Reading them here is
        # what makes the event's inputs as trustworthy as its output.
        #
        # Everything the nondet closure touches must be a plain Python value:
        # closing over storage objects across an equivalence-principle block is
        # not allowed.
        state = self._get_state(addr_hex)
        inventory_snapshot = {}
        for item, count in state.get("inventory", {}).items():
            inventory_snapshot[str(item)] = int(count)
        xp_snapshot    = int(state.get("xp", 0))
        days_snapshot  = int(state.get("days_survived", 0))
        owned_houses   = json.loads(self.owner_houses[addr_hex]) if addr_hex in self.owner_houses else []
        house_count    = len(owned_houses)
        epoch_num      = self._epoch(now)

        stats_snapshot = json.dumps({
            "xp":             xp_snapshot,
            "days_survived":  days_snapshot,
            "inventory":      inventory_snapshot,
            "house_count":    house_count,
            "epoch_number":   epoch_num,
        }, sort_keys=True)

        grantable = ", ".join(EVENT_GRANTABLE_ITEMS)

        def fetch_event_context() -> str:
            # Compact headlines only - smaller responses vary less between
            # validators, which keeps the equivalence check stable.
            news_texts = []
            for url in NEWS_SOURCES:
                try:
                    response = gl.nondet.web.get(url)
                    body = response.body.decode("utf-8", errors="replace")
                    titles = re.findall(r"<title>(.*?)</title>", body, re.DOTALL)
                    snippet = " | ".join(t.strip() for t in titles[1:8])
                    news_texts.append(snippet[:500])
                except Exception:
                    news_texts.append("(unavailable)")

            return json.dumps({
                "current_real_world_news": " || ".join(news_texts),
                "player_game_state": json.loads(stats_snapshot),
            }, sort_keys=True)

        task = """
You are the game master for GenSurvival, a survival game.
Read the real-world news headlines and the player's game state, then decide what
happens in their world this epoch.

Decision rules:
1. News of disaster, conflict or crisis leans disaster.
2. News of peace, science, cooperation or abundance leans good.
3. Mixed or neutral news leans neutral with small effects.
4. Players with low xp and few days survived get gentler negative events.
5. House damage is only allowed if house_count is at least 1.
6. Item removals must not exceed what the inventory actually shows.
7. Item grants may only use these items: """ + grantable + """
8. No single item grant may exceed """ + str(MAX_EVENT_ITEM_GRANT) + """, and at most """ + str(MAX_EVENT_ITEM_TYPES) + """ item types.
9. xp_delta must be between -""" + str(MAX_EVENT_XP_DELTA) + """ and """ + str(MAX_EVENT_XP_DELTA) + """.

Return only valid JSON. No markdown. No text outside the JSON.
event_type must be exactly one of "disaster", "good", "neutral".
Use exactly this shape:
{
  "event_type": "disaster",
  "event_name": "string",
  "description": "string",
  "health_delta": 0,
  "energy_delta": 0,
  "xp_delta": 0,
  "inventory_delta": {},
  "house_damaged": false,
  "house_quality_delta": 0,
  "reasoning": "string"
}
health_delta and energy_delta are flavour applied in the client only, each
between -2 and 2. They are deliberately not given to you as input.
"""

        criteria = """
The answer must be valid JSON only, with no markdown.
It must contain event_type, event_name, description, health_delta, energy_delta,
xp_delta, inventory_delta, house_damaged, house_quality_delta and reasoning.
health_delta and energy_delta must each be between -2 and 2.
event_type must be exactly one of disaster, good or neutral.
inventory_delta must be an object whose values are integers.
Positive inventory_delta keys must come from this list: """ + grantable + """
If house_count is 0 then house_damaged must be false and house_quality_delta 0.
Negative inventory_delta values must be plausible given the inventory shown.
The event must follow from the headlines and the player's state.
"""

        result_json = gl.eq_principle.prompt_non_comparative(
            fetch_event_context,
            task=task,
            criteria=criteria,
        )

        # ── Everything below runs after the equivalence block returns ─────────
        result_json = result_json.strip()
        if result_json.startswith("```"):
            result_json = result_json.replace("```json", "").replace("```", "").strip()

        parsed = json.loads(result_json)
        for field in ("event_type", "event_name", "description", "inventory_delta"):
            assert field in parsed, "AI event missing " + field

        event_type = str(parsed["event_type"])
        assert event_type in ("disaster", "good", "neutral"), \
            "Invalid event_type: must be disaster, good or neutral"

        # ── Clamp, then apply ────────────────────────────────────────────────
        state = self._get_state(addr_hex)
        inventory = state.get("inventory", {})
        safe_delta: dict = {}
        granted_types = 0

        for item, delta in parsed["inventory_delta"].items():
            item_id = str(item)
            amount = int(delta)
            if amount < 0:
                have = int(inventory.get(item_id, 0))
                if have > 0:
                    safe_delta[item_id] = -min(have, abs(amount))
            elif amount > 0:
                if item_id not in EVENT_GRANTABLE_ITEMS:
                    continue
                if granted_types >= MAX_EVENT_ITEM_TYPES:
                    continue
                granted_types += 1
                safe_delta[item_id] = min(amount, MAX_EVENT_ITEM_GRANT)

        self._apply_inventory_delta(state, safe_delta)

        xp_delta = int(parsed.get("xp_delta", 0))
        xp_delta = max(-MAX_EVENT_XP_DELTA, min(MAX_EVENT_XP_DELTA, xp_delta))
        state["xp"] = max(0, int(state.get("xp", 0)) + xp_delta)

        # ── House damage, targeted on-chain ──────────────────────────────────
        damaged_house = -1
        house_damaged = bool(parsed.get("house_damaged", False)) and house_count > 0
        if house_damaged:
            damaged_house = self._pick_event_house(addr_hex)
            if damaged_house >= 0:
                hid = u256(damaged_house)
                meta = json.loads(self.houses[hid])
                quality_delta = min(int(parsed.get("house_quality_delta", 0)), 0)
                meta["quality"]    = max(1, min(5, int(meta.get("quality", 1)) + quality_delta))
                meta["damaged"]    = True
                meta["updated_at"] = now
                self.houses[hid]   = json.dumps(meta, sort_keys=True)
            else:
                house_damaged = False

        self._save_state(addr_hex, state)
        self._record_call(addr_hex, now)

        # Clamped for the client's benefit; the chain stores neither.
        parsed["health_delta"] = max(-2, min(2, int(parsed.get("health_delta", 0))))
        parsed["energy_delta"] = max(-2, min(2, int(parsed.get("energy_delta", 0))))

        parsed["inventory_delta"] = safe_delta
        parsed["xp_delta"]        = xp_delta
        parsed["house_damaged"]   = house_damaged
        parsed["damaged_house_id"] = damaged_house
        parsed["inventory"]       = state["inventory"]
        parsed["xp"]              = state["xp"]
        parsed["score"]           = state["score"]
        parsed["epoch"]           = epoch_num

        self.last_event[addr_hex] = json.dumps(parsed, sort_keys=True)
        return self.last_event[addr_hex]

    @gl.public.view
    def get_last_event(self, address: str) -> str:
        return self.last_event[address] if address in self.last_event else ""

    @gl.public.view
    def get_call_count_today(self, address: str) -> int:
        return self._calls_in_day(address, self._now())

    @gl.public.view
    def get_epoch_info(self) -> str:
        now = self._now()
        epoch = self._epoch(now)
        epoch_start = epoch * EPOCH_DURATION
        next_start = (epoch + 1) * EPOCH_DURATION
        in_window = self._in_window(now)
        return json.dumps({
            "current_epoch":             epoch,
            "epoch_start":               epoch_start,
            "window_end":                epoch_start + CALL_WINDOW,
            "next_epoch_start":          next_start,
            "in_window":                 in_window,
            "seconds_until_next_window": 0 if in_window else next_start - now,
        }, sort_keys=True)

    # ── Views ─────────────────────────────────────────────────────────────────

    @gl.public.view
    def get_profile(self, address: str) -> str:
        return self.players[address] if address in self.players else ""

    @gl.public.view
    def get_player_state(self, address: str) -> str:
        return self.player_states[address] if address in self.player_states else ""

    @gl.public.view
    def get_build_tile(self, address: str, x: int, y: int) -> str:
        key = self._coord_key(address, int(x), int(y))
        return self.build_tiles[key] if key in self.build_tiles else ""

    @gl.public.view
    def get_house(self, house_id: int) -> str:
        hid = u256(int(house_id))
        return self.houses[hid] if hid in self.houses else ""

    @gl.public.view
    def get_houses_of(self, address: str) -> str:
        return self.owner_houses[address] if address in self.owner_houses else "[]"

    @gl.public.view
    def get_terrain_at(self, x: int, y: int) -> str:
        return self._terrain_at(0, int(x), int(y))

    @gl.public.view
    def is_registered(self, address: str) -> bool:
        return address in self.players

    @gl.public.view
    def get_registered_at(self, address: str) -> str:
        return str(self.registered_at[address]) if address in self.registered_at else "0"

    @gl.public.view
    def get_player_count(self) -> int:
        return len(self.player_addresses)

    @gl.public.view
    def get_all_players_json(self, offset: int, limit: int) -> str:
        """Registered players [offset, offset + limit). Page with get_player_count()."""
        assert 1 <= int(limit) <= 200, "Limit must be 1-200"
        total = len(self.player_addresses)
        end = min(total, int(offset) + int(limit))
        result = []
        for i in range(int(offset), end):
            addr_hex = self.player_addresses[i]
            result.append({
                "address":      addr_hex,
                "profile":      self.players[addr_hex] if addr_hex in self.players else "",
                "registered_at": str(self.registered_at[addr_hex]) if addr_hex in self.registered_at else "0",
            })
        return json.dumps(result, sort_keys=True)

    @gl.public.view
    def get_leaderboard(self) -> str:
        """The maintained top-N, already score-ordered.

        Reads one storage entry instead of loading and sorting every player, so
        the cost no longer grows with the player count. It also no longer calls
        _default_state, which reads gl.message_raw["datetime"] - unavailable in
        some view contexts and a latent failure for any player with a profile
        but no saved state.
        """
        return self.leaderboard_top["data"] if "data" in self.leaderboard_top else "[]"

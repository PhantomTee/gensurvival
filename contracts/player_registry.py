# { "Depends": "py-genlayer:test" }
#
# GenSurvivalGame — main game contract.
# Previously called PlayerRegistry; renamed because this contract now handles
# registration, state, mining, chopping, fishing, crafting, build tiles,
# house minting, house state, and leaderboard in one canonical place.
# The frontend addresses.ts still references it as PLAYER_REGISTRY (address-based,
# not class-name-based) so the rename has no effect on deployed ABI.

from genlayer import *
import json


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
    # House deed — special: triggers mint_house flow on client after crafting
    "house_deed": {
        "inputs": {"WOOD_PLANK": 40, "STONE": 30, "WOOD_WALL": 16, "WOOD_FLOOR": 16, "IRON_INGOT": 8, "COAL": 5},
        "output": "HOUSE_DEED", "output_count": 1, "station": "BENCH",
    },
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

    # AI event replay protection
    # Keys: "addr:event_id:inventory"  or  "addr:event_id:house"
    used_ai_events: TreeMap[str, bool]

    def __init__(self) -> None:
        self.next_house_id = u256(1)

    # ── Internal helpers ──────────────────────────────────────────────────────

    def _coord_key(self, addr_hex: str, x: int, y: int) -> str:
        return addr_hex + ":" + str(x) + ":" + str(y)

    def _hash(self, seed: int, x: int, y: int, salt: int) -> int:
        v = seed + x * 374761393 + y * 668265263 + salt * 1442695041
        if v < 0:
            v = -v
        v = (v ^ (v // 1274126177)) * 1274126177
        if v < 0:
            v = -v
        return v % 10000

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
        cx, cy = 256 + 40, 256 + 8
        dx, dy = x - cx, y - cy
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
            "updated_at":    int(gl.message.timestamp),
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
        state["updated_at"] = int(gl.message.timestamp)
        self.player_states[addr_hex] = json.dumps(state, sort_keys=True)

        profile = json.loads(self.players[addr_hex])
        profile["name"]        = state.get("name", profile.get("name", ""))
        profile["house_count"] = int(state.get("house_count", 0))
        profile["score"]       = state["score"]
        profile["address"]     = addr_hex
        if "registered_at" not in profile:
            profile["registered_at"] = int(self.registered_at[addr_hex])
        self.players[addr_hex] = json.dumps(profile, sort_keys=True)

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

    # ── Registration ──────────────────────────────────────────────────────────

    @gl.public.write
    def register(self, player_name: str) -> None:
        addr_hex = gl.message.sender_address.as_hex
        assert len(player_name) > 0, "Player name cannot be empty"
        assert addr_hex not in self.players, "Already registered"

        timestamp = u256(int(gl.message.timestamp))
        profile = {
            "address":      addr_hex,
            "name":         player_name,
            "house_count":  0,
            "score":        0,
            "registered_at": int(gl.message.timestamp),
        }
        state = self._default_state(addr_hex, player_name)
        self.players[addr_hex]       = json.dumps(profile, sort_keys=True)
        self.player_states[addr_hex] = json.dumps(state, sort_keys=True)
        self.registered_at[addr_hex] = timestamp
        self.player_addresses.append(addr_hex)

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
        state = self._get_state(addr_hex)
        if int(day_number) > int(state.get("days_survived", 0)):
            state["days_survived"] = int(day_number)
            self._save_state(addr_hex, state)
        return self.player_states[addr_hex]

    # ── World actions ─────────────────────────────────────────────────────────

    @gl.public.write
    def mine_tile(self, x: int, y: int, terrain_type: str) -> str:
        # terrain_type is supplied by the client (the client's WorldGenerator is
        # authoritative for tile layout since it uses simplex-noise which cannot
        # be reproduced cheaply on-chain). We validate it's a known mineable type.
        addr_hex = gl.message.sender_address.as_hex
        self._require_registered(addr_hex)
        key = self._coord_key(addr_hex, int(x), int(y))
        assert key not in self.mined_tiles, "Tile already mined"
        assert terrain_type in MINEABLE_DROPS, "Tile is not mineable"

        drop  = MINEABLE_DROPS[terrain_type]
        state = self._get_state(addr_hex)
        grant = {drop: 1}
        self._grant_items(state, grant)
        state["xp"] = int(state.get("xp", 0)) + 1
        self.mined_tiles[key] = True
        self._save_state(addr_hex, state)

        return json.dumps({"deduct": {}, "grant": grant, "inventory": state["inventory"], "xp": state["xp"], "score": state["score"]}, sort_keys=True)

    @gl.public.write
    def chop_tree(self, x: int, y: int) -> str:
        # Tree presence is validated client-side (simplex-noise world cannot be
        # reproduced on-chain). The contract enforces one-chop-per-coordinate only.
        addr_hex = gl.message.sender_address.as_hex
        self._require_registered(addr_hex)
        key = self._coord_key(addr_hex, int(x), int(y))
        assert key not in self.chopped_trees, "Tree already chopped"

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
            "minted_at": int(gl.message.timestamp),
        }
        self.houses[house_id] = json.dumps(meta, sort_keys=True)

        owned = json.loads(self.owner_houses[addr_hex]) if addr_hex in self.owner_houses else []
        owned.append(int(house_id))
        self.owner_houses[addr_hex] = json.dumps(owned, sort_keys=True)

        state = self._get_state(addr_hex)
        state["house_count"] = len(owned)
        state["xp"]          = int(state.get("xp", 0)) + 50
        self._save_state(addr_hex, state)

        return house_id

    # ── AI event application (disaster effects only) ──────────────────────────
    #
    # SAFETY MODEL
    # ─────────────
    # apply_inventory_delta  — player-callable; only applies losses (negative
    #   deltas). Positive rewards are silently ignored. XP can only decrease,
    #   never go below 0. Each event_id may be used exactly once per player.
    #
    # apply_house_event — player-callable; only applies negative disaster
    #   effects. quality_delta is clamped to ≤ 0 (houses cannot be improved
    #   through this path). damaged can only be set to True, never cleared.
    #   Each event_id may be used exactly once per house.
    #
    # Positive rewards (inventory grants, house repair, XP bonuses) must come
    # through an oracle-authenticated route — not yet implemented but reserved.

    @gl.public.write
    def apply_inventory_delta(self, event_id: str, delta_json: str, xp_delta: int) -> str:
        addr_hex = gl.message.sender_address.as_hex
        self._require_registered(addr_hex)
        assert len(event_id) > 0, "Event id cannot be empty"

        # ── Replay protection ────────────────────────────────────────────────
        used_key = addr_hex + ":" + event_id + ":inventory"
        assert used_key not in self.used_ai_events, "Event already applied to inventory"

        incoming = json.loads(delta_json)
        assert isinstance(incoming, dict), "Delta must be an object"

        state     = self._get_state(addr_hex)
        inventory = state.get("inventory", {})
        safe_delta: dict = {}

        for item, amount in incoming.items():
            numeric = int(amount)
            if numeric < 0:
                # Clamp loss to what the player actually owns — never go negative
                have = int(inventory.get(item, 0))
                if have > 0:
                    safe_delta[item] = -min(have, abs(numeric))
            # Positive amounts are silently ignored (oracle-only path, not yet live)

        self._apply_inventory_delta(state, safe_delta)

        # XP: only losses, cannot go below 0
        clamped_xp = min(int(xp_delta), 0)
        state["xp"] = max(0, int(state.get("xp", 0)) + clamped_xp)

        self._save_state(addr_hex, state)
        self.used_ai_events[used_key] = True

        return json.dumps({
            "applied_delta": safe_delta,
            "inventory":     state["inventory"],
            "xp":            state["xp"],
            "score":         state["score"],
        }, sort_keys=True)

    @gl.public.write
    def apply_house_event(self, house_id: int, damaged: bool, quality_delta: int, event_id: str) -> None:
        addr_hex = gl.message.sender_address.as_hex
        hid      = u256(int(house_id))
        assert hid in self.houses, "House does not exist"
        assert len(event_id) > 0, "Event id cannot be empty"

        meta = json.loads(self.houses[hid])
        # Case-insensitive owner check (GenLayer may return mixed-case addresses)
        assert meta["owner"].lower() == addr_hex.lower(), "Only the house owner can update its state"

        # ── Replay protection ────────────────────────────────────────────────
        used_key = addr_hex + ":" + event_id + ":house"
        assert used_key not in self.used_ai_events, "Event already applied to this house"

        # ── Disaster-only constraints ────────────────────────────────────────
        # quality_delta must be ≤ 0: houses can degrade but not improve via this path
        clamped_delta = min(int(quality_delta), 0)
        # damaged can only be set to True; once damaged it stays damaged until
        # a future oracle-authenticated repair path (not yet implemented)
        safe_damaged = meta.get("damaged", False) or bool(damaged)

        quality = int(meta.get("quality", 1)) + clamped_delta
        quality = max(1, min(5, quality))

        meta["damaged"]       = safe_damaged
        meta["quality"]       = quality
        meta["last_event_id"] = event_id
        meta["updated_at"]    = int(gl.message.timestamp)
        self.houses[hid]      = json.dumps(meta, sort_keys=True)
        self.used_ai_events[used_key] = True

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
    def get_all_players_json(self) -> str:
        result = []
        for addr_hex in self.player_addresses:
            result.append({
                "address":      addr_hex,
                "profile":      self.players[addr_hex] if addr_hex in self.players else "",
                "registered_at": str(self.registered_at[addr_hex]) if addr_hex in self.registered_at else "0",
            })
        return json.dumps(result, sort_keys=True)

    @gl.public.view
    def get_leaderboard(self) -> str:
        entries = []
        for addr_hex in self.player_addresses:
            state = json.loads(self.player_states[addr_hex]) if addr_hex in self.player_states else self._default_state(addr_hex, "")
            entries.append({
                "address": addr_hex,
                "score":   int(state["score"]) if "score" in state else self._score(state),
                "name":    state.get("name", ""),
            })
        entries.sort(key=lambda e: e["score"], reverse=True)
        return json.dumps(entries[:100], sort_keys=True)

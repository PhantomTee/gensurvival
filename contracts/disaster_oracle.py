# { "Depends": "py-genlayer:test" }

from genlayer import *
from datetime import datetime, timezone
import json
import re


EPOCH_DURATION = 6 * 3600
CALL_WINDOW = 1 * 3600
MAX_CALLS_PER_DAY = 4
DAY_SECONDS = 24 * 3600

NEWS_SOURCES = [
    "https://www.bbc.com/news",
    "https://www.reuters.com",
    "https://apnews.com",
]


class DisasterOracle(gl.Contract):
    epoch_stats: TreeMap[str, str]  # address_hex -> "epoch_num:stats_json"
    call_log: TreeMap[str, str]     # address_hex -> JSON array of timestamps
    last_event: TreeMap[str, str]   # address_hex -> last AI event JSON

    def __init__(self) -> None:
        pass

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
        epoch_start = self._epoch(ts) * EPOCH_DURATION
        return (ts - epoch_start) < CALL_WINDOW

    def _calls_in_day(self, addr_hex: str, now: int) -> int:
        if addr_hex in self.call_log:
            calls = json.loads(self.call_log[addr_hex])
        else:
            calls = []

        cutoff = now - DAY_SECONDS
        count = 0

        for timestamp in calls:
            if timestamp > cutoff:
                count += 1

        return count

    def _record_call(self, addr_hex: str, now: int) -> None:
        if addr_hex in self.call_log:
            calls = json.loads(self.call_log[addr_hex])
        else:
            calls = []

        cutoff = now - DAY_SECONDS
        filtered = []

        for timestamp in calls:
            if timestamp > cutoff:
                filtered.append(timestamp)

        filtered.append(now)

        self.call_log[addr_hex] = json.dumps(filtered, sort_keys=True)

    def _is_first_call_this_epoch(self, addr_hex: str, epoch: int) -> bool:
        if addr_hex not in self.epoch_stats:
            return True

        raw = self.epoch_stats[addr_hex]
        stored_epoch = int(raw.split(":", 1)[0])

        return stored_epoch != epoch

    @gl.public.write
    def submit_player_stats(self, stats_json: str) -> str:
        addr_hex = gl.message.sender_address.as_hex
        now = self._now()

        assert len(stats_json) > 0, "Stats JSON cannot be empty"
        json.loads(stats_json)

        assert self._in_window(now), "Not in submission window"
        assert self._calls_in_day(addr_hex, now) < MAX_CALLS_PER_DAY, "Rate limit: max 4 submissions per 24 hours reached"

        epoch = self._epoch(now)
        first_call = self._is_first_call_this_epoch(addr_hex, epoch)

        if first_call:
            self.epoch_stats[addr_hex] = str(epoch) + ":" + stats_json
            effective_stats = stats_json
        else:
            raw = self.epoch_stats[addr_hex]
            first_json = raw.split(":", 1)[1]

            first_stats = json.loads(first_json)
            delta_stats = json.loads(stats_json)

            first_stats.update(delta_stats)

            effective_stats = json.dumps(first_stats, sort_keys=True)

        self._record_call(addr_hex, now)

        # Capture values for the closure — no storage access allowed inside compute_event
        player_stats_snapshot = effective_stats
        epoch_num = epoch

        def fetch_event_context() -> str:
            # Fetch compact RSS/text headlines only — smaller responses improve
            # equivalence stability (less variance in what each validator sees).
            news_texts = []
            rss_sources = [
                "https://feeds.bbci.co.uk/news/rss.xml",
                "https://feeds.reuters.com/reuters/topNews",
                "https://apnews.com/rss",
            ]
            for url in rss_sources:
                try:
                    response = gl.nondet.web.get(url)
                    body = response.body.decode("utf-8", errors="replace")
                    # Extract only title/description tags — ~500 chars per source
                    titles = re.findall(r'<title>(.*?)</title>', body, re.DOTALL)
                    snippet = " | ".join(t.strip() for t in titles[1:8])  # skip feed title
                    news_texts.append(snippet[:500])
                except Exception:
                    news_texts.append("(unavailable)")

            combined_news = " || ".join(news_texts)
            stats = json.loads(player_stats_snapshot)

            return json.dumps({
                "current_real_world_news": combined_news,
                "player_game_state": {
                    "health": stats.get("health", 0),
                    "max_health": stats.get("max_health", 3.0),
                    "energy": stats.get("energy", 0),
                    "max_energy": stats.get("max_energy", 10.0),
                    "xp": stats.get("xp", 0),
                    "days_survived": stats.get("days_survived", 0),
                    "zombies_killed": stats.get("zombies_killed", 0),
                    "resources_gathered": stats.get("resources_gathered", 0),
                    "inventory": stats.get("inventory", {}),
                    "house_token_ids": stats.get("house_token_ids", []),
                    "epoch_number": epoch_num,
                },
            }, sort_keys=True)

        task = """
You are an AI game master for a survival game called GenSurvival.
Use the provided real-world news headlines together with the player's game state.
Decide what kind of event occurs in their game world.

Decision rules:
1. News themes of disaster, conflict, war, crisis, catastrophe should lean disaster.
2. News themes of peace, science, cooperation, abundance, celebration should lean good.
3. Mixed or neutral news should lean neutral with small effects.
4. Weak players should receive gentler negative events.
5. Strong players can receive harsher disasters or bigger rewards.
6. House damage can only happen if the player owns at least one house.
7. Resource removals must be realistic and must not remove more than the inventory shown.

Return only valid JSON. No markdown. No explanation outside the JSON.
Allowed values for event_type: "disaster", "good", "neutral".
The JSON must use exactly this shape:
{
  "event_type": "disaster",
  "event_name": "string",
  "description": "string",
  "health_delta": 0,
  "energy_delta": 0,
  "xp_delta": 0,
  "inventory_delta": {},
  "house_damaged": false,
  "house_damage_amount": 0,
  "house_quality_delta": 0,
  "reasoning": "string"
}
"""

        criteria = """
The answer must be valid JSON only, with no markdown.
It must contain event_type, event_name, description, health_delta, energy_delta,
xp_delta, inventory_delta, house_damaged, house_damage_amount,
house_quality_delta, and reasoning.
event_type must be exactly one of disaster, good, or neutral.
inventory_delta must be a JSON object whose values are integers.
If the player owns no houses, house_damaged must be false and house damage fields must be zero.
Negative inventory_delta values must be plausible from the provided inventory.
The event must be consistent with the provided headlines and player state.
"""

        # GenLayer docs require nondeterministic web/LLM work to be reachable
        # through an equivalence-principle block. prompt_non_comparative lets the
        # leader produce the game-master JSON while validators judge it against
        # the same fetched context and criteria.
        result_json = gl.eq_principle.prompt_non_comparative(
            fetch_event_context,
            task=task,
            criteria=criteria,
        )

        result_json = result_json.strip()
        if result_json.startswith("```"):
            result_json = result_json.replace("```json", "")
            result_json = result_json.replace("```", "")
            result_json = result_json.strip()

        # All storage writes happen after the equivalence-principle block returns.
        parsed = json.loads(result_json)

        assert "event_type" in parsed, "AI event missing event_type"
        assert "event_name" in parsed, "AI event missing event_name"
        assert "description" in parsed, "AI event missing description"
        assert "inventory_delta" in parsed, "AI event missing inventory_delta"

        event_type = parsed["event_type"]
        assert event_type in ("disaster", "good", "neutral"), "Invalid event_type: must be disaster, good, or neutral"

        # Clamp inventory deltas: removals capped to what the player actually has
        stats_for_clamp = json.loads(player_stats_snapshot)
        inventory_for_clamp = stats_for_clamp.get("inventory", {})
        safe_inventory_delta = {}
        for item, delta in parsed["inventory_delta"].items():
            numeric_delta = int(delta)
            if numeric_delta < 0:
                have = inventory_for_clamp.get(item, 0)
                if have > 0:
                    safe_inventory_delta[item] = -min(have, abs(numeric_delta))
            elif numeric_delta > 0:
                safe_inventory_delta[item] = numeric_delta

        parsed["inventory_delta"] = safe_inventory_delta

        # House damage only valid if player actually owns houses
        house_token_ids = stats_for_clamp.get("house_token_ids", [])
        if parsed.get("house_damaged") and len(house_token_ids) == 0:
            parsed["house_damaged"] = False
            parsed["house_damage_amount"] = 0
            parsed["house_quality_delta"] = 0

        self.last_event[addr_hex] = json.dumps(parsed, sort_keys=True)

        return self.last_event[addr_hex]

    @gl.public.view
    def get_last_event(self, address: str) -> str:
        if address in self.last_event:
            return self.last_event[address]

        return ""

    @gl.public.view
    def get_epoch_info(self) -> str:
        now = self._now()
        epoch = self._epoch(now)
        epoch_start = epoch * EPOCH_DURATION
        window_end = epoch_start + CALL_WINDOW
        next_start = (epoch + 1) * EPOCH_DURATION
        in_window = self._in_window(now)

        seconds_until_next_window = 0
        if not in_window:
            seconds_until_next_window = next_start - now

        return json.dumps({
            "current_epoch": epoch,
            "epoch_start": epoch_start,
            "window_end": window_end,
            "next_epoch_start": next_start,
            "in_window": in_window,
            "seconds_until_next_window": seconds_until_next_window,
        }, sort_keys=True)

    @gl.public.view
    def get_call_count_today(self, address: str) -> int:
        now = self._now()
        return self._calls_in_day(address, now)

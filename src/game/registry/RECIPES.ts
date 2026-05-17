import type { ItemId } from './ITEMS'

export type StationType = 'HAND' | 'BENCH' | 'FURNACE'

export interface RecipeDef {
  id: string
  output: ItemId
  outputCount: number
  inputs: Partial<Record<ItemId, number>>
  station: StationType
}

// ─── All 13 GenSurvival recipes (ported from Game/Registry/RECIPIES.cs) ──────
export const RECIPES: RecipeDef[] = [
  // Hand-crafted (no station needed)
  { id:'wood_plank',   output:'WOOD_PLANK',   outputCount:4, inputs:{ WOOD_LOG:1 },                         station:'HAND' },
  { id:'wood_stick',   output:'WOOD_STICK',   outputCount:4, inputs:{ WOOD_PLANK:1 },                       station:'HAND' },
  { id:'torch',        output:'TORCH',         outputCount:4, inputs:{ WOOD_STICK:1, COAL:1 },               station:'HAND' },
  { id:'wood_wall',    output:'WOOD_WALL',     outputCount:1, inputs:{ WOOD_PLANK:4 },                       station:'HAND' },
  { id:'wood_floor',   output:'WOOD_FLOOR',    outputCount:1, inputs:{ WOOD_PLANK:2 },                       station:'HAND' },
  { id:'bench',        output:'BENCH',         outputCount:1, inputs:{ WOOD_PLANK:8 },                       station:'HAND' },
  { id:'wood_sword',   output:'WOOD_SWORD',    outputCount:1, inputs:{ WOOD_PLANK:3, WOOD_STICK:2 },           station:'HAND' },
  { id:'wood_axe',     output:'WOOD_AXE',      outputCount:1, inputs:{ WOOD_PLANK:3, WOOD_STICK:2 },           station:'HAND' },
  { id:'wood_pickaxe', output:'WOOD_PICKAXE',  outputCount:1, inputs:{ WOOD_PLANK:3, WOOD_STICK:2 },           station:'HAND' },
  { id:'fishing_rod',  output:'FISHING_ROD',   outputCount:1, inputs:{ WOOD_STICK:3, WOOD_PLANK:1 },         station:'HAND' },
  { id:'bread',        output:'BREAD',         outputCount:2, inputs:{ WHEAT:3 },                             station:'HAND' },

  // Bench-crafted
  { id:'chest',        output:'CHEST',         outputCount:1, inputs:{ WOOD_PLANK:8 },                       station:'BENCH' },
  { id:'furnace',      output:'FURNACE',       outputCount:1, inputs:{ STONE:8 },                             station:'BENCH' },
  { id:'lantern',      output:'LANTERN',       outputCount:1, inputs:{ TORCH:4, STONE:4 },                   station:'BENCH' },
  { id:'iron_sword',   output:'IRON_SWORD',    outputCount:1, inputs:{ IRON_INGOT:4, WOOD_STICK:2 },         station:'BENCH' },
  { id:'iron_pickaxe', output:'IRON_PICKAXE',  outputCount:1, inputs:{ IRON_INGOT:3, WOOD_STICK:2 },         station:'BENCH' },
  { id:'iron_axe',     output:'IRON_AXE',      outputCount:1, inputs:{ IRON_INGOT:3, WOOD_STICK:2 },         station:'BENCH' },
  { id:'tnt_craft',    output:'TNT',           outputCount:1, inputs:{ COAL:3, STONE:4 },                    station:'BENCH' },
  { id:'bed',          output:'BED',           outputCount:1, inputs:{ WOOD_PLANK:6 },                       station:'BENCH' },
  { id:'bullet',       output:'BULLET',        outputCount:10,inputs:{ IRON_INGOT:1, COAL:2 },               station:'BENCH' },
  { id:'pistol',       output:'PISTOL',        outputCount:1, inputs:{ IRON_INGOT:4, WOOD_STICK:2, COAL:2 }, station:'BENCH' },
  { id:'rifle',        output:'RIFLE',         outputCount:1, inputs:{ IRON_INGOT:6, WOOD_STICK:3, COAL:3 }, station:'BENCH' },

  // Furnace-crafted
  { id:'iron_ingot',   output:'IRON_INGOT',    outputCount:1, inputs:{ IRON_ORE:2, COAL:1 },                 station:'FURNACE' },
  { id:'cooked_meat',  output:'COOKED_MEAT',   outputCount:1, inputs:{ RAW_MEAT:1, COAL:1 },                 station:'FURNACE' },

  // ── House deed — triggers on-chain HouseNFT mint (not a regular inventory item) ──
  // Requires full material progression: logs → planks → walls + stone + iron
  {
    id: 'house_deed',
    output: 'HOUSE_DEED',
    outputCount: 1,
    inputs: {
      WOOD_PLANK:  40,
      STONE:       30,
      WOOD_WALL:   16,
      WOOD_FLOOR:  16,
      IRON_INGOT:   8,
      COAL:         5,
    },
    station: 'BENCH',
  },
]

export const RECIPE_MAP: Record<string, RecipeDef> = Object.fromEntries(
  RECIPES.map(r => [r.id, r])
)

/** Returns all recipes available at a given station (HAND returns hand-crafted only) */
export function recipesForStation(station: StationType): RecipeDef[] {
  return RECIPES.filter(r => r.station === station)
}

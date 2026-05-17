export type TileId =
  | 'DIRT' | 'GRASS' | 'SAND' | 'WATER'
  | 'ROCK' | 'COAL_ORE' | 'IRON_ORE'
  | 'WOOD_FLOOR' | 'WOOD_WALL' | 'VOID'

export interface TileDef {
  id: TileId
  solid: boolean      // blocks movement
  breakable: boolean  // can be mined/broken
  dropItem?: string   // item dropped when broken
  tileIndex: number   // index into spritesheet row 0..N
  color: number       // minimap hex colour
}

export const TILES: Record<TileId, TileDef> = {
  VOID:       { id: 'VOID',       solid: true,  breakable: false,               tileIndex: 0, color: 0x000000 },
  WATER:      { id: 'WATER',      solid: true,  breakable: false,               tileIndex: 1, color: 0x4488cc },
  SAND:       { id: 'SAND',       solid: false, breakable: false,               tileIndex: 2, color: 0xddcc88 },
  DIRT:       { id: 'DIRT',       solid: false, breakable: false,               tileIndex: 3, color: 0x8b5e3c },
  GRASS:      { id: 'GRASS',      solid: false, breakable: false,               tileIndex: 4, color: 0x44aa44 },
  ROCK:       { id: 'ROCK',       solid: true,  breakable: true,  dropItem: 'STONE',     tileIndex: 5, color: 0x888888 },
  IRON_ORE:   { id: 'IRON_ORE',   solid: true,  breakable: true,  dropItem: 'IRON_ORE',  tileIndex: 6, color: 0xaaaacc },
  WOOD_FLOOR: { id: 'WOOD_FLOOR', solid: false, breakable: true,  dropItem: 'WOOD_PLANK',tileIndex: 7, color: 0xc4a35a },
  WOOD_WALL:  { id: 'WOOD_WALL',  solid: true,  breakable: true,  dropItem: 'WOOD_PLANK',tileIndex: 8, color: 0x8b6914 },
  COAL_ORE:   { id: 'COAL_ORE',   solid: true,  breakable: true,  dropItem: 'COAL',      tileIndex: 9, color: 0x262626 },
}

export const TILE_IDS = Object.keys(TILES) as TileId[]

/** Map from tileIndex → TileId for fast lookup */
export const TILE_BY_INDEX: TileId[] = TILE_IDS.sort(
  (a, b) => TILES[a].tileIndex - TILES[b].tileIndex
)

export type EntityType =
  | 'PLAYER'
  | 'ZOMBIE' | 'CHICKEN' | 'DOG' | 'FISH'
  | 'TREE' | 'FLOWER' | 'XP_ORB' | 'ITEM_ENTITY'
  | 'BENCH' | 'CHEST' | 'FURNACE' | 'TORCH' | 'LANTERN' | 'TNT' | 'BED'

export interface EntityDef {
  type: EntityType
  width: number        // collision box width in pixels
  height: number       // collision box height
  spriteKey: string    // Phaser texture key
  maxHealth?: number
  solid: boolean       // blocks player movement
  interactable: boolean
}

export const ENTITY_DEFS: Record<EntityType, EntityDef> = {
  PLAYER:      { type:'PLAYER',      width:4,  height:4,  spriteKey:'player',   maxHealth:3,  solid:false, interactable:false },
  ZOMBIE:      { type:'ZOMBIE',      width:6,  height:6,  spriteKey:'zombie',   maxHealth:3,  solid:false, interactable:false },
  CHICKEN:     { type:'CHICKEN',     width:4,  height:4,  spriteKey:'chicken',  maxHealth:1,  solid:false, interactable:false },
  DOG:         { type:'DOG',         width:5,  height:5,  spriteKey:'dog',      maxHealth:2,  solid:false, interactable:false },
  FISH:        { type:'FISH',        width:4,  height:4,  spriteKey:'fish',     maxHealth:1,  solid:false, interactable:false },
  TREE:        { type:'TREE',        width:10, height:10, spriteKey:'tree',     maxHealth:5,  solid:true,  interactable:true  },
  FLOWER:      { type:'FLOWER',      width:4,  height:4,  spriteKey:'flower',   maxHealth:1,  solid:false, interactable:true  },
  XP_ORB:      { type:'XP_ORB',      width:6,  height:6,  spriteKey:'xp_orb',  solid:false, interactable:false },
  ITEM_ENTITY: { type:'ITEM_ENTITY', width:8,  height:8,  spriteKey:'items',   solid:false, interactable:false },
  BENCH:       { type:'BENCH',       width:12, height:8,  spriteKey:'bench',    maxHealth:6,  solid:true,  interactable:true  },
  CHEST:       { type:'CHEST',       width:12, height:8,  spriteKey:'chest',    maxHealth:6,  solid:true,  interactable:true  },
  FURNACE:     { type:'FURNACE',     width:12, height:8,  spriteKey:'furnace',  maxHealth:8,  solid:true,  interactable:true  },
  TORCH:       { type:'TORCH',       width:4,  height:8,  spriteKey:'torch',    maxHealth:2,  solid:false, interactable:false },
  LANTERN:     { type:'LANTERN',     width:8,  height:8,  spriteKey:'lantern',  maxHealth:4,  solid:false, interactable:false },
  TNT:         { type:'TNT',         width:12, height:12, spriteKey:'tnt',      maxHealth:1,  solid:true,  interactable:false },
  BED:         { type:'BED',         width:16, height:12, spriteKey:'bench',    maxHealth:4,  solid:false, interactable:true  },
}

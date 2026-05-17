export type ItemId =
  // Raw resources
  | 'WOOD_LOG' | 'WOOD_PLANK' | 'WOOD_STICK'
  | 'STONE' | 'COAL' | 'IRON_ORE' | 'IRON_INGOT'
  // Placeables
  | 'WOOD_FLOOR' | 'WOOD_WALL' | 'TORCH' | 'LANTERN'
  | 'BENCH' | 'CHEST' | 'FURNACE' | 'TNT' | 'BED'
  // Tools
  | 'WOOD_SWORD' | 'WOOD_AXE' | 'WOOD_PICKAXE'
  | 'IRON_SWORD' | 'IRON_AXE' | 'IRON_PICKAXE' | 'IRON_SHOVEL' | 'IRON_HOE'
  | 'FISHING_ROD'
  // Ranged weapons + ammo
  | 'PISTOL' | 'RIFLE' | 'BULLET'
  // Food / misc
  | 'APPLE' | 'BREAD' | 'XP_ORB'
  | 'RAW_MEAT' | 'COOKED_MEAT' | 'FISH'
  | 'SEEDS' | 'WHEAT'
  // Special — triggers on-chain house minting when "crafted"
  | 'HOUSE_DEED'

export type ItemTag = 'WEAPON' | 'RANGED' | 'TOOL_AXE' | 'TOOL_PICK' | 'TOOL_SHOVEL' | 'TOOL_HOE' | 'TOOL_ROD' | 'PLACEABLE' | 'RESOURCE' | 'FOOD'

export interface GunStats {
  projectileSpeed: number  // px/s
  range: number            // max travel px
  ammoId: ItemId           // ammo item consumed per shot
  color: number            // projectile color (hex)
}

export interface ItemDef {
  id: ItemId
  displayName: string
  tags: ItemTag[]
  stackable: boolean
  maxStack: number
  damage?: number       // for weapons / tools (melee)
  miningPower?: number  // 1 = wood, 2 = iron
  placesTile?: string   // tile placed when used
  placesEntity?: string // entity spawned when used
  iconIndex: number     // column in items spritesheet
  healEnergy?: number   // energy restored when eaten (FOOD items)
  healHealth?: number   // health restored when eaten (FOOD items)
  gun?: GunStats        // ranged weapon stats
}

export const ITEMS: Record<ItemId, ItemDef> = {
  WOOD_LOG:      { id:'WOOD_LOG',      displayName:'Wood Log',      tags:['RESOURCE'],  stackable:true,  maxStack:64, iconIndex:0 },
  WOOD_PLANK:    { id:'WOOD_PLANK',    displayName:'Wood Plank',    tags:['RESOURCE'],  stackable:true,  maxStack:64, iconIndex:1 },
  WOOD_STICK:    { id:'WOOD_STICK',    displayName:'Wood Stick',    tags:['RESOURCE'],  stackable:true,  maxStack:64, iconIndex:2 },
  STONE:         { id:'STONE',         displayName:'Stone',         tags:['RESOURCE'],  stackable:true,  maxStack:64, iconIndex:3 },
  COAL:          { id:'COAL',          displayName:'Coal',          tags:['RESOURCE'],  stackable:true,  maxStack:64, iconIndex:4 },
  IRON_ORE:      { id:'IRON_ORE',      displayName:'Iron Ore',      tags:['RESOURCE'],  stackable:true,  maxStack:64, iconIndex:5 },
  IRON_INGOT:    { id:'IRON_INGOT',    displayName:'Iron Ingot',    tags:['RESOURCE'],  stackable:true,  maxStack:64, iconIndex:6 },

  WOOD_FLOOR:    { id:'WOOD_FLOOR',    displayName:'Wood Floor',    tags:['PLACEABLE'], stackable:true,  maxStack:32, placesTile:'WOOD_FLOOR', iconIndex:7 },
  WOOD_WALL:     { id:'WOOD_WALL',     displayName:'Wood Wall',     tags:['PLACEABLE'], stackable:true,  maxStack:32, placesTile:'WOOD_WALL',  iconIndex:8 },
  TORCH:         { id:'TORCH',         displayName:'Torch',         tags:['PLACEABLE'], stackable:true,  maxStack:32, placesEntity:'TORCH',    iconIndex:9 },
  LANTERN:       { id:'LANTERN',       displayName:'Lantern',       tags:['PLACEABLE'], stackable:true,  maxStack:16, placesEntity:'LANTERN',  iconIndex:10 },
  BENCH:         { id:'BENCH',         displayName:'Crafting Bench', tags:['PLACEABLE'], stackable:false, maxStack:1,  placesEntity:'BENCH',    iconIndex:11 },
  CHEST:         { id:'CHEST',         displayName:'Chest',         tags:['PLACEABLE'], stackable:false, maxStack:1,  placesEntity:'CHEST',    iconIndex:12 },
  FURNACE:       { id:'FURNACE',       displayName:'Furnace',       tags:['PLACEABLE'], stackable:false, maxStack:1,  placesEntity:'FURNACE',  iconIndex:13 },
  TNT:           { id:'TNT',           displayName:'TNT',           tags:['PLACEABLE'], stackable:true,  maxStack:8,  placesEntity:'TNT',      iconIndex:14 },

  WOOD_SWORD:    { id:'WOOD_SWORD',    displayName:'Wood Sword',    tags:['WEAPON'],    stackable:false, maxStack:1,  damage:1.0, iconIndex:15 },
  WOOD_AXE:      { id:'WOOD_AXE',      displayName:'Wood Axe',      tags:['TOOL_AXE'],  stackable:false, maxStack:1,  damage:0.5, miningPower:1, iconIndex:16 },
  WOOD_PICKAXE:  { id:'WOOD_PICKAXE',  displayName:'Wood Pickaxe',  tags:['TOOL_PICK'], stackable:false, maxStack:1,  damage:0.5, miningPower:1, iconIndex:17 },
  IRON_SWORD:    { id:'IRON_SWORD',    displayName:'Iron Sword',    tags:['WEAPON'],    stackable:false, maxStack:1,  damage:2.0, iconIndex:18 },
  IRON_AXE:      { id:'IRON_AXE',      displayName:'Iron Axe',      tags:['TOOL_AXE'],  stackable:false, maxStack:1,  damage:1.0, miningPower:2, iconIndex:19 },
  IRON_PICKAXE:  { id:'IRON_PICKAXE',  displayName:'Iron Pickaxe',  tags:['TOOL_PICK'], stackable:false, maxStack:1,  damage:1.0, miningPower:2, iconIndex:20 },
  IRON_SHOVEL:   { id:'IRON_SHOVEL',   displayName:'Iron Shovel',   tags:['TOOL_SHOVEL'],stackable:false, maxStack:1,  damage:0.5, miningPower:2, iconIndex:21 },
  IRON_HOE:      { id:'IRON_HOE',      displayName:'Iron Hoe',      tags:['TOOL_HOE'],  stackable:false, maxStack:1,  damage:0.5, iconIndex:22 },

  APPLE:         { id:'APPLE',         displayName:'Apple',         tags:['FOOD'],      stackable:true,  maxStack:16, iconIndex:23, healEnergy:2, healHealth:0.5 },
  BREAD:         { id:'BREAD',         displayName:'Bread',         tags:['FOOD'],      stackable:true,  maxStack:16, iconIndex:24, healEnergy:4, healHealth:0.3 },
  XP_ORB:        { id:'XP_ORB',        displayName:'XP Orb',        tags:['RESOURCE'],  stackable:true,  maxStack:64, iconIndex:25 },
  RAW_MEAT:      { id:'RAW_MEAT',      displayName:'Raw Meat',      tags:['FOOD'],      stackable:true,  maxStack:16, iconIndex:26, healEnergy:2, healHealth:0 },
  COOKED_MEAT:   { id:'COOKED_MEAT',   displayName:'Cooked Meat',   tags:['FOOD'],      stackable:true,  maxStack:16, iconIndex:27, healEnergy:5, healHealth:0.5 },
  FISH:          { id:'FISH',          displayName:'Fish',          tags:['FOOD'],      stackable:true,  maxStack:16, iconIndex:28, healEnergy:6, healHealth:1 },
  SEEDS:         { id:'SEEDS',         displayName:'Seeds',         tags:['RESOURCE'],  stackable:true,  maxStack:32, iconIndex:29 },
  WHEAT:         { id:'WHEAT',         displayName:'Wheat',         tags:['RESOURCE'],  stackable:true,  maxStack:32, iconIndex:30 },
  FISHING_ROD:   { id:'FISHING_ROD',   displayName:'Fishing Rod',   tags:['TOOL_ROD'],  stackable:false, maxStack:1,  iconIndex:31 },
  BED:           { id:'BED',           displayName:'Bed',           tags:['PLACEABLE'], stackable:false, maxStack:1,  placesEntity:'BED', iconIndex:32 },

  BULLET:  { id:'BULLET',  displayName:'Bullet',  tags:['RESOURCE'], stackable:true,  maxStack:64, iconIndex:33 },
  PISTOL:  { id:'PISTOL',  displayName:'Pistol',  tags:['WEAPON','RANGED'], stackable:false, maxStack:1, damage:1.5, iconIndex:34,
    gun:{ projectileSpeed:300, range:200, ammoId:'BULLET', color:0xffff44 } },
  RIFLE:   { id:'RIFLE',   displayName:'Rifle',   tags:['WEAPON','RANGED'], stackable:false, maxStack:1, damage:2.5, iconIndex:35,
    gun:{ projectileSpeed:420, range:360, ammoId:'BULLET', color:0xff8800 } },

  // Special: "crafting" this dispatches gensurvival:requestHouseMint and triggers
  // the HouseNFT on-chain mint — no inventory slot consumed.
  HOUSE_DEED:    { id:'HOUSE_DEED',    displayName:'Build House',   tags:['PLACEABLE'], stackable:false, maxStack:1,  iconIndex:11 },
}

export const ITEM_IDS = Object.keys(ITEMS) as ItemId[]

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
  /** One line shown on hover, so a name alone never has to explain itself. */
  description: string
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
  WOOD_LOG:      { id:'WOOD_LOG',      displayName:'Wood Log', description:'Chopped from trees. Split it into planks to build anything.',      tags:['RESOURCE'],  stackable:true,  maxStack:64, iconIndex:0 },
  WOOD_PLANK:    { id:'WOOD_PLANK',    displayName:'Wood Plank', description:'The base of most building. Four come from a single log.',    tags:['RESOURCE'],  stackable:true,  maxStack:64, iconIndex:1 },
  WOOD_STICK:    { id:'WOOD_STICK',    displayName:'Wood Stick', description:'Handles and hafts. Every tool needs a couple.',    tags:['RESOURCE'],  stackable:true,  maxStack:64, iconIndex:2 },
  STONE:         { id:'STONE',         displayName:'Stone', description:'Mined from rock. Furnaces and heavier work start here.',         tags:['RESOURCE'],  stackable:true,  maxStack:64, iconIndex:3 },
  COAL:          { id:'COAL',          displayName:'Coal', description:'Fuel. Smelting ore and lighting torches both burn it.',          tags:['RESOURCE'],  stackable:true,  maxStack:64, iconIndex:4 },
  IRON_ORE:      { id:'IRON_ORE',      displayName:'Iron Ore', description:'Raw ore. Useless until a furnace turns it into an ingot.',      tags:['RESOURCE'],  stackable:true,  maxStack:64, iconIndex:5 },
  IRON_INGOT:    { id:'IRON_INGOT',    displayName:'Iron Ingot', description:'Smelted iron. Better tools, weapons and a house deed.',    tags:['RESOURCE'],  stackable:true,  maxStack:64, iconIndex:6 },

  WOOD_FLOOR:    { id:'WOOD_FLOOR',    displayName:'Wood Floor', description:'Lay it inside four walls to make a room count as a house.',    tags:['PLACEABLE'], stackable:true,  maxStack:32, placesTile:'WOOD_FLOOR', iconIndex:7 },
  WOOD_WALL:     { id:'WOOD_WALL',     displayName:'Wood Wall', description:'The perimeter of anything you build. Houses are graded on shape.',     tags:['PLACEABLE'], stackable:true,  maxStack:32, placesTile:'WOOD_WALL',  iconIndex:8 },
  TORCH:         { id:'TORCH',         displayName:'Torch', description:'Cheap light. Night is dark and the dark is dangerous.',         tags:['PLACEABLE'], stackable:true,  maxStack:32, placesEntity:'TORCH',    iconIndex:9 },
  LANTERN:       { id:'LANTERN',       displayName:'Lantern', description:'Brighter and wider than a torch, and it does not gutter.',       tags:['PLACEABLE'], stackable:true,  maxStack:16, placesEntity:'LANTERN',  iconIndex:10 },
  BENCH:         { id:'BENCH',         displayName:'Crafting Bench', description:'Place it, stand near it, and the better recipes unlock.', tags:['PLACEABLE'], stackable:false, maxStack:1,  placesEntity:'BENCH',    iconIndex:11 },
  CHEST:         { id:'CHEST',         displayName:'Chest', description:'Storage you can leave behind and come back to.',         tags:['PLACEABLE'], stackable:false, maxStack:1,  placesEntity:'CHEST',    iconIndex:12 },
  FURNACE:       { id:'FURNACE',       displayName:'Furnace', description:'Smelts ore into ingots and cooks raw meat.',       tags:['PLACEABLE'], stackable:false, maxStack:1,  placesEntity:'FURNACE',  iconIndex:13 },
  TNT:           { id:'TNT',           displayName:'TNT', description:'Place, then run. Clears rock and anything else nearby.',           tags:['PLACEABLE'], stackable:true,  maxStack:8,  placesEntity:'TNT',      iconIndex:14 },

  WOOD_SWORD:    { id:'WOOD_SWORD',    displayName:'Wood Sword', description:'A first weapon. Slow, but better than fists.',    tags:['WEAPON'],    stackable:false, maxStack:1,  damage:1.0, iconIndex:15 },
  WOOD_AXE:      { id:'WOOD_AXE',      displayName:'Wood Axe', description:'Fells trees far faster than punching them.',      tags:['TOOL_AXE'],  stackable:false, maxStack:1,  damage:0.5, miningPower:1, iconIndex:16 },
  WOOD_PICKAXE:  { id:'WOOD_PICKAXE',  displayName:'Wood Pickaxe', description:'Breaks rock and coal. Too soft for iron.',  tags:['TOOL_PICK'], stackable:false, maxStack:1,  damage:0.5, miningPower:1, iconIndex:17 },
  IRON_SWORD:    { id:'IRON_SWORD',    displayName:'Iron Sword', description:'Twice the bite of wood. Zombies notice.',    tags:['WEAPON'],    stackable:false, maxStack:1,  damage:2.0, iconIndex:18 },
  IRON_AXE:      { id:'IRON_AXE',      displayName:'Iron Axe', description:'Strips a tree in a few swings.',      tags:['TOOL_AXE'],  stackable:false, maxStack:1,  damage:1.0, miningPower:2, iconIndex:19 },
  IRON_PICKAXE:  { id:'IRON_PICKAXE',  displayName:'Iron Pickaxe', description:'Cuts iron ore, which wood cannot touch.',  tags:['TOOL_PICK'], stackable:false, maxStack:1,  damage:1.0, miningPower:2, iconIndex:20 },
  IRON_SHOVEL:   { id:'IRON_SHOVEL',   displayName:'Iron Shovel', description:'Moves earth quickly.',   tags:['TOOL_SHOVEL'],stackable:false, maxStack:1,  damage:0.5, miningPower:2, iconIndex:21 },
  IRON_HOE:      { id:'IRON_HOE',      displayName:'Iron Hoe', description:'Turns ground for planting.',      tags:['TOOL_HOE'],  stackable:false, maxStack:1,  damage:0.5, iconIndex:22 },

  APPLE:         { id:'APPLE',         displayName:'Apple', description:'A small bite. Restores a little energy.',         tags:['FOOD'],      stackable:true,  maxStack:16, iconIndex:23, healEnergy:2, healHealth:0.5 },
  BREAD:         { id:'BREAD',         displayName:'Bread', description:'Baked from wheat. A proper meal.',         tags:['FOOD'],      stackable:true,  maxStack:16, iconIndex:24, healEnergy:4, healHealth:0.3 },
  XP_ORB:        { id:'XP_ORB',        displayName:'XP Orb', description:'Experience, loose in the world. Walk over it.',        tags:['RESOURCE'],  stackable:true,  maxStack:64, iconIndex:25 },
  RAW_MEAT:      { id:'RAW_MEAT',      displayName:'Raw Meat', description:'Edible, barely. Cook it in a furnace first.',      tags:['FOOD'],      stackable:true,  maxStack:16, iconIndex:26, healEnergy:2, healHealth:0 },
  COOKED_MEAT:   { id:'COOKED_MEAT',   displayName:'Cooked Meat', description:'Filling and safe. Worth the coal.',   tags:['FOOD'],      stackable:true,  maxStack:16, iconIndex:27, healEnergy:5, healHealth:0.5 },
  FISH:          { id:'FISH',          displayName:'Fish', description:'Pulled from the water with a rod. Good energy.',          tags:['FOOD'],      stackable:true,  maxStack:16, iconIndex:28, healEnergy:6, healHealth:1 },
  SEEDS:         { id:'SEEDS',         displayName:'Seeds', description:'Plant them and wait.',         tags:['RESOURCE'],  stackable:true,  maxStack:32, iconIndex:29 },
  WHEAT:         { id:'WHEAT',         displayName:'Wheat', description:'Three of these make bread.',         tags:['RESOURCE'],  stackable:true,  maxStack:32, iconIndex:30 },
  FISHING_ROD:   { id:'FISHING_ROD',   displayName:'Fishing Rod', description:'Equip it, stand by water and press K.',   tags:['TOOL_ROD'],  stackable:false, maxStack:1,  iconIndex:31 },
  BED:           { id:'BED',           displayName:'Bed', description:'A place to rest.',           tags:['PLACEABLE'], stackable:false, maxStack:1,  placesEntity:'BED', iconIndex:32 },

  BULLET:  { id:'BULLET',  displayName:'Bullet', description:'Ammunition. Useless without something to fire it.',  tags:['RESOURCE'], stackable:true,  maxStack:64, iconIndex:33 },
  PISTOL:  { id:'PISTOL',  displayName:'Pistol', description:'Ranged and quick, but it eats bullets.',  tags:['WEAPON','RANGED'], stackable:false, maxStack:1, damage:1.5, iconIndex:34,
    gun:{ projectileSpeed:300, range:200, ammoId:'BULLET', color:0xffff44 } },
  RIFLE:   { id:'RIFLE',   displayName:'Rifle', description:'Slower, harder hitting, longer reach.',   tags:['WEAPON','RANGED'], stackable:false, maxStack:1, damage:2.5, iconIndex:35,
    gun:{ projectileSpeed:420, range:360, ammoId:'BULLET', color:0xff8800 } },

  // Special: "crafting" this dispatches gensurvival:requestHouseMint and triggers
  // the HouseNFT on-chain mint — no inventory slot consumed.
  HOUSE_DEED:    { id:'HOUSE_DEED',    displayName:'Build House', description:'Claims what you built. An on-chain AI grades it and mints the NFT.',   tags:['PLACEABLE'], stackable:false, maxStack:1,  iconIndex:11 },
}

export const ITEM_IDS = Object.keys(ITEMS) as ItemId[]

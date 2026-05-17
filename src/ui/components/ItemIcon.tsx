import { useState } from 'react'
import type { ItemId } from '../../game/registry/ITEMS'
import { ITEMS } from '../../game/registry/ITEMS'

// Fallback colours for items that have no PNG asset.
// These match the procedural Phaser canvas textures in BootScene.
const FALLBACK: Partial<Record<ItemId, string>> = {
  IRON_INGOT:  '#b4b9d2',
  RAW_MEAT:    '#d23c37',
  COOKED_MEAT: '#82402a',
  FISH:        '#46c3dc',
  SEEDS:       '#9bd746',
  WHEAT:       '#f0cd3c',
  FISHING_ROD: '#b99b5a',
  BREAD:       '#d7af73',
  BED:         '#a0a5e6',
  BULLET:      '#4b4e58',
  PISTOL:      '#69707a',
  RIFLE:       '#555864',
  TORCH:       '#f08723',
  LANTERN:     '#f0dc4b',
  CHEST:       '#9b6937',
  FURNACE:     '#5f554e',
  HOUSE_DEED:  '#ebe0b2',
  COAL:        '#44434a',
  APPLE:       '#e0443a',
  XP_ORB:      '#88ddff',
  BENCH:       '#a0733a',
  TNT:         '#c03030',
}

// Some items exist in /assets/items/ under a different filename.
const CUSTOM_FILENAMES: Partial<Record<ItemId, string>> = {
  BENCH: 'bench_item',
  TNT:   'tnt_item',
}

interface Props {
  id: ItemId
  size?: number
  style?: React.CSSProperties
}

export function ItemIcon({ id, size = 28, style }: Props) {
  const [failed, setFailed] = useState(false)
  const fallback = FALLBACK[id]
  const label = ITEMS[id]?.displayName ?? id

  if (failed || !id) {
    if (fallback) {
      return (
        <div
          title={label}
          style={{
            width: size,
            height: size,
            background: fallback,
            borderRadius: 2,
            flexShrink: 0,
            ...style,
          }}
        />
      )
    }
    // Unknown item — grey square with first letter
    return (
      <div
        title={label}
        style={{
          width: size, height: size,
          background: '#444', borderRadius: 2,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: "'Press Start 2P', monospace", fontSize: size * 0.3,
          color: '#aaa', flexShrink: 0,
          ...style,
        }}
      >
        {label[0]}
      </div>
    )
  }

  const filename = CUSTOM_FILENAMES[id] ?? id.toLowerCase()

  return (
    <img
      src={`/assets/items/${filename}.png`}
      alt={label}
      title={label}
      style={{
        width: size, height: size,
        imageRendering: 'pixelated',
        objectFit: 'contain',
        flexShrink: 0,
        ...style,
      }}
      onError={() => setFailed(true)}
    />
  )
}

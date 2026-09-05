import React from 'react'
import { useGameStore } from '../store'
import { ITEMS } from '../../game/registry/ITEMS'
import type { ItemId } from '../../game/registry/ITEMS'
import { ItemIcon } from './ItemIcon'

const SLOT_SIZE = 52
const SLOTS = 5

export function Hotbar() {
  const stats = useGameStore((s) => s.playerStats)
  if (!stats) return null

  const { hotbar, hotbarIndex, inventory } = stats

  function selectSlot(i: number) {
    window.dispatchEvent(new CustomEvent('gensurvival:setHotbarSlot', { detail: { slot: i } }))
  }

  return (
    <div style={{
      position: 'absolute',
      bottom: 12,
      left: '50%',
      transform: 'translateX(-50%)',
      display: 'flex',
      gap: 4,
      pointerEvents: 'auto',
      userSelect: 'none',
    }}>
      {Array.from({ length: SLOTS }, (_, i) => {
        const itemId = hotbar[i] ?? null
        const itemDef = itemId ? ITEMS[itemId as ItemId] : null
        const count   = itemId ? (inventory[itemId] ?? 0) : 0
        const active  = i === hotbarIndex

        return (
          <div
            key={i}
            onClick={() => selectSlot(i)}
            title={itemDef
              ? `${itemDef.displayName}${count > 1 ? ` ×${count}` : ''}
${itemDef.description}`
              : `Slot ${i + 1} (empty)`}
            style={{
              width:  SLOT_SIZE,
              height: SLOT_SIZE,
              background: active
                ? 'linear-gradient(180deg,#2a1a00 0%,#150d00 100%)'
                : 'linear-gradient(180deg,#1a1000 0%,#0e0800 100%)',
              border: active ? '2px solid #f5c842' : '2px solid #5a3d10',
              borderRadius: 4,
              boxShadow: active
                ? '0 0 8px rgba(245,200,66,0.5), inset 0 1px 0 rgba(255,200,80,0.15)'
                : 'inset 0 1px 0 rgba(255,200,80,0.05)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 2,
              cursor: 'pointer',
              position: 'relative',
              transition: 'border-color 0.1s',
            }}
          >
            {/* Slot number */}
            <span style={{
              position: 'absolute', top: 2, left: 4,
              fontFamily: "'Press Start 2P', monospace", fontSize: 7,
              color: active ? '#f5c842' : '#5a3d10',
            }}>{i + 1}</span>

            {itemDef ? (
              <>
                <ItemIcon id={itemId as ItemId} size={28} />
                {/* Stack count */}
                {count > 1 && (
                  <span style={{
                    position: 'absolute', bottom: 2, right: 4,
                    fontFamily: "'Press Start 2P', monospace", fontSize: 8, fontWeight: 'bold',
                    color: '#f5c842',
                    textShadow: '1px 1px 0 #000',
                  }}>{count}</span>
                )}
                {/* Item type tag */}
                <span style={{
                  fontFamily: "'Press Start 2P', monospace", fontSize: 6,
                  color: active ? '#c8a060' : '#5a3d10',
                  textAlign: 'center',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  maxWidth: SLOT_SIZE - 8,
                  lineHeight: 1,
                }}>
                  {itemDef.displayName.split(' ').slice(-1)[0].toUpperCase()}
                </span>
              </>
            ) : (
              <span style={{ color: '#2a1a00', fontFamily: "'Press Start 2P', monospace", fontSize: 11 }}>·</span>
            )}
          </div>
        )
      })}
    </div>
  )
}

import React, { useState } from 'react'
import { useGameStore } from '../store'
import { ITEMS } from '../../game/registry/ITEMS'
import type { ItemId } from '../../game/registry/ITEMS'
import { ItemIcon } from './ItemIcon'

const RPG_PANEL: React.CSSProperties = {
  background: 'linear-gradient(180deg,#1c1008 0%,#110900 100%)',
  border: '2px solid #8b6914',
  borderRadius: 6,
  boxShadow: '3px 3px 0 #000, inset 0 1px 0 rgba(255,200,80,0.1)',
}

const EQUIPPABLE_TAGS = new Set(['WEAPON', 'RANGED', 'TOOL_AXE', 'TOOL_PICK', 'TOOL_SHOVEL', 'TOOL_HOE', 'TOOL_ROD', 'PLACEABLE', 'FOOD'])

function isEquippable(id: ItemId): boolean {
  const def = ITEMS[id]
  return def.tags.some(t => EQUIPPABLE_TAGS.has(t))
}

function tagColor(id: ItemId): string {
  const tags = ITEMS[id].tags
  if (tags.includes('RANGED')) return '#60a5fa'   // blue — gun
  if (tags.includes('WEAPON')) return '#f87171'   // red — melee
  if (tags.includes('TOOL_AXE') || tags.includes('TOOL_PICK') || tags.includes('TOOL_SHOVEL') || tags.includes('TOOL_HOE')) return '#fb923c'  // orange — tool
  if (tags.includes('PLACEABLE')) return '#a78bfa'  // purple — buildable
  if (tags.includes('FOOD')) return '#4ade80'      // green — food
  return '#a08040'  // default
}

export function InventoryPanel() {
  const open   = useGameStore((s) => s.inventoryOpen)
  const stats  = useGameStore((s) => s.playerStats)
  const toggle = useGameStore((s) => s.toggleInventory)
  const [tooltip, setTooltip] = useState<string | null>(null)

  if (!open || !stats) return null

  const entries = Object.entries(stats.inventory).filter(([, v]) => v > 0) as [ItemId, number][]
  const currentSlot = stats.hotbarIndex

  function equipItem(id: ItemId) {
    window.dispatchEvent(new CustomEvent('gensurvival:equipItem', { detail: { itemId: id } }))
  }

  return (
    <div style={{
      ...RPG_PANEL,
      position: 'absolute', top: '50%', left: '50%',
      transform: 'translate(-50%,-50%)',
      padding: 16, minWidth: 320, zIndex: 50,
    }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <span style={{
          color: '#f5c842', fontFamily: "'Press Start 2P', monospace", fontSize: 13, fontWeight: 'bold',
          letterSpacing: 2, textShadow: '0 0 8px rgba(245,200,66,0.4)',
        }}>📦 INVENTORY</span>
        <button onClick={toggle} style={{
          color: '#8b6914', background: 'none', border: 'none', cursor: 'pointer',
          fontFamily: "'Press Start 2P', monospace", fontSize: 16,
        }}>✕</button>
      </div>

      <div style={{ height: 1, background: 'linear-gradient(90deg,transparent,#8b6914,transparent)', marginBottom: 10 }} />

      {/* Active slot indicator */}
      <div style={{
        marginBottom: 8,
        fontFamily: "'Press Start 2P', monospace", fontSize: 8, color: '#8b6914',
        lineHeight: 1.6,
      }}>
        Click item → equip to slot {currentSlot + 1}
        {stats.hotbar[currentSlot] ? (
          <span style={{ color: '#f5c842' }}> ({ITEMS[stats.hotbar[currentSlot] as ItemId]?.displayName})</span>
        ) : (
          <span style={{ color: '#5a3d10' }}> (empty)</span>
        )}
      </div>

      {/* Tooltip */}
      {tooltip && (
        <div style={{
          marginBottom: 8, padding: '4px 8px',
          background: '#0e0700', border: '1px solid #8b6914', borderRadius: 3,
          fontFamily: "'Press Start 2P', monospace", fontSize: 8, color: '#f5c842',
          lineHeight: 1.5,
        }}>{tooltip}</div>
      )}

      {entries.length === 0 ? (
        <p style={{ color: '#6b5a30', fontFamily: "'Press Start 2P', monospace", fontSize: 9, textAlign: 'center', padding: '8px 0' }}>
          — empty —
        </p>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 6 }}>
          {entries.map(([id, count]) => {
            const def = ITEMS[id]
            const equippable = isEquippable(id)
            const isEquipped = stats.hotbar[currentSlot] === id
            const tc = tagColor(id)

            // Build tooltip text
            const tipParts: string[] = [def.displayName]
            if (def.damage)      tipParts.push(`DMG ${def.damage}`)
            if (def.gun)         tipParts.push(`RNG ${def.gun.range}px`)
            if (def.healEnergy)  tipParts.push(`+${def.healEnergy} energy`)
            if (def.healHealth)  tipParts.push(`+${def.healHealth} HP`)
            if (def.miningPower) tipParts.push(`Power ${def.miningPower}`)
            const statLine = tipParts.slice(1).join('  ·  ')
            const tipText = [def.displayName, def.description, statLine]
              .filter(Boolean).join('\n')

            return (
              <div
                key={id}
                title={tipText}
                onClick={() => equippable && equipItem(id)}
                onMouseEnter={() => setTooltip(tipText)}
                onMouseLeave={() => setTooltip(null)}
                style={{
                  background: isEquipped
                    ? 'linear-gradient(180deg,#2a1a00 0%,#150d00 100%)'
                    : 'linear-gradient(180deg,#1e1206 0%,#120a03 100%)',
                  border: isEquipped
                    ? `2px solid ${tc}`
                    : `1px solid #3a2500`,
                  borderRadius: 4,
                  padding: '6px 4px 4px',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
                  cursor: equippable ? 'pointer' : 'default',
                  boxShadow: isEquipped ? `0 0 6px ${tc}55` : 'none',
                  transition: 'border-color 0.1s, box-shadow 0.1s',
                  position: 'relative',
                }}
              >
                {/* Tag colour dot */}
                <div style={{
                  position: 'absolute', top: 3, right: 3,
                  width: 4, height: 4, borderRadius: '50%',
                  background: tc,
                  opacity: 0.8,
                }} />

                <ItemIcon id={id} size={26} />
                <span style={{ color: '#f5c842', fontFamily: "'Press Start 2P', monospace", fontSize: 9, fontWeight: 'bold' }}>
                  {count}
                </span>
                <span style={{
                  color: tc, fontFamily: "'Press Start 2P', monospace", fontSize: 7,
                  textAlign: 'center', lineHeight: 1.1, maxWidth: 52,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {def.displayName.split(' ').slice(-1)[0].toUpperCase()}
                </span>
              </div>
            )
          })}
        </div>
      )}

      {/* Legend */}
      <div style={{
        marginTop: 10, display: 'flex', gap: 8, flexWrap: 'wrap',
        fontFamily: "'Press Start 2P', monospace", fontSize: 7,
      }}>
        {[
          { color: '#f87171', label: 'Melee' },
          { color: '#60a5fa', label: 'Ranged' },
          { color: '#fb923c', label: 'Tool' },
          { color: '#a78bfa', label: 'Placeable' },
          { color: '#4ade80', label: 'Food' },
        ].map(({ color, label }) => (
          <span key={label} style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
            <span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: color }} />
            <span style={{ color: '#6b5a30' }}>{label}</span>
          </span>
        ))}
      </div>
    </div>
  )
}

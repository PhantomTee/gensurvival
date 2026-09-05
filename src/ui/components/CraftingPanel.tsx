import { useState } from 'react'
import { useGameStore } from '../store'
import { RECIPES, type RecipeDef } from '../../game/registry/RECIPES'
import { ITEMS, type ItemId } from '../../game/registry/ITEMS'
import { ItemIcon } from './ItemIcon'
import { useChainActions } from '../hooks/useChainActions'

export function CraftingPanel() {
  const open         = useGameStore((s) => s.craftingOpen)
  const station      = useGameStore((s) => s.craftingStation)
  const close        = useGameStore((s) => s.closeCrafting)
  const stats        = useGameStore((s) => s.playerStats)
  const txPending    = useGameStore((s) => s.txPending)
  const txStatus     = useGameStore((s) => s.txStatus)
  const walletAddr   = useGameStore((s) => s.walletAddress)
  const { doCraft, doCraftFreeform } = useChainActions()

  const [qty, setQty] = useState(1)
  const [improvising, setImprovising] = useState(false)
  const [intent, setIntent] = useState('')
  const [picked, setPicked] = useState<Record<string, number>>({})

  if (!open || !stats) return null

  const noWallet = !walletAddr

  const available = RECIPES.filter(r => r.station === station)

  function canCraft(r: RecipeDef): boolean {
    for (const [id, need] of Object.entries(r.inputs)) {
      if ((stats!.inventory[id] ?? 0) < (need ?? 0) * qty) return false
    }
    return true
  }

  const stationLabel = station === 'HAND' ? '⚒ CRAFTING' : station === 'BENCH' ? '🪵 BENCH' : '🔥 FURNACE'

  return (
    <div style={{
      position: 'absolute', top: '50%', left: '50%',
      transform: 'translate(-50%, -50%)',
      background: 'linear-gradient(180deg,#1c1008 0%,#110900 100%)',
      border: '2px solid #8b6914',
      borderRadius: 6,
      padding: '14px 16px',
      minWidth: 340,
      zIndex: 50,
      boxShadow: '4px 4px 0 #000, inset 0 1px 0 rgba(255,200,80,0.1)',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <span style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 13, fontWeight: 'bold', color: '#f5c842', letterSpacing: 1 }}>
          {stationLabel}
        </span>
        <button onClick={close} style={{
          color: '#8b6914', background: 'none', border: 'none', cursor: 'pointer',
          fontFamily: "'Press Start 2P', monospace", fontSize: 16, lineHeight: 1,
        }}>✕</button>
      </div>

      {/* Wallet warning */}
      {noWallet && (
        <div style={{
          background: '#1a0a00', border: '1px solid #c8860a', borderRadius: 3,
          padding: '6px 10px', marginBottom: 10,
          fontFamily: "'Press Start 2P', monospace", fontSize: 11, color: '#f5c842',
        }}>
          ⚠ Connect your wallet — crafting requires an on-chain transaction.
        </div>
      )}

      {/* Quantity selector */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
        <span style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 10, color: '#8b6914' }}>QTY:</span>
        {[1, 4, 8, 16].map(q => (
          <button key={q} onClick={() => setQty(q)} style={{
            padding: '2px 7px',
            fontFamily: "'Press Start 2P', monospace", fontSize: 11,
            background: qty === q ? '#2a1800' : 'transparent',
            border: `1px solid ${qty === q ? '#c8860a' : '#5a3d10'}`,
            color: qty === q ? '#f5c842' : '#8b6914',
            borderRadius: 2, cursor: 'pointer',
          }}>×{q}</button>
        ))}
      </div>

      {/* Recipe list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5, maxHeight: 300, overflowY: 'auto' }}>
        {available.map(r => {
          const craftable = canCraft(r)
          const outDef    = ITEMS[r.output]
          return (
            <div key={r.id}
              title={`${outDef.displayName} — ${outDef.description}`}
              style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '6px 8px',
              background: craftable ? 'rgba(30,18,4,0.9)' : 'rgba(15,8,0,0.7)',
              border: `1px solid ${craftable ? '#5a3d10' : '#2a1800'}`,
              borderRadius: 3,
              opacity: craftable ? 1 : 0.55,
            }}>
              {/* Output icon + count */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 48, flexShrink: 0 }}>
                <div style={{
                  width: 32, height: 32, background: '#0e0700',
                  border: '1px solid #3a2500', borderRadius: 2,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <ItemIcon id={r.output} size={24} />
                </div>
                <span style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 9, color: '#c8a060', marginTop: 2 }}>
                  {r.outputCount * qty}×
                </span>
              </div>

              {/* Name, description, then what it costs */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontFamily: "'Press Start 2P', monospace", fontSize: 10,
                  color: craftable ? '#f5c842' : '#8a7350', marginBottom: 2,
                }}>
                  {outDef.displayName}
                </div>
                <div style={{
                  fontFamily: 'monospace', fontSize: 10, color: '#8a7350',
                  marginBottom: 4, lineHeight: 1.35,
                }}>
                  {outDef.description}
                </div>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {Object.entries(r.inputs).map(([id, need]) => {
                  const have     = stats.inventory[id] ?? 0
                  const required = (need ?? 0) * qty
                  const ok       = have >= required
                  return (
                    <span key={id} style={{
                      fontFamily: "'Press Start 2P', monospace", fontSize: 10,
                      padding: '1px 5px', borderRadius: 2,
                      background: ok ? 'rgba(74,222,128,0.08)' : 'rgba(239,68,68,0.08)',
                      border: `1px solid ${ok ? '#166534' : '#7f1d1d'}`,
                      color: ok ? '#86efac' : '#fca5a5',
                    }}>
                      {ITEMS[id as keyof typeof ITEMS]?.displayName.split(' ')[0] ?? id} {have}/{required}
                    </span>
                  )
                })}
              </div>
              </div>

              {/* FORGE / BUILD button — house recipe gets special label */}
              <button
                disabled={!craftable || txPending || noWallet}
                onClick={() => doCraft(r.id, qty, station)}
                style={{
                  padding: '4px 10px',
                  fontFamily: "'Press Start 2P', monospace", fontSize: 8, fontWeight: 'bold',
                  background: craftable && !txPending && !noWallet
                    ? r.output === 'HOUSE_DEED'
                      ? 'linear-gradient(180deg,#001a3a 0%,#000f22 100%)'
                      : 'linear-gradient(180deg,#1a3a00 0%,#0a1f00 100%)'
                    : 'transparent',
                  border: `1px solid ${craftable && !txPending && !noWallet
                    ? r.output === 'HOUSE_DEED' ? '#60a5fa' : '#4ade80'
                    : '#2a3a00'}`,
                  color: craftable && !txPending && !noWallet
                    ? r.output === 'HOUSE_DEED' ? '#93c5fd' : '#86efac'
                    : '#3a5a20',
                  borderRadius: 2,
                  cursor: craftable && !txPending && !noWallet ? 'pointer' : 'not-allowed',
                  flexShrink: 0,
                  letterSpacing: 0.5,
                  whiteSpace: 'nowrap',
                }}
              >
                {r.output === 'HOUSE_DEED' ? '🏠 BUILD' : 'FORGE'}
              </button>
            </div>
          )
        })}
      </div>

      {/* ── Improvise: no recipe, the contract's AI rules on what you made ── */}
      <div style={{ marginTop: 12, borderTop: '1px solid #4a3410', paddingTop: 10 }}>
        <button
          onClick={() => setImprovising(v => !v)}
          disabled={noWallet || txPending}
          style={{
            width: '100%', padding: '6px 8px', cursor: noWallet ? 'not-allowed' : 'pointer',
            background: improvising ? 'rgba(200,134,10,0.18)' : 'rgba(30,18,0,0.6)',
            border: '1px solid #8b6914', borderRadius: 3, color: '#f5c842',
            fontFamily: "'Press Start 2P', monospace", fontSize: 10,
            opacity: noWallet ? 0.5 : 1,
          }}>
          {improvising ? '× CLOSE IMPROVISE' : '✦ IMPROVISE (no recipe)'}
        </button>

        {improvising && (
          <div style={{ marginTop: 8 }}>
            <p style={{
              fontFamily: 'monospace', fontSize: 10, color: '#b8935a',
              marginBottom: 6, lineHeight: 1.5,
            }}>
              Pick materials and say what you're trying to make. An on-chain AI decides
              what comes out — and materials are spent even when nothing does.
            </p>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 6 }}>
              {Object.entries(stats.inventory)
                .filter(([, n]) => n > 0)
                .map(([id, have]) => {
                  const take = picked[id] ?? 0
                  return (
                    <button
                      key={id}
                      onClick={() => setPicked(p => {
                        const next = { ...p }
                        const v = (next[id] ?? 0) + 1
                        if (v > have) delete next[id]
                        else next[id] = v
                        return next
                      })}
                      title={`${ITEMS[id as ItemId]?.displayName ?? id} — you have ${have}. Click to add, click past the max to clear.`}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 4,
                        padding: '3px 6px', cursor: 'pointer',
                        background: take > 0 ? 'rgba(74,222,128,0.15)' : 'rgba(0,0,0,0.35)',
                        border: `1px solid ${take > 0 ? '#4ade80' : '#5a4a2a'}`,
                        borderRadius: 3, color: take > 0 ? '#86efac' : '#c8b48a',
                        fontFamily: 'monospace', fontSize: 10,
                      }}>
                      <ItemIcon id={id as ItemId} size={14} />
                      {take > 0 ? `${take}/${have}` : have}
                    </button>
                  )
                })}
            </div>

            <input
              value={intent}
              onChange={(e) => setIntent(e.target.value)}
              onKeyDownCapture={(e) => e.stopPropagation()}
              onKeyUpCapture={(e) => e.stopPropagation()}
              maxLength={200}
              placeholder="What are you trying to make?"
              style={{
                width: '100%', padding: '5px 7px', marginBottom: 6,
                background: '#120b02', border: '1px solid #5a4a2a', borderRadius: 3,
                color: '#e8d5a0', fontFamily: 'monospace', fontSize: 11, outline: 'none',
              }}
            />

            <button
              disabled={txPending || Object.keys(picked).length === 0 || intent.trim().length === 0}
              onClick={async () => {
                await doCraftFreeform(picked, intent.trim())
                setPicked({})
                setIntent('')
              }}
              style={{
                width: '100%', padding: '6px 8px',
                cursor: Object.keys(picked).length && intent.trim() ? 'pointer' : 'not-allowed',
                background: 'rgba(74,222,128,0.12)', border: '1px solid #4ade80',
                borderRadius: 3, color: '#86efac',
                fontFamily: "'Press Start 2P', monospace", fontSize: 10,
                opacity: txPending || !Object.keys(picked).length || !intent.trim() ? 0.4 : 1,
              }}>
              ATTEMPT IT
            </button>
          </div>
        )}
      </div>

      {txPending && (
        <div style={{
          marginTop: 10, padding: '4px 8px',
          background: 'rgba(30,18,0,0.9)', border: '1px solid #c8860a', borderRadius: 3,
          fontFamily: "'Press Start 2P', monospace", fontSize: 11, color: '#f5c842', textAlign: 'center',
        }}>
          ⏳ {txStatus}
        </div>
      )}
    </div>
  )
}

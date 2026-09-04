import { useState } from 'react'
import { useGameStore } from '../store'
import { useChainActions } from '../hooks/useChainActions'
import { HOUSE_COST } from '../../game/constants'
import { ITEMS } from '../../game/registry/ITEMS'
import type { ItemId } from '../../game/registry/ITEMS'

const EMPTY_INVENTORY: Record<string, number> = {}

export function HouseMintModal() {
  const prompt      = useGameStore((s) => s.houseMintPrompt)
  const dismiss     = useGameStore((s) => s.dismissHouseMint)
  const txPending   = useGameStore((s) => s.txPending)
  const txStatus    = useGameStore((s) => s.txStatus)
  // Always use the live inventory from playerStats — the prompt snapshot can be
  // stale if the player crafted materials after the modal opened.
  const liveInv     = useGameStore((s) => s.playerStats?.inventory ?? EMPTY_INVENTORY)
  const { doMintHouse } = useChainActions()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')

  if (!prompt) return null

  // Merge: live inventory takes precedence over the snapshot baked into prompt
  const inventory = { ...prompt.inventory, ...liveInv }

  return (
    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50
                    bg-gray-950 border border-yellow-600 rounded-xl shadow-2xl p-5 max-w-sm w-full">
      <h2 className="text-yellow-300 font-mono font-bold text-base mb-2">🏠 Mint House NFT?</h2>
      <p className="text-gray-400 text-xs font-mono mb-4 leading-relaxed">
        You've built a {prompt.widthTiles}×{prompt.heightTiles} structure. Minting
        sends your actual placed tiles to the contract, where an on-chain AI grades
        what you really built — from HOVEL to KEEP, quality 1 to 5. The grade sets
        the NFT's rarity and your xp reward.
      </p>

      <div className="mb-4 space-y-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDownCapture={(e) => e.stopPropagation()}
          onKeyUpCapture={(e) => e.stopPropagation()}
          maxLength={40}
          placeholder="Name it — e.g. Stormwatch"
          className="w-full bg-gray-900 border border-gray-700 rounded px-2 py-1
                     text-gray-200 text-xs font-mono focus:border-yellow-600 outline-none"
        />
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          onKeyDownCapture={(e) => e.stopPropagation()}
          onKeyUpCapture={(e) => e.stopPropagation()}
          maxLength={280}
          rows={2}
          placeholder="Describe it. The judge reads your layout, not your claim — overselling an empty box scores 1/5."
          className="w-full bg-gray-900 border border-gray-700 rounded px-2 py-1
                     text-gray-200 text-xs font-mono resize-none focus:border-yellow-600 outline-none"
        />
      </div>

      <div className="mb-4">
        <p className="text-gray-300 text-xs font-mono mb-1">Materials required:</p>
        <div className="flex gap-3 flex-wrap">
          {Object.entries(HOUSE_COST).map(([id, need]) => {
            const have = inventory[id] ?? 0
            const ok   = have >= need
            return (
              <span key={id} className={`text-xs font-mono px-2 py-1 rounded border
                ${ok ? 'border-green-600 text-green-300' : 'border-red-600 text-red-300'}`}>
                {ITEMS[id as ItemId]?.displayName}: {have}/{need}
              </span>
            )
          })}
        </div>
      </div>

      {txPending ? (
        <p className="text-yellow-300 text-xs font-mono animate-pulse text-center">{txStatus}</p>
      ) : (
        <div className="flex gap-2">
          <button
            onClick={() => doMintHouse({ ...prompt, name, description })}
            className="flex-1 py-2 rounded border border-yellow-600 text-yellow-300
                       font-mono text-xs hover:bg-yellow-900/40 transition-colors">
            MINT &amp; GRADE
          </button>
          <button
            onClick={dismiss}
            className="flex-1 py-2 rounded border border-gray-600 text-gray-400
                       font-mono text-xs hover:border-gray-400 hover:text-white transition-colors">
            CANCEL
          </button>
        </div>
      )}
    </div>
  )
}

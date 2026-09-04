/**
 * Deployed contract address on GenLayer Studionet.
 *
 * DisasterOracle was folded into GenSurvivalGame: an oracle could only
 * recommend an event, and the registry receiving that recommendation had no way
 * to tell it from a player asking for free items, so every positive reward was
 * discarded. One contract generates and applies the event in one transaction.
 */
export const ADDRESSES = {
  PLAYER_REGISTRY: '0x5025426a0B9e9071ade0E7314b3B065460d5f6Fe',
} as const

/**
 * Deployed contract address on GenLayer Studionet.
 *
 * DisasterOracle was folded into GenSurvivalGame: an oracle could only
 * recommend an event, and the registry receiving that recommendation had no way
 * to tell it from a player asking for free items, so every positive reward was
 * discarded. One contract generates and applies the event in one transaction.
 */
export const ADDRESSES = {
  PLAYER_REGISTRY: '0x3347cFA181a571d57E59C83AcBc8Ff4599D832d9',
} as const

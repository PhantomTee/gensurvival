/**
 * Deployed contract address on GenLayer Studionet.
 *
 * DisasterOracle was folded into GenSurvivalGame: an oracle could only
 * recommend an event, and the registry receiving that recommendation had no way
 * to tell it from a player asking for free items, so every positive reward was
 * discarded. One contract generates and applies the event in one transaction.
 */
export const ADDRESSES = {
  PLAYER_REGISTRY: '0x44F828e569cB0593247c65EE781ED6757736507A',
} as const

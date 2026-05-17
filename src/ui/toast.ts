import { useGameStore } from './store'

export const toast = {
  success: (message: string) => useGameStore.getState().addToast(message, 'success'),
  error: (message: string) => useGameStore.getState().addToast(message, 'error'),
  info: (message: string) => useGameStore.getState().addToast(message, 'info'),
}

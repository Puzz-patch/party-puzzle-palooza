import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { createGameSessionSlice, GameSessionSlice, initialGameSessionState } from './slices/game-session-slice';
import { createGameSetupSlice, GameSetupSlice, initialGameSetupState } from './slices/game-setup-slice';
import { createUISlice, UIStoreSlice, initialUIState } from './slices/ui-slice';
import { createRealtimeSlice, RealtimeSlice, initialRealtimeState } from './slices/realtime-slice';

export type GameStore = GameSessionSlice & GameSetupSlice & UIStoreSlice & RealtimeSlice;

const initialState = {
  ...initialGameSessionState,
  ...initialGameSetupState,
  ...initialUIState,
  ...initialRealtimeState,
};

export const useGameStore = create<GameStore>()(
  subscribeWithSelector((set, get) => ({
    ...createGameSessionSlice(set, get),
    ...createGameSetupSlice(set, get),
    ...createUISlice(set),
    ...createRealtimeSlice(set, get),
    reset: () => set(initialState),
  }))
);

// Selectors for better performance
export const useGame = () => useGameStore((state) => state.game);
export const useGameLoading = () => useGameStore((state) => state.isLoading);
export const useGameError = () => useGameStore((state) => state.error);
export const useSelectedQuestions = () => useGameStore((state) => state.selectedQuestions);
export const useIsLocked = () => useGameStore((state) => state.isLocked);
export const useGamePlayers = () => useGameStore((state) => state.game?.players || []);
export const useGameQuestions = () => useGameStore((state) => state.game?.queuedQuestions || []);
export const useGameFlags = () => useGameStore((state) => state.game?.flags);
export const useCurrentState = () => useGameStore((state) => state.game?.currentState);
export const useArchivedPrompts = () => useGameStore((state) => state.archivedPrompts);
export const useResponderData = () => useGameStore((state) => state.responderData);
export const useFinaleResult = () => useGameStore((state) => state.finaleResult); 
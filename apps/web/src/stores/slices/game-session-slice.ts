import { StateCreator } from 'zustand';
import type { GameState } from '../types';
import { GamePatch } from '@party-puzzle-palooza/shared';

export interface GameSessionState {
  game: GameState | null;
}

export interface GameSessionActions {
  setGame: (game: GameState) => void;
  updateGame: (updates: Partial<GameState>) => void;
  applyPatch: (patch: GamePatch) => void;
  reset: () => void;
}

export type GameSessionSlice = GameSessionState & GameSessionActions;

export const initialGameSessionState: GameSessionState = {
  game: null,
};

export const createGameSessionSlice = (
  set: Parameters<StateCreator<GameSessionSlice>>[0],
  get: Parameters<StateCreator<GameSessionSlice>>[1]
) => ({
  ...initialGameSessionState,
  setGame: (game: GameState) => set({ game }),

  updateGame: (updates: Partial<GameState>) =>
    set((state: GameSessionSlice) => ({
      game: state.game ? { ...state.game, ...updates } : null,
    })),

  applyPatch: (patch: GamePatch) => {
    const { game } = get();
    if (!game) return;

    // Apply different types of patches
    switch (patch.type) {
      case 'state_transition':
        set((state: GameSessionSlice) => ({
          game: state.game
            ? {
                ...state.game,
                currentState: patch.data.toState as GameState['currentState'],
                status:
                  patch.data.toState === 'game_finished'
                    ? 'finished'
                    : patch.data.toState === 'cancelled'
                    ? 'cancelled'
                    : 'playing',
              }
            : null,
        }));
        break;

      case 'custom_question_added':
        set((state: GameSessionSlice) => ({
          game: state.game
            ? {
                ...state.game,
                queuedQuestions: [...state.game.queuedQuestions, patch.data.question as GameState['queuedQuestions'][0]],
              }
            : null,
        }));
        break;

      case 'player_joined':
        set((state: GameSessionSlice) => ({
          game: state.game
            ? {
                ...state.game,
                players: [...state.game.players, patch.data.player as GameState['players'][0]],
                currentPlayers: state.game.currentPlayers + 1,
              }
            : null,
        }));
        break;

      case 'player_left':
        set((state: GameSessionSlice) => ({
          game: state.game
            ? {
                ...state.game,
                players: state.game.players.filter((p) => p.id !== patch.data.playerId),
                currentPlayers: state.game.currentPlayers - 1,
              }
            : null,
        }));
        break;

      case 'question_selected':
        get().selectQuestion(patch.data.questionId as string);
        break;

      case 'question_deselected':
        get().deselectQuestion(patch.data.questionId as string);
        break;

      case 'question_flagged':
        set((state: GameSessionSlice) => ({
          game: state.game
            ? {
                ...state.game,
                queuedQuestions: state.game.queuedQuestions.map((q) =>
                  q.id === patch.data.questionId
                    ? {
                        ...q,
                        flagCount: patch.data.flagCount as number,
                        isFlagged: patch.data.isFlagged as boolean,
                        isHidden: patch.data.isHidden as boolean,
                      }
                    : q
                ),
              }
            : null,
        }));
        break;

      case 'question_hidden':
        set((state: GameSessionSlice) => ({
          game: state.game
            ? {
                ...state.game,
                queuedQuestions: state.game.queuedQuestions.map((q) =>
                  q.id === patch.data.questionId ? { ...q, isHidden: true } : q
                ),
              }
            : null,
        }));
        break;

      default:
        console.warn('Unknown patch type:', patch.type);
    }
  },
}); 
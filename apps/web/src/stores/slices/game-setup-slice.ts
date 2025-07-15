import { StateCreator } from 'zustand';
import type { GameQuestion } from '../types';

export interface GameSetupState {
  selectedQuestions: string[];
  customQuestions: GameQuestion[];
  isLocked: boolean;
}

export interface GameSetupActions {
  selectQuestion: (questionId: string) => void;
  deselectQuestion: (questionId: string) => void;
  clearSelectedQuestions: () => void;
  addCustomQuestion: (question: GameQuestion) => void;
  removeCustomQuestion: (questionId: string) => void;
  lockQuestions: () => void;
  unlockQuestions: () => void;
  loadQuestions: () => void;
}

export type GameSetupSlice = GameSetupState & GameSetupActions;

export const initialGameSetupState: GameSetupState = {
  selectedQuestions: [],
  customQuestions: [],
  isLocked: false,
};

export const createGameSetupSlice = (
  set: Parameters<StateCreator<GameSetupSlice>>[0],
  get: Parameters<StateCreator<GameSetupSlice>>[1]
) => ({
  ...initialGameSetupState,
  selectQuestion: (questionId: string) =>
    set((state: GameSetupSlice) => ({
      selectedQuestions: [...state.selectedQuestions, questionId],
    })),

  deselectQuestion: (questionId: string) =>
    set((state: GameSetupSlice) => ({
      selectedQuestions: state.selectedQuestions.filter((id) => id !== questionId),
    })),

  clearSelectedQuestions: () => set({ selectedQuestions: [] }),

  addCustomQuestion: (question: GameQuestion) =>
    set((state: GameSetupSlice) => ({
      customQuestions: [...state.customQuestions, question],
    })),

  removeCustomQuestion: (questionId: string) =>
    set((state: GameSetupSlice) => ({
      customQuestions: state.customQuestions.filter((q) => q.id !== questionId),
    })),

  lockQuestions: () => set({ isLocked: true }),

  unlockQuestions: () => set({ isLocked: false }),

  loadQuestions: () => {
    const { selectedQuestions, customQuestions } = get();
    // This would typically send a WebSocket message to load the selected questions
    console.log('Loading questions:', { selectedQuestions, customQuestions });
    // Reset selections after loading
    set({ selectedQuestions: [], customQuestions: [], isLocked: false });
  },
}); 
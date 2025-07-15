import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';

export interface GamePlayer {
  id: string;
  username: string;
  firstName: string;
  lastName: string;
  avatarUrl?: string | null;
  score: number;
  correctAnswers: number;
  totalAnswers: number;
  isHost: boolean;
  isSpectator: boolean;
  joinedAt: Date;
}

export interface GameQuestion {
  id: string;
  question: string;
  type: 'would_you_rather' | 'trivia' | 'word_association' | 'drawing';
  options?: string[];
  correctAnswer?: string | null;
  category: string;
  roundNumber: number;
  status?: 'pending' | 'active' | 'finished';
  flagCount?: number;
  isFlagged?: boolean;
  isHidden?: boolean;
}

export interface GameFlags {
  isPrivate: boolean;
  hasPassword: boolean;
  isStarted: boolean;
  isFinished: boolean;
  isFull: boolean;
  chillMode: boolean;
}

export interface GameState {
  id: string;
  name: string;
  code: string;
  description?: string | null;
  status: 'waiting' | 'playing' | 'finished' | 'cancelled';
  type: 'would_you_rather' | 'trivia' | 'word_association' | 'drawing';
  maxPlayers: number;
  currentPlayers: number;
  roundsPerGame: number;
  timePerRound: number;
  players: GamePlayer[];
  queuedQuestions: GameQuestion[];
  flags: GameFlags;
  createdAt: Date;
  startedAt?: Date | null;
  finishedAt?: Date | null;
  currentState?: 'lobby' | 'question_build' | 'round_active' | 'round_results' | 'game_finished' | 'cancelled';
}

export interface GameStore {
  // State
  game: GameState | null;
  isLoading: boolean;
  error: string | null;
  selectedQuestions: string[]; // Question IDs selected for the game
  customQuestions: GameQuestion[]; // Questions written by players
  isLocked: boolean; // Whether questions are locked and ready to load
  
  // Actions
  setGame: (game: GameState) => void;
  updateGame: (updates: Partial<GameState>) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  
  // Question management
  selectQuestion: (questionId: string) => void;
  deselectQuestion: (questionId: string) => void;
  clearSelectedQuestions: () => void;
  addCustomQuestion: (question: GameQuestion) => void;
  removeCustomQuestion: (questionId: string) => void;
  
  // Game state
  lockQuestions: () => void;
  unlockQuestions: () => void;
  loadQuestions: () => void;
  
  // WebSocket patch handling
  applyPatch: (patch: any) => void;
  
  // Reset
  reset: () => void;
}

const initialState = {
  game: null,
  isLoading: false,
  error: null,
  selectedQuestions: [],
  customQuestions: [],
  isLocked: false,
};

export const useGameStore = create<GameStore>()(
  subscribeWithSelector((set, get) => ({
    ...initialState,

    setGame: (game) => set({ game }),
    
    updateGame: (updates) => set((state) => ({
      game: state.game ? { ...state.game, ...updates } : null
    })),
    
    setLoading: (isLoading) => set({ isLoading }),
    
    setError: (error) => set({ error }),
    
    selectQuestion: (questionId) => set((state) => ({
      selectedQuestions: [...state.selectedQuestions, questionId]
    })),
    
    deselectQuestion: (questionId) => set((state) => ({
      selectedQuestions: state.selectedQuestions.filter(id => id !== questionId)
    })),
    
    clearSelectedQuestions: () => set({ selectedQuestions: [] }),
    
    addCustomQuestion: (question) => set((state) => ({
      customQuestions: [...state.customQuestions, question]
    })),
    
    removeCustomQuestion: (questionId) => set((state) => ({
      customQuestions: state.customQuestions.filter(q => q.id !== questionId)
    })),
    
    lockQuestions: () => set({ isLocked: true }),
    
    unlockQuestions: () => set({ isLocked: false }),
    
    loadQuestions: () => {
      const { selectedQuestions, customQuestions, game } = get();
      // This would typically send a WebSocket message to load the selected questions
      console.log('Loading questions:', { selectedQuestions, customQuestions });
      // Reset selections after loading
      set({ selectedQuestions: [], customQuestions: [], isLocked: false });
    },
    
    applyPatch: (patch) => {
      const { game } = get();
      if (!game) return;
      
      // Apply different types of patches
      switch (patch.type) {
        case 'state_transition':
          set((state) => ({
            game: state.game ? {
              ...state.game,
              currentState: patch.data.toState,
              status: patch.data.toState === 'game_finished' ? 'finished' : 
                     patch.data.toState === 'cancelled' ? 'cancelled' : 'playing'
            } : null
          }));
          break;
          
        case 'custom_question_added':
          set((state) => ({
            game: state.game ? {
              ...state.game,
              queuedQuestions: [...state.game.queuedQuestions, patch.data.question]
            } : null
          }));
          break;
          
        case 'player_joined':
          set((state) => ({
            game: state.game ? {
              ...state.game,
              players: [...state.game.players, patch.data.player],
              currentPlayers: state.game.currentPlayers + 1
            } : null
          }));
          break;
          
        case 'player_left':
          set((state) => ({
            game: state.game ? {
              ...state.game,
              players: state.game.players.filter(p => p.id !== patch.data.playerId),
              currentPlayers: state.game.currentPlayers - 1
            } : null
          }));
          break;
          
        case 'question_selected':
          set((state) => ({
            selectedQuestions: [...state.selectedQuestions, patch.data.questionId]
          }));
          break;
          
        case 'question_deselected':
          set((state) => ({
            selectedQuestions: state.selectedQuestions.filter(id => id !== patch.data.questionId)
          }));
          break;
          
        case 'question_flagged':
          set((state) => ({
            game: state.game ? {
              ...state.game,
              queuedQuestions: state.game.queuedQuestions.map(q => 
                q.id === patch.data.questionId 
                  ? { 
                      ...q, 
                      flagCount: patch.data.flagCount,
                      isFlagged: patch.data.isFlagged,
                      isHidden: patch.data.isHidden
                    }
                  : q
              )
            } : null
          }));
          break;
          
        case 'question_hidden':
          set((state) => ({
            game: state.game ? {
              ...state.game,
              queuedQuestions: state.game.queuedQuestions.map(q => 
                q.id === patch.data.questionId 
                  ? { ...q, isHidden: true }
                  : q
              )
            } : null
          }));
          break;
          
        default:
          console.warn('Unknown patch type:', patch.type);
      }
    },
    
    reset: () => set(initialState),
  }))
);

// Selectors for better performance
export const useGame = () => useGameStore((state) => state.game);
export const useGameLoading = () => useGameStore((state) => state.isLoading);
export const useGameError = () => useGameStore((state) => state.error);
export const useSelectedQuestions = () => useGameStore((state) => state.selectedQuestions);
export const useCustomQuestions = () => useGameStore((state) => state.customQuestions);
export const useIsLocked = () => useGameStore((state) => state.isLocked);
export const useGamePlayers = () => useGameStore((state) => state.game?.players || []);
export const useGameQuestions = () => useGameStore((state) => state.game?.queuedQuestions || []);
export const useGameFlags = () => useGameStore((state) => state.game?.flags);
export const useCurrentState = () => useGameStore((state) => state.game?.currentState); 
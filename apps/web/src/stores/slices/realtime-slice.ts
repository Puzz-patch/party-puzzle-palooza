import { StateCreator } from 'zustand';

interface WebSocketMessage {
  type: string;
  data: unknown;
  timestamp: number;
}

interface ArchivedPrompt {
  id: string;
  roundId: string;
  roundNumber: number;
  question: string;
  options: string[];
  correctAnswer?: string;
  revealed: boolean;
  archivedAt: string;
  totalPlayers: number;
  respondedPlayers: number;
  winner?: string;
  winnerScore?: number;
}

interface ResponderData {
  responderId: string;
  responderName: string;
  responderAvatar?: string;
  phase: 'response' | 'reveal_gamble' | 'finished';
  responseStartTime: string;
  responseEndTime: string;
  countdownDuration: number;
  nextPhase: string;
}

interface PlayerFinalScore {
  playerId: string;
  username: string;
  firstName: string;
  lastName: string;
  finalScore: number;
  correctAnswers: number;
  totalAnswers: number;
  unusedPromptTokens: number;
  rank: number;
  stats: Record<string, unknown>;
}

interface GameFinaleResult {
  gameId: string;
  gameName: string;
  gameCode: string;
  totalRounds: number;
  deckUsagePercentage: number;
  deckUsageRequirementMet: boolean;
  winner?: PlayerFinalScore;
  playerScores: PlayerFinalScore[];
  totalUnusedPromptTokens: number;
  completedAt: string;
  gameStats: Record<string, unknown>;
}

export interface RealtimeState {
  archivedPrompts: ArchivedPrompt[];
  responderData: ResponderData | null;
  finaleResult: GameFinaleResult | null;
}

export interface RealtimeActions {
  handleRealtimeEvent: (event: WebSocketMessage) => void;
}

export type RealtimeSlice = RealtimeState & RealtimeActions;

export const initialRealtimeState: RealtimeState = {
  archivedPrompts: [],
  responderData: null,
  finaleResult: null,
};

export const createRealtimeSlice = (
  set: Parameters<StateCreator<RealtimeSlice>>[0],
  get: Parameters<StateCreator<RealtimeSlice>>[1]
) => ({
  ...initialRealtimeState,
  handleRealtimeEvent: (event: WebSocketMessage) => {
    const { type, data } = event;
    const state = get() as RealtimeSlice & { game?: { id: string } };
    const gameId = state.game?.id;

    if (data && typeof data === 'object' && 'gameId' in data && gameId !== data.gameId) {
      return;
    }

    switch (type) {
      case 'round_archived': {
        if (data && typeof data === 'object' && 'roundId' in data) {
          const newPrompt: ArchivedPrompt = {
            id: data.roundId as string,
            ...data as Omit<ArchivedPrompt, 'id'>,
          };
          set((state: RealtimeSlice) => ({
            archivedPrompts: [newPrompt, ...state.archivedPrompts],
          }));
        }
        break;
      }
      case 'round_revealed': {
        if (data && typeof data === 'object' && 'roundId' in data) {
          set((state: RealtimeSlice) => ({
            archivedPrompts: state.archivedPrompts.map((prompt) =>
              prompt.roundId === data.roundId ? { ...prompt, ...data as Partial<ArchivedPrompt> } : prompt
            ),
          }));
        }
        break;
      }
      case 'round_updated': {
        if (data && typeof data === 'object' && 'roundId' in data && 'respondedPlayers' in data && 'totalPlayers' in data) {
          set((state: RealtimeSlice) => ({
            archivedPrompts: state.archivedPrompts.map((prompt) =>
              prompt.roundId === data.roundId
                ? { ...prompt, respondedPlayers: data.respondedPlayers as number, totalPlayers: data.totalPlayers as number }
                : prompt
            ),
          }));
        }
        break;
      }
      case 'responder_selected': {
        if (data && typeof data === 'object') {
          set({ responderData: data as ResponderData });
        }
        break;
      }
      case 'phase_change': {
        if (data && typeof data === 'object' && 'phase' in data) {
          set((state: RealtimeSlice) => ({
            responderData: state.responderData ? { ...state.responderData, phase: data.phase as ResponderData['phase'] } : null,
          }));
        }
        break;
      }
      case 'game_finale': {
        if (data && typeof data === 'object') {
          set({ finaleResult: data as GameFinaleResult });
        }
        break;
      }
      default:
        break;
    }
  },
}); 
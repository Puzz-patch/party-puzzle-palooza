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
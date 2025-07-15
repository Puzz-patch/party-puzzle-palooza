import { z } from 'zod';

// Base schemas
export const GamePlayerSchema = z.object({
  id: z.string().uuid(),
  username: z.string().min(1).max(50),
  firstName: z.string().min(1).max(50),
  lastName: z.string().min(1).max(50),
  avatarUrl: z.string().url().nullable().optional(),
  score: z.number().int().min(0),
  correctAnswers: z.number().int().min(0),
  totalAnswers: z.number().int().min(0),
  isHost: z.boolean(),
  isSpectator: z.boolean(),
  joinedAt: z.date(),
});

export const GameQuestionSchema = z.object({
  id: z.string().uuid(),
  question: z.string().min(1).max(1000),
  type: z.enum(['would_you_rather', 'trivia', 'word_association', 'drawing']),
  options: z.array(z.string()).optional(),
  correctAnswer: z.string().nullable().optional(),
  category: z.string().min(1).max(100),
  roundNumber: z.number().int().min(1),
  status: z.enum(['pending', 'active', 'finished']).optional(),
  flagCount: z.number().int().min(0).optional(),
  isFlagged: z.boolean().optional(),
  isHidden: z.boolean().optional(),
});

export const GameFlagsSchema = z.object({
  isPrivate: z.boolean(),
  hasPassword: z.boolean(),
  isStarted: z.boolean(),
  isFinished: z.boolean(),
  isFull: z.boolean(),
  chillMode: z.boolean(),
});

export const GameStateSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(100),
  code: z.string().length(6),
  description: z.string().max(500).nullable().optional(),
  status: z.enum(['waiting', 'playing', 'finished', 'cancelled']),
  type: z.enum(['would_you_rather', 'trivia', 'word_association', 'drawing']),
  maxPlayers: z.number().int().min(2).max(20),
  currentPlayers: z.number().int().min(0),
  roundsPerGame: z.number().int().min(1).max(50),
  timePerRound: z.number().int().min(30).max(300),
  players: z.array(GamePlayerSchema),
  queuedQuestions: z.array(GameQuestionSchema),
  flags: GameFlagsSchema,
  createdAt: z.date(),
  startedAt: z.date().nullable().optional(),
  finishedAt: z.date().nullable().optional(),
  currentState: z.enum(['lobby', 'question_build', 'round_active', 'round_results', 'game_finished', 'cancelled']).optional(),
});

// WebSocket message schemas
export const WebSocketMessageSchema = z.object({
  type: z.string(),
  data: z.unknown(),
  timestamp: z.number(),
});

export const GamePatchSchema = z.object({
  type: z.enum([
    'state_transition',
    'custom_question_added',
    'player_joined',
    'player_left',
    'question_selected',
    'question_deselected',
    'question_flagged',
    'question_hidden',
    'round_archived',
    'round_revealed',
    'round_updated',
    'responder_selected',
    'phase_change',
    'game_finale',
  ]),
  data: z.record(z.unknown()),
});

// API request/response schemas
export const CreateGameRequestSchema = z.object({
  name: z.string().min(1).max(100),
  type: z.enum(['would_you_rather', 'trivia', 'word_association', 'drawing']),
  maxPlayers: z.number().int().min(2).max(20),
  roundsPerGame: z.number().int().min(1).max(50),
  timePerRound: z.number().int().min(30).max(300),
  isPrivate: z.boolean().optional(),
  password: z.string().min(1).max(50).optional(),
});

export const JoinGameRequestSchema = z.object({
  code: z.string().length(6),
  password: z.string().optional(),
});

export const PlayerActionSchema = z.object({
  actionType: z.enum(['answer', 'flag', 'vote', 'gamble']),
  roundId: z.string().uuid(),
  data: z.record(z.unknown()),
  metadata: z.record(z.unknown()).optional(),
});

// Type exports
export type GamePlayer = z.infer<typeof GamePlayerSchema>;
export type GameQuestion = z.infer<typeof GameQuestionSchema>;
export type GameFlags = z.infer<typeof GameFlagsSchema>;
export type GameState = z.infer<typeof GameStateSchema>;
export type WebSocketMessage = z.infer<typeof WebSocketMessageSchema>;
export type GamePatch = z.infer<typeof GamePatchSchema>;
export type CreateGameRequest = z.infer<typeof CreateGameRequestSchema>;
export type JoinGameRequest = z.infer<typeof JoinGameRequestSchema>;
export type PlayerAction = z.infer<typeof PlayerActionSchema>;

// Validation functions
export const validateGameState = (data: unknown): GameState => {
  return GameStateSchema.parse(data);
};

export const validateGamePlayer = (data: unknown): GamePlayer => {
  return GamePlayerSchema.parse(data);
};

export const validateGameQuestion = (data: unknown): GameQuestion => {
  return GameQuestionSchema.parse(data);
};

export const validateWebSocketMessage = (data: unknown): WebSocketMessage => {
  return WebSocketMessageSchema.parse(data);
};

export const validateGamePatch = (data: unknown): GamePatch => {
  return GamePatchSchema.parse(data);
};

export const validateCreateGameRequest = (data: unknown): CreateGameRequest => {
  return CreateGameRequestSchema.parse(data);
};

export const validateJoinGameRequest = (data: unknown): JoinGameRequest => {
  return JoinGameRequestSchema.parse(data);
};

export const validatePlayerAction = (data: unknown): PlayerAction => {
  return PlayerActionSchema.parse(data);
}; 
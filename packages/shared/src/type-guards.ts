import { z } from 'zod';
import {
  GamePlayerSchema,
  GameQuestionSchema,
  GameStateSchema,
  WebSocketMessageSchema,
  GamePatchSchema,
  CreateGameRequestSchema,
  JoinGameRequestSchema,
  PlayerActionSchema,
} from './schemas';

// Type guard functions
export const isGamePlayer = (data: unknown): data is z.infer<typeof GamePlayerSchema> => {
  return GamePlayerSchema.safeParse(data).success;
};

export const isGameQuestion = (data: unknown): data is z.infer<typeof GameQuestionSchema> => {
  return GameQuestionSchema.safeParse(data).success;
};

export const isGameState = (data: unknown): data is z.infer<typeof GameStateSchema> => {
  return GameStateSchema.safeParse(data).success;
};

export const isWebSocketMessage = (data: unknown): data is z.infer<typeof WebSocketMessageSchema> => {
  return WebSocketMessageSchema.safeParse(data).success;
};

export const isGamePatch = (data: unknown): data is z.infer<typeof GamePatchSchema> => {
  return GamePatchSchema.safeParse(data).success;
};

export const isCreateGameRequest = (data: unknown): data is z.infer<typeof CreateGameRequestSchema> => {
  return CreateGameRequestSchema.safeParse(data).success;
};

export const isJoinGameRequest = (data: unknown): data is z.infer<typeof JoinGameRequestSchema> => {
  return JoinGameRequestSchema.safeParse(data).success;
};

export const isPlayerAction = (data: unknown): data is z.infer<typeof PlayerActionSchema> => {
  return PlayerActionSchema.safeParse(data).success;
};

// Generic type guard for any Zod schema
export const createTypeGuard = <T>(schema: z.ZodSchema<T>) => {
  return (data: unknown): data is T => {
    return schema.safeParse(data).success;
  };
};

// Utility functions for safe parsing
export const safeParse = <T>(schema: z.ZodSchema<T>, data: unknown): T | null => {
  const result = schema.safeParse(data);
  return result.success ? result.data : null;
};

export const safeParseWithError = <T>(schema: z.ZodSchema<T>, data: unknown): { success: true; data: T } | { success: false; error: string } => {
  const result = schema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, error: result.error.message };
};

// Runtime type checking utilities
export const assertIsString = (value: unknown): asserts value is string => {
  if (typeof value !== 'string') {
    throw new Error(`Expected string, got ${typeof value}`);
  }
};

export const assertIsNumber = (value: unknown): asserts value is number => {
  if (typeof value !== 'number') {
    throw new Error(`Expected number, got ${typeof value}`);
  }
};

export const assertIsBoolean = (value: unknown): asserts value is boolean => {
  if (typeof value !== 'boolean') {
    throw new Error(`Expected boolean, got ${typeof value}`);
  }
};

export const assertIsObject = (value: unknown): asserts value is Record<string, unknown> => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error(`Expected object, got ${typeof value}`);
  }
};

export const assertIsArray = (value: unknown): asserts value is unknown[] => {
  if (!Array.isArray(value)) {
    throw new Error(`Expected array, got ${typeof value}`);
  }
};

// Null/undefined checking
export const isNotNull = <T>(value: T | null | undefined): value is T => {
  return value !== null && value !== undefined;
};

export const isNull = (value: unknown): value is null => {
  return value === null;
};

export const isUndefined = (value: unknown): value is undefined => {
  return value === undefined;
}; 
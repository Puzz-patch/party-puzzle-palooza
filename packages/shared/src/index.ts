// Common types
export interface User {
  id: string;
  name: string;
  email: string;
}

export interface Game {
  id: string;
  name: string;
  players: User[];
  status: 'waiting' | 'playing' | 'finished';
}

// Common utilities
export const formatDate = (date: Date): string => {
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
};

export const generateId = (): string => {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
};

// Validation schemas
export { z } from 'zod';

export const userSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  email: z.string().email(),
});

export const gameSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  players: z.array(userSchema),
  status: z.enum(['waiting', 'playing', 'finished']),
}); 
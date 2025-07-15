// Export all schemas and types
export * from './schemas';
export * from './type-guards';

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

// Legacy types for backward compatibility
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
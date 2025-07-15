import { describe, it, expect } from 'vitest';
import { formatDate, generateId, userSchema, gameSchema } from './index';

describe('Shared utilities', () => {
  describe('formatDate', () => {
    it('should format date correctly', () => {
      const date = new Date('2023-12-25');
      const formatted = formatDate(date);
      expect(formatted).toContain('December 25, 2023');
    });
  });

  describe('generateId', () => {
    it('should generate a unique ID', () => {
      const id1 = generateId();
      const id2 = generateId();
      expect(id1).toBeDefined();
      expect(id2).toBeDefined();
      expect(id1).not.toBe(id2);
    });
  });

  describe('userSchema', () => {
    it('should validate a valid user', () => {
      const validUser = {
        id: '123',
        name: 'John Doe',
        email: 'john@example.com',
      };
      const result = userSchema.safeParse(validUser);
      expect(result.success).toBe(true);
    });

    it('should reject invalid email', () => {
      const invalidUser = {
        id: '123',
        name: 'John Doe',
        email: 'invalid-email',
      };
      const result = userSchema.safeParse(invalidUser);
      expect(result.success).toBe(false);
    });
  });

  describe('gameSchema', () => {
    it('should validate a valid game', () => {
      const validGame = {
        id: 'game-123',
        name: 'Test Game',
        players: [
          { id: '1', name: 'Player 1', email: 'player1@example.com' },
        ],
        status: 'waiting' as const,
      };
      const result = gameSchema.safeParse(validGame);
      expect(result.success).toBe(true);
    });
  });
}); 
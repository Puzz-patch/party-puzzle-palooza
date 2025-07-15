import { SetMetadata } from '@nestjs/common';

export const CACHE_KEY_METADATA = 'cache_key_metadata';
export const CACHE_TTL_METADATA = 'cache_ttl_metadata';
export const CACHE_INVALIDATE_METADATA = 'cache_invalidate_metadata';

export interface CacheMetadata {
  key: string;
  ttl?: number;
  invalidate?: string[];
}

/**
 * Decorator to cache method results
 */
export function Cacheable(key: string, ttl?: number) {
  return (target: any, propertyKey: string, descriptor: PropertyDescriptor) => {
    SetMetadata(CACHE_KEY_METADATA, { key, ttl })(target, propertyKey, descriptor);
    return descriptor;
  };
}

/**
 * Decorator to invalidate cache entries
 */
export function CacheInvalidate(patterns: string[]) {
  return (target: any, propertyKey: string, descriptor: PropertyDescriptor) => {
    SetMetadata(CACHE_INVALIDATE_METADATA, patterns)(target, propertyKey, descriptor);
    return descriptor;
  };
}

/**
 * Decorator to cache game-related data
 */
export function CacheGame(gameIdParam: string = 'gameId', ttl?: number) {
  return (target: any, propertyKey: string, descriptor: PropertyDescriptor) => {
    const originalMethod = descriptor.value;
    
    descriptor.value = async function (...args: any[]) {
      const cacheService = (this as any).cacheService;
      if (!cacheService) {
        return originalMethod.apply(this, args);
      }
      
      // Extract gameId from arguments
      const gameId = extractGameId(args, gameIdParam);
      if (!gameId) {
        return originalMethod.apply(this, args);
      }
      
      // Try to get from cache first
      const cached = await cacheService.get({ entity: 'game', id: gameId, operation: propertyKey });
      
      if (cached) {
        return cached;
      }
      
      // Execute original method
      const result = await originalMethod.apply(this, args);
      
      // Cache the result
      if (result) {
        await cacheService.set(
          { entity: 'game', id: gameId, operation: propertyKey },
          result,
          { ttl: ttl || 300 }
        );
      }
      
      return result;
    };
    
    return descriptor;
  };
}

/**
 * Decorator to invalidate game cache
 */
export function InvalidateGame(gameIdParam: string = 'gameId') {
  return (target: any, propertyKey: string, descriptor: PropertyDescriptor) => {
    const originalMethod = descriptor.value;
    
    descriptor.value = async function (...args: any[]) {
      const cacheService = (this as any).cacheService;
      const result = await originalMethod.apply(this, args);
      
      // Invalidate cache after method execution
      if (cacheService) {
        const gameId = extractGameId(args, gameIdParam);
        if (gameId) {
          await cacheService.invalidateGame(gameId);
        }
      }
      
      return result;
    };
    
    return descriptor;
  };
}

/**
 * Decorator to cache user-related data
 */
export function CacheUser(userIdParam: string = 'userId', ttl?: number) {
  return (target: any, propertyKey: string, descriptor: PropertyDescriptor) => {
    const originalMethod = descriptor.value;
    
    descriptor.value = async function (...args: any[]) {
      const cacheService = (this as any).cacheService;
      if (!cacheService) {
        return originalMethod.apply(this, args);
      }
      
      // Extract userId from arguments
      const userId = extractUserId(args, userIdParam);
      if (!userId) {
        return originalMethod.apply(this, args);
      }
      
      // Try to get from cache first
      const cached = await cacheService.get({ entity: 'user', id: userId, operation: propertyKey });
      
      if (cached) {
        return cached;
      }
      
      // Execute original method
      const result = await originalMethod.apply(this, args);
      
      // Cache the result
      if (result) {
        await cacheService.set(
          { entity: 'user', id: userId, operation: propertyKey },
          result,
          { ttl: ttl || 1800 }
        );
      }
      
      return result;
    };
    
    return descriptor;
  };
}

/**
 * Decorator to invalidate user cache
 */
export function InvalidateUser(userIdParam: string = 'userId') {
  return (target: any, propertyKey: string, descriptor: PropertyDescriptor) => {
    const originalMethod = descriptor.value;
    
    descriptor.value = async function (...args: any[]) {
      const cacheService = (this as any).cacheService;
      const result = await originalMethod.apply(this, args);
      
      // Invalidate cache after method execution
      if (cacheService) {
        const userId = extractUserId(args, userIdParam);
        if (userId) {
          await cacheService.invalidateUser(userId);
        }
      }
      
      return result;
    };
    
    return descriptor;
  };
}

/**
 * Helper method to extract gameId from method arguments
 */
export function extractGameId(args: any[], paramName: string): string | null {
  // Check if first argument is an object with the parameter
  if (args[0] && typeof args[0] === 'object' && args[0][paramName]) {
    return args[0][paramName];
  }
  
  // Check if any argument is the gameId directly
  for (const arg of args) {
    if (typeof arg === 'string' && arg.length > 0) {
      return arg;
    }
  }
  
  return null;
}

/**
 * Helper method to extract userId from method arguments
 */
export function extractUserId(args: any[], paramName: string): string | null {
  // Check if first argument is an object with the parameter
  if (args[0] && typeof args[0] === 'object' && args[0][paramName]) {
    return args[0][paramName];
  }
  
  // Check if any argument is the userId directly
  for (const arg of args) {
    if (typeof arg === 'string' && arg.length > 0) {
      return arg;
    }
  }
  
  return null;
} 
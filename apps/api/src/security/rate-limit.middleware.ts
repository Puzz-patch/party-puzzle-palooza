import { Injectable, NestMiddleware, HttpException, HttpStatus } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { RedisService } from '../redis/redis.service';

interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  message?: string;
  statusCode?: number;
}

@Injectable()
export class RateLimitMiddleware implements NestMiddleware {
  private readonly redisService: RedisService;

  constructor(redisService: RedisService) {
    this.redisService = redisService;
  }

  use(req: Request, res: Response, next: NextFunction) {
    const config = this.getRateLimitConfig(req.path);
    const key = this.generateKey(req);
    
    this.checkRateLimit(key, config)
      .then(() => next())
      .catch(error => {
        if (error instanceof HttpException) {
          throw error;
        }
        next();
      });
  }

  private getRateLimitConfig(path: string): RateLimitConfig {
    // Different rate limits for different endpoints
    const configs: Record<string, RateLimitConfig> = {
      '/api/games': { windowMs: 60000, maxRequests: 10 }, // 10 requests per minute
      '/api/games/*/join': { windowMs: 60000, maxRequests: 5 }, // 5 joins per minute
      '/api/games/*/questions/custom': { windowMs: 60000, maxRequests: 3 }, // 3 questions per minute
      '/api/rounds/*/shot': { windowMs: 30000, maxRequests: 10 }, // 10 shots per 30 seconds
      '/api/rounds/*/actions': { windowMs: 30000, maxRequests: 5 }, // 5 actions per 30 seconds
      '/api/questions/*/flag': { windowMs: 60000, maxRequests: 2 }, // 2 flags per minute
      '/game': { windowMs: 60000, maxRequests: 100 }, // WebSocket connections
      '/health': { windowMs: 60000, maxRequests: 60 }, // Health checks
      '/metrics': { windowMs: 60000, maxRequests: 10 }, // Metrics endpoint
    };

    // Find matching config
    for (const [pattern, config] of Object.entries(configs)) {
      if (this.matchesPattern(path, pattern)) {
        return {
          ...config,
          message: 'Too many requests, please try again later.',
          statusCode: HttpStatus.TOO_MANY_REQUESTS
        };
      }
    }

    // Default rate limit
    return {
      windowMs: 60000,
      maxRequests: 30,
      message: 'Too many requests, please try again later.',
      statusCode: HttpStatus.TOO_MANY_REQUESTS
    };
  }

  private matchesPattern(path: string, pattern: string): boolean {
    // Convert pattern to regex
    const regexPattern = pattern
      .replace(/\*/g, '.*') // Replace * with .*
      .replace(/\?/g, '.'); // Replace ? with .
    
    const regex = new RegExp(`^${regexPattern}$`);
    return regex.test(path);
  }

  private generateKey(req: Request): string {
    // Use IP address and user agent for rate limiting
    const ip = req.ip || req.connection.remoteAddress || 'unknown';
    const userAgent = req.get('User-Agent') || 'unknown';
    const path = req.path;
    
    // For authenticated requests, include user ID
    const playerToken = req.cookies?.player_token;
    if (playerToken) {
      return `rate_limit:${ip}:${path}:${playerToken}`;
    }
    
    return `rate_limit:${ip}:${path}:${userAgent}`;
  }

  private async checkRateLimit(key: string, config: RateLimitConfig): Promise<void> {
    try {
      const current = await this.redisService.get(key);
      const requests = current ? parseInt(current) : 0;

      if (requests >= config.maxRequests) {
        throw new HttpException(
          {
            message: config.message,
            retryAfter: Math.ceil(config.windowMs / 1000)
          },
          config.statusCode || HttpStatus.TOO_MANY_REQUESTS
        );
      }

      // Increment request count
      await this.redisService.setex(key, Math.ceil(config.windowMs / 1000), (requests + 1).toString());

      // Add rate limit headers
      // Note: These will be added in the response interceptor
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      // If Redis is unavailable, allow the request
      console.warn('Rate limiting unavailable, allowing request:', error.message);
    }
  }
} 
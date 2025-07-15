import { Injectable } from '@nestjs/common';
import { RedisService } from '../redis/redis.service';

export interface RateLimitConfig {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Maximum requests per window
}

@Injectable()
export class RateLimitService {
  constructor(private readonly redisService: RedisService) {}

  async checkRateLimit(
    key: string,
    config: RateLimitConfig
  ): Promise<{ allowed: boolean; remaining: number; resetTime: number }> {
    const now = Date.now();
    const windowStart = now - config.windowMs;
    
    const redis = this.redisService.getClient();
    
    // Get all requests in the current window
    const requests = await redis.zrangebyscore(key, windowStart, '+inf');
    
    if (requests.length >= config.maxRequests) {
      // Rate limit exceeded
      const oldestRequest = await redis.zrange(key, 0, 0, 'WITHSCORES');
      const resetTime = oldestRequest.length > 0 ? parseInt(oldestRequest[1]) + config.windowMs : now + config.windowMs;
      
      return {
        allowed: false,
        remaining: 0,
        resetTime
      };
    }
    
    // Add current request
    await redis.zadd(key, now, now.toString());
    await redis.expire(key, Math.ceil(config.windowMs / 1000));
    
    return {
      allowed: true,
      remaining: config.maxRequests - requests.length - 1,
      resetTime: now + config.windowMs
    };
  }

  async checkIpRateLimit(ip: string): Promise<{ allowed: boolean; remaining: number; resetTime: number }> {
    const key = `rate_limit:ip:${ip}`;
    return this.checkRateLimit(key, {
      windowMs: 60 * 1000, // 1 minute
      maxRequests: 10 // 10 requests per minute
    });
  }

  async checkPlayerRateLimit(playerId: string): Promise<{ allowed: boolean; remaining: number; resetTime: number }> {
    const key = `rate_limit:player:${playerId}`;
    return this.checkRateLimit(key, {
      windowMs: 5 * 60 * 1000, // 5 minutes
      maxRequests: 5 // 5 custom questions per 5 minutes
    });
  }
} 
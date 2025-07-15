import { Controller, Get, Post, Delete, Param, Query } from '@nestjs/common';
import { CacheService } from '../redis/cache.service';
import { CacheMonitorService } from '../redis/cache-monitor.service';

@Controller('cache')
export class CacheController {
  constructor(
    private readonly cacheService: CacheService,
    private readonly cacheMonitorService: CacheMonitorService,
  ) {}

  /**
   * Get cache statistics
   */
  @Get('stats')
  getStats() {
    return this.cacheService.getStats();
  }

  /**
   * Get cache performance summary
   */
  @Get('performance')
  getPerformanceSummary() {
    return this.cacheMonitorService.getPerformanceSummary();
  }

  /**
   * Get cache metrics history
   */
  @Get('metrics')
  getMetricsHistory(@Query('hours') hours: string = '24') {
    const hoursNum = parseInt(hours, 10);
    return this.cacheMonitorService.getMetricsHistory(hoursNum);
  }

  /**
   * Get recent cache alerts
   */
  @Get('alerts')
  getRecentAlerts(@Query('hours') hours: string = '24') {
    const hoursNum = parseInt(hours, 10);
    return this.cacheMonitorService.getRecentAlerts(hoursNum);
  }

  /**
   * Get cache health status
   */
  @Get('health')
  async getHealth() {
    return this.cacheMonitorService.healthCheck();
  }

  /**
   * Get cache keys count
   */
  @Get('keys/count')
  async getKeysCount() {
    const count = await this.cacheService.getKeysCount();
    return { keysCount: count };
  }

  /**
   * Get cache memory usage
   */
  @Get('memory/usage')
  async getMemoryUsage() {
    const usage = await this.cacheService.getMemoryUsage();
    return { memoryUsage: usage };
  }

  /**
   * Clear all cache
   */
  @Delete('clear')
  async clearAllCache() {
    await this.cacheService.clearAll();
    return { message: 'All cache cleared successfully' };
  }

  /**
   * Clear cache for specific game
   */
  @Delete('game/:gameId')
  async clearGameCache(@Param('gameId') gameId: string) {
    await this.cacheService.invalidateGame(gameId);
    return { message: `Cache cleared for game: ${gameId}` };
  }

  /**
   * Clear cache for specific user
   */
  @Delete('user/:userId')
  async clearUserCache(@Param('userId') userId: string) {
    await this.cacheService.invalidateUser(userId);
    return { message: `Cache cleared for user: ${userId}` };
  }

  /**
   * Clear cache for specific round
   */
  @Delete('round/:roundId')
  async clearRoundCache(@Param('roundId') roundId: string) {
    await this.cacheService.invalidateRound(roundId);
    return { message: `Cache cleared for round: ${roundId}` };
  }

  /**
   * Reset cache statistics
   */
  @Post('stats/reset')
  resetStats() {
    this.cacheService.resetStats();
    return { message: 'Cache statistics reset successfully' };
  }

  /**
   * Clear metrics history
   */
  @Delete('metrics/history')
  clearMetricsHistory() {
    this.cacheMonitorService.clearMetricsHistory();
    return { message: 'Cache metrics history cleared successfully' };
  }

  /**
   * Get cache status overview
   */
  @Get('status')
  async getCacheStatus() {
    const stats = this.cacheService.getStats();
    const keysCount = await this.cacheService.getKeysCount();
    const memoryUsage = await this.cacheService.getMemoryUsage();
    const health = await this.cacheMonitorService.healthCheck();
    const performance = this.cacheMonitorService.getPerformanceSummary();

    return {
      status: health.status,
      performance: performance.performance,
      hitRate: stats.hitRate,
      totalRequests: stats.totalRequests,
      hits: stats.hits,
      misses: stats.misses,
      keysCount,
      memoryUsage,
      alertsCount: performance.alertsCount,
      recommendations: performance.recommendations,
      timestamp: new Date(),
    };
  }
} 
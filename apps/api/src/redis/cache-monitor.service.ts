import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { CacheService, CacheStats } from './cache.service';

export interface CacheMetrics {
  timestamp: Date;
  hitRate: number;
  totalRequests: number;
  hits: number;
  misses: number;
  keysCount: number;
  memoryUsage: number;
  performance: 'excellent' | 'good' | 'poor' | 'critical';
}

export interface CacheAlert {
  type: 'hit_rate_low' | 'memory_high' | 'keys_excessive' | 'performance_degraded';
  message: string;
  severity: 'warning' | 'error' | 'critical';
  timestamp: Date;
  metrics: CacheMetrics;
}

@Injectable()
export class CacheMonitorService {
  private readonly logger = new Logger(CacheMonitorService.name);
  private metricsHistory: CacheMetrics[] = [];
  private alerts: CacheAlert[] = [];
  
  // Thresholds for monitoring
  private readonly THRESHOLDS = {
    HIT_RATE_MIN: 80, // Target hit rate
    HIT_RATE_WARNING: 70, // Warning threshold
    HIT_RATE_CRITICAL: 50, // Critical threshold
    MEMORY_WARNING: 0.8, // 80% of available memory
    MEMORY_CRITICAL: 0.95, // 95% of available memory
    KEYS_WARNING: 10000, // Warning for key count
    KEYS_CRITICAL: 50000, // Critical for key count
  };

  constructor(private readonly cacheService: CacheService) {}

  /**
   * Collect current cache metrics
   */
  async collectMetrics(): Promise<CacheMetrics> {
    const stats = this.cacheService.getStats();
    const keysCount = await this.cacheService.getKeysCount();
    const memoryUsage = await this.cacheService.getMemoryUsage();

    const metrics: CacheMetrics = {
      timestamp: new Date(),
      hitRate: stats.hitRate,
      totalRequests: stats.totalRequests,
      hits: stats.hits,
      misses: stats.misses,
      keysCount,
      memoryUsage,
      performance: this.assessPerformance(stats.hitRate),
    };

    this.metricsHistory.push(metrics);
    
    // Keep only last 24 hours of metrics (1440 minutes)
    if (this.metricsHistory.length > 1440) {
      this.metricsHistory = this.metricsHistory.slice(-1440);
    }

    return metrics;
  }

  /**
   * Assess cache performance based on hit rate
   */
  private assessPerformance(hitRate: number): 'excellent' | 'good' | 'poor' | 'critical' {
    if (hitRate >= 90) return 'excellent';
    if (hitRate >= 80) return 'good';
    if (hitRate >= 60) return 'poor';
    return 'critical';
  }

  /**
   * Check for cache alerts
   */
  async checkAlerts(metrics: CacheMetrics): Promise<CacheAlert[]> {
    const newAlerts: CacheAlert[] = [];

    // Check hit rate
    if (metrics.hitRate < this.THRESHOLDS.HIT_RATE_CRITICAL) {
      newAlerts.push({
        type: 'hit_rate_low',
        message: `Cache hit rate is critically low: ${metrics.hitRate.toFixed(2)}% (target: ${this.THRESHOLDS.HIT_RATE_MIN}%)`,
        severity: 'critical',
        timestamp: new Date(),
        metrics,
      });
    } else if (metrics.hitRate < this.THRESHOLDS.HIT_RATE_WARNING) {
      newAlerts.push({
        type: 'hit_rate_low',
        message: `Cache hit rate is below target: ${metrics.hitRate.toFixed(2)}% (target: ${this.THRESHOLDS.HIT_RATE_MIN}%)`,
        severity: 'warning',
        timestamp: new Date(),
        metrics,
      });
    }

    // Check memory usage (if available)
    if (metrics.memoryUsage > 0) {
      // This would need to be calibrated based on actual Redis memory limits
      const memoryUsagePercent = metrics.memoryUsage / (1024 * 1024 * 100); // Assuming 100MB limit
      
      if (memoryUsagePercent > this.THRESHOLDS.MEMORY_CRITICAL) {
        newAlerts.push({
          type: 'memory_high',
          message: `Cache memory usage is critical: ${(memoryUsagePercent * 100).toFixed(2)}%`,
          severity: 'critical',
          timestamp: new Date(),
          metrics,
        });
      } else if (memoryUsagePercent > this.THRESHOLDS.MEMORY_WARNING) {
        newAlerts.push({
          type: 'memory_high',
          message: `Cache memory usage is high: ${(memoryUsagePercent * 100).toFixed(2)}%`,
          severity: 'warning',
          timestamp: new Date(),
          metrics,
        });
      }
    }

    // Check key count
    if (metrics.keysCount > this.THRESHOLDS.KEYS_CRITICAL) {
      newAlerts.push({
        type: 'keys_excessive',
        message: `Cache has excessive number of keys: ${metrics.keysCount}`,
        severity: 'critical',
        timestamp: new Date(),
        metrics,
      });
    } else if (metrics.keysCount > this.THRESHOLDS.KEYS_WARNING) {
      newAlerts.push({
        type: 'keys_excessive',
        message: `Cache has high number of keys: ${metrics.keysCount}`,
        severity: 'warning',
        timestamp: new Date(),
        metrics,
      });
    }

    // Check performance degradation
    if (metrics.performance === 'critical' || metrics.performance === 'poor') {
      newAlerts.push({
        type: 'performance_degraded',
        message: `Cache performance is degraded: ${metrics.performance} (hit rate: ${metrics.hitRate.toFixed(2)}%)`,
        severity: metrics.performance === 'critical' ? 'critical' : 'warning',
        timestamp: new Date(),
        metrics,
      });
    }

    // Add new alerts to history
    this.alerts.push(...newAlerts);
    
    // Keep only last 1000 alerts
    if (this.alerts.length > 1000) {
      this.alerts = this.alerts.slice(-1000);
    }

    return newAlerts;
  }

  /**
   * Get current cache statistics
   */
  getCurrentStats(): CacheStats {
    return this.cacheService.getStats();
  }

  /**
   * Get metrics history
   */
  getMetricsHistory(hours: number = 24): CacheMetrics[] {
    const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000);
    return this.metricsHistory.filter(metric => metric.timestamp >= cutoff);
  }

  /**
   * Get recent alerts
   */
  getRecentAlerts(hours: number = 24): CacheAlert[] {
    const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000);
    return this.alerts.filter(alert => alert.timestamp >= cutoff);
  }

  /**
   * Get cache performance summary
   */
  getPerformanceSummary(): {
    currentHitRate: number;
    averageHitRate: number;
    performance: string;
    alertsCount: number;
    recommendations: string[];
  } {
    const currentStats = this.getCurrentStats();
    const recentMetrics = this.getMetricsHistory(1); // Last hour
    
    const averageHitRate = recentMetrics.length > 0
      ? recentMetrics.reduce((sum, m) => sum + m.hitRate, 0) / recentMetrics.length
      : currentStats.hitRate;

    const recentAlerts = this.getRecentAlerts(1);
    const recommendations: string[] = [];

    if (currentStats.hitRate < this.THRESHOLDS.HIT_RATE_MIN) {
      recommendations.push('Consider increasing cache TTL for frequently accessed data');
      recommendations.push('Review cache invalidation patterns');
      recommendations.push('Add more cacheable data types');
    }

    if (recentAlerts.length > 10) {
      recommendations.push('High alert frequency - review cache configuration');
    }

    return {
      currentHitRate: currentStats.hitRate,
      averageHitRate,
      performance: this.assessPerformance(currentStats.hitRate),
      alertsCount: recentAlerts.length,
      recommendations,
    };
  }

  /**
   * Reset cache statistics
   */
  resetStats(): void {
    this.cacheService.resetStats();
    this.logger.log('Cache statistics reset');
  }

  /**
   * Clear metrics history
   */
  clearMetricsHistory(): void {
    this.metricsHistory = [];
    this.alerts = [];
    this.logger.log('Cache metrics history cleared');
  }

  /**
   * Scheduled metrics collection (every minute)
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async scheduledMetricsCollection() {
    try {
      const metrics = await this.collectMetrics();
      const alerts = await this.checkAlerts(metrics);

      // Log critical alerts
      const criticalAlerts = alerts.filter(alert => alert.severity === 'critical');
      if (criticalAlerts.length > 0) {
        this.logger.error(`Critical cache alerts: ${criticalAlerts.map(a => a.message).join(', ')}`);
      }

      // Log warnings
      const warnings = alerts.filter(alert => alert.severity === 'warning');
      if (warnings.length > 0) {
        this.logger.warn(`Cache warnings: ${warnings.map(a => a.message).join(', ')}`);
      }

      // Log performance status
      if (metrics.performance === 'excellent' || metrics.performance === 'good') {
        this.logger.debug(`Cache performance: ${metrics.performance} (hit rate: ${metrics.hitRate.toFixed(2)}%)`);
      } else {
        this.logger.warn(`Cache performance: ${metrics.performance} (hit rate: ${metrics.hitRate.toFixed(2)}%)`);
      }
    } catch (error) {
      this.logger.error('Error collecting cache metrics', error);
    }
  }

  /**
   * Health check for cache monitoring
   */
  async healthCheck(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    hitRate: number;
    performance: string;
    alerts: number;
  }> {
    try {
      const metrics = await this.collectMetrics();
      const recentAlerts = this.getRecentAlerts(1); // Last hour
      
      let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
      
      if (metrics.hitRate < this.THRESHOLDS.HIT_RATE_CRITICAL || 
          recentAlerts.some(a => a.severity === 'critical')) {
        status = 'unhealthy';
      } else if (metrics.hitRate < this.THRESHOLDS.HIT_RATE_WARNING || 
                 recentAlerts.some(a => a.severity === 'warning')) {
        status = 'degraded';
      }

      return {
        status,
        hitRate: metrics.hitRate,
        performance: metrics.performance,
        alerts: recentAlerts.length,
      };
    } catch (error) {
      this.logger.error('Cache health check failed', error);
      return {
        status: 'unhealthy',
        hitRate: 0,
        performance: 'unknown',
        alerts: 0,
      };
    }
  }
} 
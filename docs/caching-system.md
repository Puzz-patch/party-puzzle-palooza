# Caching System Documentation

## Overview

The Party Puzzle Palooza caching system provides a robust Redis-based caching layer for frequently accessed game and player data. The system is designed to achieve a **minimum 80% cache hit rate** in production while reducing database load and improving real-time performance.

## Architecture

### Core Components

1. **CacheService** (`apps/api/src/redis/cache.service.ts`)
   - Main caching service that extends the existing Redis service
   - Provides typed methods for caching different entity types
   - Handles cache key generation, TTL management, and invalidation

2. **CacheMonitorService** (`apps/api/src/redis/cache-monitor.service.ts`)
   - Monitors cache performance and health
   - Collects metrics and generates alerts
   - Provides performance recommendations

3. **CacheController** (`apps/api/src/controllers/cache.controller.ts`)
   - REST API endpoints for cache management and monitoring
   - Exposes cache statistics and performance metrics

4. **Cache Decorators** (`apps/api/src/redis/cache.decorator.ts`)
   - TypeScript decorators for easy cache integration
   - Automatic cache invalidation on data updates

### Cache Strategy

#### Cached Data Types

| Data Type | TTL | Invalidation Trigger | Use Case |
|-----------|-----|---------------------|----------|
| Game Data | 10 minutes | Game updates, player joins/leaves | Game state, manifest |
| Game Players | 5 minutes | Player status changes | Player lists, scores |
| Game Rounds | 5 minutes | Round updates, answers | Question data |
| Player Answers | 3 minutes | Answer submissions | Answer tracking |
| User Data | 30 minutes | User profile updates | User information |
| Active Games List | 2 minutes | Game creation/completion | Lobby listings |
| User Games | 5 minutes | Game joins/leaves | User game history |

#### Cache Key Structure

```
{entity}:{id}:{operation}:{filters}
```

Examples:
- `game:abc123:manifest` - Game manifest
- `game_players:abc123:status=joined` - Joined players for game
- `user:user456:profile` - User profile data
- `active_games:list:status=waiting` - Waiting games list

## Implementation

### 1. Cache Service Integration

```typescript
// Inject CacheService into your service
@Injectable()
export class GameService {
  constructor(
    private cacheService: CacheService,
    private gameRepository: Repository<Game>
  ) {}

  async getGameById(gameId: string): Promise<Game> {
    // Try cache first
    const cached = await this.cacheService.getGame(gameId);
    if (cached) {
      return cached;
    }

    // Fetch from database
    const game = await this.gameRepository.findOne({
      where: { id: gameId },
      relations: ['gamePlayers', 'gameRounds']
    });

    // Cache the result
    if (game) {
      await this.cacheService.setGame(game);
    }

    return game;
  }
}
```

### 2. Using Cache Decorators

```typescript
@Injectable()
export class CachedGameService {
  constructor(private cacheService: CacheService) {}

  @CacheGame('gameId', 600) // 10 minutes cache
  async getGameManifest(gameId: string): Promise<GameManifest> {
    // Method implementation - automatically cached
    return this.buildGameManifest(gameId);
  }

  @InvalidateGame('gameId')
  async updateGame(gameId: string, updates: Partial<Game>): Promise<Game> {
    // Method implementation - automatically invalidates cache
    return this.gameRepository.update(gameId, updates);
  }
}
```

### 3. Manual Cache Management

```typescript
// Cache invalidation
await this.cacheService.invalidateGame(gameId);
await this.cacheService.invalidateUser(userId);
await this.cacheService.invalidateRound(roundId);

// Cache statistics
const stats = this.cacheService.getStats();
console.log(`Hit rate: ${stats.hitRate}%`);

// Cache health check
const isHealthy = await this.cacheService.healthCheck();
```

## Monitoring & Performance

### Cache Metrics

The system tracks the following metrics:

- **Hit Rate**: Percentage of cache hits vs total requests
- **Total Requests**: Number of cache requests
- **Hits/Misses**: Absolute counts
- **Memory Usage**: Redis memory consumption
- **Key Count**: Number of cached items

### Performance Targets

- **Hit Rate**: ≥ 80% (target)
- **Response Time (cached)**: < 100ms (p95)
- **Response Time (uncached)**: < 300ms (p95)
- **Error Rate**: < 5%

### Monitoring Endpoints

```bash
# Get cache statistics
GET /cache/stats

# Get performance summary
GET /cache/performance

# Get cache health
GET /cache/health

# Get cache status overview
GET /cache/status

# Get metrics history
GET /cache/metrics?hours=24

# Get recent alerts
GET /cache/alerts?hours=24
```

### Alerts

The system generates alerts for:

- **Low Hit Rate**: < 70% (warning), < 50% (critical)
- **High Memory Usage**: > 80% (warning), > 95% (critical)
- **Excessive Keys**: > 10,000 (warning), > 50,000 (critical)
- **Performance Degradation**: Poor or critical performance

## Testing

### Cache Performance Test

Run the cache performance test to validate the 80% hit rate target:

```bash
# Run cache performance test
./scripts/run-cache-performance-test.sh

# With custom parameters
API_URL=http://localhost:3000 \
TARGET_HIT_RATE=80 \
TEST_DURATION=20m \
MAX_VUS=100 \
./scripts/run-cache-performance-test.sh
```

### Test Scenarios

The performance test covers:

1. **Cache Hit Scenarios**
   - Game manifest retrieval
   - Player list queries
   - Round data access
   - Active games listing

2. **Cache Miss Scenarios**
   - Game creation
   - Player actions
   - Cache invalidation

3. **Performance Validation**
   - Response time comparison
   - Cache effectiveness measurement
   - Hit rate calculation

## Best Practices

### 1. Cache Key Design

- Use consistent naming conventions
- Include relevant filters in keys
- Keep keys reasonably short
- Use versioning for schema changes

### 2. TTL Management

- Set appropriate TTL based on data volatility
- Use shorter TTL for frequently changing data
- Consider business requirements for data freshness

### 3. Cache Invalidation

- Invalidate cache on data updates
- Use pattern-based invalidation for related data
- Avoid over-invalidation
- Consider write-through caching for critical data

### 4. Error Handling

- Gracefully handle cache failures
- Fall back to database when cache is unavailable
- Log cache errors for monitoring
- Implement circuit breakers for cache operations

### 5. Performance Optimization

- Use appropriate data serialization
- Compress large cached objects
- Monitor memory usage
- Implement cache warming for critical data

## Configuration

### Environment Variables

```bash
# Redis configuration
REDIS_URL=redis://localhost:6379

# Cache configuration
CACHE_DEFAULT_TTL=300
CACHE_MAX_KEYS=10000
CACHE_MEMORY_LIMIT=100MB

# Monitoring configuration
CACHE_MONITORING_ENABLED=true
CACHE_ALERT_THRESHOLDS_HIT_RATE=80
CACHE_ALERT_THRESHOLDS_MEMORY=80
```

### Redis Configuration

```redis
# Recommended Redis configuration
maxmemory 100mb
maxmemory-policy allkeys-lru
save 900 1
save 300 10
save 60 10000
```

## Troubleshooting

### Common Issues

1. **Low Hit Rate**
   - Check TTL settings
   - Review cache invalidation patterns
   - Add more cacheable endpoints
   - Monitor cache key patterns

2. **High Memory Usage**
   - Reduce TTL for large objects
   - Implement data compression
   - Review cached data size
   - Increase Redis memory limit

3. **Cache Inconsistency**
   - Check invalidation logic
   - Review concurrent access patterns
   - Implement cache versioning
   - Use distributed locks if needed

### Debug Commands

```bash
# Check cache status
curl http://localhost:3000/cache/status

# Clear specific cache
curl -X DELETE http://localhost:3000/cache/game/{gameId}

# Reset statistics
curl -X POST http://localhost:3000/cache/stats/reset

# Get detailed metrics
curl http://localhost:3000/cache/metrics?hours=1
```

## Migration Guide

### From No Caching

1. **Add CacheService** to your module
2. **Inject CacheService** into your services
3. **Wrap database queries** with cache logic
4. **Add cache invalidation** on data updates
5. **Test cache performance** with load tests

### From Simple Caching

1. **Replace simple caching** with CacheService
2. **Use typed cache methods** for better type safety
3. **Implement cache decorators** for cleaner code
4. **Add monitoring** and alerting
5. **Optimize cache strategy** based on metrics

## Future Enhancements

### Planned Features

1. **Distributed Caching**
   - Redis Cluster support
   - Multi-region caching
   - Cache replication

2. **Advanced Monitoring**
   - Grafana dashboards
   - Prometheus metrics
   - Automated alerting

3. **Cache Optimization**
   - Predictive cache warming
   - Adaptive TTL
   - Cache compression

4. **Performance Improvements**
   - Connection pooling
   - Pipeline operations
   - Async cache operations

## Success Criteria

The caching system is considered successful when:

- ✅ **Hit Rate ≥ 80%** in production load tests
- ✅ **Response Time Improvement ≥ 50%** for cached requests
- ✅ **Database Load Reduction ≥ 60%** for cached queries
- ✅ **Zero Cache-Related Outages** in production
- ✅ **Monitoring Coverage ≥ 100%** of cache operations

## Support

For questions or issues with the caching system:

1. Check the monitoring dashboard
2. Review cache performance metrics
3. Consult this documentation
4. Contact the development team

---

*Last updated: January 2025* 
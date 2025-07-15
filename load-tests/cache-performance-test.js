import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

// Custom metrics for cache testing
const cacheHitRate = new Rate('cache_hit_rate');
const cacheMissRate = new Rate('cache_miss_rate');
const responseTimeWithCache = new Trend('response_time_with_cache');
const responseTimeWithoutCache = new Trend('response_time_without_cache');
const cacheEffectiveness = new Trend('cache_effectiveness');

// Configuration
export const options = {
  stages: [
    { duration: '1m', target: 10 },   // Warm up with 10 users
    { duration: '2m', target: 10 },   // Baseline with 10 users
    { duration: '2m', target: 50 },   // Ramp up to 50 users
    { duration: '5m', target: 50 },   // Sustained load with 50 users
    { duration: '2m', target: 100 },  // Ramp up to 100 users
    { duration: '5m', target: 100 },  // Peak load with 100 users
    { duration: '2m', target: 0 },    // Ramp down
  ],
  thresholds: {
    'http_req_duration': ['p(95)<200'], // 95% of requests should be below 200ms
    'http_req_failed': ['rate<0.05'],   // Error rate should be below 5%
    'cache_hit_rate': ['rate>0.8'],     // Cache hit rate should be above 80%
    'response_time_with_cache': ['p(95)<100'], // Cached responses should be fast
    'cache_effectiveness': ['avg>0.5'], // Cache should provide significant improvement
  },
};

// Test data
const BASE_URL = __ENV.API_URL || 'http://localhost:3000';
const TEST_GAME_ID = __ENV.TEST_GAME_ID || 'cache-test-game-123';
const TEST_USER_ID = __ENV.TEST_USER_ID || 'cache-test-user-456';

// Cache test scenarios
const cacheTestScenarios = [
  {
    name: 'Game Manifest Cache',
    url: `${BASE_URL}/games/${TEST_GAME_ID}/manifest`,
    description: 'Test game manifest caching',
    expectedCacheHit: true,
  },
  {
    name: 'Game Players Cache',
    url: `${BASE_URL}/games/${TEST_GAME_ID}/players`,
    description: 'Test game players caching',
    expectedCacheHit: true,
  },
  {
    name: 'Game Rounds Cache',
    url: `${BASE_URL}/games/${TEST_GAME_ID}/rounds`,
    description: 'Test game rounds caching',
    expectedCacheHit: true,
  },
  {
    name: 'Active Games Cache',
    url: `${BASE_URL}/games?status=waiting`,
    description: 'Test active games list caching',
    expectedCacheHit: true,
  },
  {
    name: 'User Games Cache',
    url: `${BASE_URL}/users/${TEST_USER_ID}/games`,
    description: 'Test user games caching',
    expectedCacheHit: true,
  },
];

// Non-cache scenarios (for comparison)
const nonCacheScenarios = [
  {
    name: 'Game Creation',
    url: `${BASE_URL}/games`,
    method: 'POST',
    body: JSON.stringify({
      name: 'Cache Test Game',
      type: 'would_you_rather',
      maxPlayers: 10,
      isPrivate: false,
    }),
    description: 'Test game creation (should not be cached)',
    expectedCacheHit: false,
  },
  {
    name: 'Player Action',
    url: `${BASE_URL}/games/${TEST_GAME_ID}/actions`,
    method: 'POST',
    body: JSON.stringify({
      type: 'join',
      playerId: TEST_USER_ID,
    }),
    description: 'Test player action (should not be cached)',
    expectedCacheHit: false,
  },
];

export default function () {
  // Test cache scenarios
  cacheTestScenarios.forEach((scenario, index) => {
    // First request (should miss cache)
    const firstResponse = http.get(scenario.url);
    const firstResponseTime = firstResponse.timings.duration;
    
    check(firstResponse, {
      [`${scenario.name} - first request status`]: (r) => r.status === 200,
      [`${scenario.name} - first request time`]: (r) => r.timings.duration < 500,
    });
    
    responseTimeWithoutCache.add(firstResponseTime);
    cacheMissRate.add(1);
    
    // Second request (should hit cache)
    sleep(0.1); // Small delay to ensure cache is set
    
    const secondResponse = http.get(scenario.url);
    const secondResponseTime = secondResponse.timings.duration;
    
    check(secondResponse, {
      [`${scenario.name} - second request status`]: (r) => r.status === 200,
      [`${scenario.name} - second request time`]: (r) => r.timings.duration < 100,
    });
    
    responseTimeWithCache.add(secondResponseTime);
    cacheHitRate.add(1);
    
    // Calculate cache effectiveness
    if (firstResponseTime > 0) {
      const effectiveness = (firstResponseTime - secondResponseTime) / firstResponseTime;
      cacheEffectiveness.add(effectiveness);
    }
    
    sleep(0.1);
  });
  
  // Test non-cache scenarios (for comparison)
  nonCacheScenarios.forEach((scenario) => {
    const response = scenario.method === 'POST' 
      ? http.post(scenario.url, scenario.body, {
          headers: { 'Content-Type': 'application/json' },
        })
      : http.get(scenario.url);
    
    check(response, {
      [`${scenario.name} - status`]: (r) => r.status === 200 || r.status === 201,
      [`${scenario.name} - response time`]: (r) => r.timings.duration < 300,
    });
    
    // These should not hit cache
    cacheMissRate.add(1);
    
    sleep(0.1);
  });
  
  // Test cache invalidation
  if (__ITER % 10 === 0) { // Every 10th iteration
    // Clear game cache
    const clearResponse = http.del(`${BASE_URL}/cache/game/${TEST_GAME_ID}`);
    
    check(clearResponse, {
      'Cache clear - status': (r) => r.status === 200,
    });
    
    // Test that cache is cleared by making a request
    const testResponse = http.get(`${BASE_URL}/games/${TEST_GAME_ID}/manifest`);
    
    check(testResponse, {
      'Cache clear verification - status': (r) => r.status === 200,
    });
    
    // This should be a cache miss after clearing
    cacheMissRate.add(1);
  }
  
  // Test cache statistics endpoint
  if (__ITER % 5 === 0) { // Every 5th iteration
    const statsResponse = http.get(`${BASE_URL}/cache/stats`);
    
    check(statsResponse, {
      'Cache stats - status': (r) => r.status === 200,
      'Cache stats - has hit rate': (r) => r.json().hitRate !== undefined,
      'Cache stats - has total requests': (r) => r.json().totalRequests !== undefined,
    });
  }
  
  // Test cache performance endpoint
  if (__ITER % 15 === 0) { // Every 15th iteration
    const performanceResponse = http.get(`${BASE_URL}/cache/performance`);
    
    check(performanceResponse, {
      'Cache performance - status': (r) => r.status === 200,
      'Cache performance - has hit rate': (r) => r.json().currentHitRate !== undefined,
      'Cache performance - has recommendations': (r) => Array.isArray(r.json().recommendations),
    });
  }
  
  // Random sleep between iterations
  sleep(Math.random() * 2 + 1);
}

// Setup function to prepare test data
export function setup() {
  console.log('Setting up cache performance test...');
  
  // Create test game
  const gameResponse = http.post(`${BASE_URL}/games`, {
    name: 'Cache Performance Test Game',
    type: 'would_you_rather',
    maxPlayers: 10,
    isPrivate: false,
  });
  
  if (gameResponse.status === 201) {
    console.log('Test game created successfully');
  }
  
  // Clear any existing cache for test data
  http.del(`${BASE_URL}/cache/clear`);
  
  return {
    testGameId: TEST_GAME_ID,
    testUserId: TEST_USER_ID,
  };
}

// Teardown function to clean up
export function teardown(data) {
  console.log('Cleaning up cache performance test...');
  
  // Clear test cache
  http.del(`${BASE_URL}/cache/clear`);
  
  // Clean up test data
  http.del(`${BASE_URL}/games/${data.testGameId}`);
  
  console.log('Cache performance test cleanup completed');
}

// Handle summary
export function handleSummary(data) {
  const cacheHitRateValue = data.metrics.cache_hit_rate?.rate || 0;
  const cacheMissRateValue = data.metrics.cache_miss_rate?.rate || 0;
  const avgResponseTimeWithCache = data.metrics.response_time_with_cache?.avg || 0;
  const avgResponseTimeWithoutCache = data.metrics.response_time_without_cache?.avg || 0;
  const avgCacheEffectiveness = data.metrics.cache_effectiveness?.avg || 0;
  
  console.log('=== Cache Performance Test Summary ===');
  console.log(`Cache Hit Rate: ${(cacheHitRateValue * 100).toFixed(2)}%`);
  console.log(`Cache Miss Rate: ${(cacheMissRateValue * 100).toFixed(2)}%`);
  console.log(`Average Response Time (with cache): ${avgResponseTimeWithCache.toFixed(2)}ms`);
  console.log(`Average Response Time (without cache): ${avgResponseTimeWithoutCache.toFixed(2)}ms`);
  console.log(`Cache Effectiveness: ${(avgCacheEffectiveness * 100).toFixed(2)}%`);
  
  // Check if target is met
  const targetMet = cacheHitRateValue >= 0.8;
  console.log(`Target (80% hit rate) met: ${targetMet ? '✅ YES' : '❌ NO'}`);
  
  if (targetMet) {
    console.log('🎉 Cache performance target achieved!');
  } else {
    console.log('⚠️  Cache performance target not met. Consider:');
    console.log('   - Increasing cache TTL');
    console.log('   - Adding more cacheable endpoints');
    console.log('   - Reviewing cache invalidation patterns');
  }
  
  return {
    'cache-performance-summary.json': JSON.stringify({
      timestamp: new Date().toISOString(),
      cacheHitRate: cacheHitRateValue,
      cacheMissRate: cacheMissRateValue,
      avgResponseTimeWithCache,
      avgResponseTimeWithoutCache,
      avgCacheEffectiveness,
      targetMet,
      recommendations: targetMet ? [] : [
        'Increase cache TTL for frequently accessed data',
        'Add more cacheable endpoints',
        'Review cache invalidation patterns',
        'Optimize cache key generation',
      ],
    }, null, 2),
  };
} 
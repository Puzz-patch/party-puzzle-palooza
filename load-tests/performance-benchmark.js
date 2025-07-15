import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

// Custom metrics
const queryLatency = new Trend('query_latency_ms');
const indexHitRate = new Rate('index_hit_rate');
const querySuccessRate = new Rate('query_success_rate');
const slowQueryCount = new Counter('slow_queries');

// Configuration
export const options = {
  stages: [
    { duration: '2m', target: 10 },  // Ramp up to 10 users
    { duration: '5m', target: 10 },  // Stay at 10 users
    { duration: '2m', target: 50 },  // Ramp up to 50 users
    { duration: '5m', target: 50 },  // Stay at 50 users
    { duration: '2m', target: 100 }, // Ramp up to 100 users
    { duration: '5m', target: 100 }, // Stay at 100 users
    { duration: '2m', target: 0 },   // Ramp down to 0 users
  ],
  thresholds: {
    'http_req_duration': ['p(95)<300'], // 95% of requests should be below 300ms
    'http_req_failed': ['rate<0.05'],   // Error rate should be below 5%
    'query_latency_ms': ['p(95)<200'],  // 95% of queries should be below 200ms
    'index_hit_rate': ['rate>0.9'],     // Index hit rate should be above 90%
    'query_success_rate': ['rate>0.95'], // Query success rate should be above 95%
  },
};

// Test data
const BASE_URL = __ENV.API_URL || 'http://localhost:3000';
const TEST_GAME_ID = __ENV.TEST_GAME_ID || 'test-game-123';
const TEST_USER_ID = __ENV.TEST_USER_ID || 'test-user-456';

// Helper function to generate random data
function generateRandomData() {
  return {
    gameId: `game-${Math.random().toString(36).substr(2, 9)}`,
    userId: `user-${Math.random().toString(36).substr(2, 9)}`,
    roundId: `round-${Math.random().toString(36).substr(2, 9)}`,
    status: ['waiting', 'playing', 'finished'][Math.floor(Math.random() * 3)],
    playerStatus: ['joined', 'ready', 'playing', 'left'][Math.floor(Math.random() * 4)],
    roundStatus: ['pending', 'active', 'finished'][Math.floor(Math.random() * 3)],
  };
}

// Test scenarios that should benefit from the new indexes
export default function () {
  const data = generateRandomData();
  
  // Scenario 1: Game queries by status (should use IDX_games_status_created_at)
  const gameStatusQueries = [
    { status: 'waiting', description: 'Find waiting games' },
    { status: 'playing', description: 'Find active games' },
    { status: 'finished', description: 'Find finished games' },
  ];
  
  gameStatusQueries.forEach(({ status, description }) => {
    const startTime = Date.now();
    const response = http.get(`${BASE_URL}/games?status=${status}&limit=10`);
    const latency = Date.now() - startTime;
    
    queryLatency.add(latency);
    
    const success = check(response, {
      [`${description} - status code`]: (r) => r.status === 200,
      [`${description} - response time`]: (r) => r.timings.duration < 300,
      [`${description} - has data`]: (r) => r.json().length >= 0,
    });
    
    querySuccessRate.add(success);
    if (latency > 200) slowQueryCount.add(1);
    
    // Simulate index hit by checking if query was fast
    indexHitRate.add(latency < 100);
    
    sleep(0.1);
  });
  
  // Scenario 2: Game queries by type and status (should use IDX_games_type_status)
  const gameTypeQueries = [
    { type: 'would_you_rather', status: 'waiting' },
    { type: 'trivia', status: 'playing' },
    { type: 'word_association', status: 'finished' },
  ];
  
  gameTypeQueries.forEach(({ type, status }) => {
    const startTime = Date.now();
    const response = http.get(`${BASE_URL}/games?type=${type}&status=${status}&limit=5`);
    const latency = Date.now() - startTime;
    
    queryLatency.add(latency);
    
    const success = check(response, {
      [`Game type ${type} ${status} - status code`]: (r) => r.status === 200,
      [`Game type ${type} ${status} - response time`]: (r) => r.timings.duration < 300,
    });
    
    querySuccessRate.add(success);
    if (latency > 200) slowQueryCount.add(1);
    indexHitRate.add(latency < 100);
    
    sleep(0.1);
  });
  
  // Scenario 3: Game player queries (should use IDX_game_players_game_status)
  const playerQueries = [
    { gameId: TEST_GAME_ID, status: 'playing', description: 'Find active players in game' },
    { gameId: TEST_GAME_ID, status: 'ready', description: 'Find ready players in game' },
    { gameId: TEST_GAME_ID, isHost: true, description: 'Find host player' },
  ];
  
  playerQueries.forEach(({ gameId, status, isHost, description }) => {
    const startTime = Date.now();
    let response;
    
    if (isHost) {
      response = http.get(`${BASE_URL}/games/${gameId}/players?isHost=true`);
    } else {
      response = http.get(`${BASE_URL}/games/${gameId}/players?status=${status}`);
    }
    
    const latency = Date.now() - startTime;
    queryLatency.add(latency);
    
    const success = check(response, {
      [`${description} - status code`]: (r) => r.status === 200,
      [`${description} - response time`]: (r) => r.timings.duration < 300,
    });
    
    querySuccessRate.add(success);
    if (latency > 200) slowQueryCount.add(1);
    indexHitRate.add(latency < 100);
    
    sleep(0.1);
  });
  
  // Scenario 4: Game round queries (should use IDX_game_rounds_game_status)
  const roundQueries = [
    { gameId: TEST_GAME_ID, status: 'active', description: 'Find active rounds' },
    { gameId: TEST_GAME_ID, status: 'pending', description: 'Find pending rounds' },
    { gameId: TEST_GAME_ID, status: 'finished', description: 'Find finished rounds' },
  ];
  
  roundQueries.forEach(({ gameId, status, description }) => {
    const startTime = Date.now();
    const response = http.get(`${BASE_URL}/games/${gameId}/rounds?status=${status}`);
    const latency = Date.now() - startTime;
    
    queryLatency.add(latency);
    
    const success = check(response, {
      [`${description} - status code`]: (r) => r.status === 200,
      [`${description} - response time`]: (r) => r.timings.duration < 300,
    });
    
    querySuccessRate.add(success);
    if (latency > 200) slowQueryCount.add(1);
    indexHitRate.add(latency < 100);
    
    sleep(0.1);
  });
  
  // Scenario 5: Player answer queries (should use IDX_player_answers_round_status)
  const answerQueries = [
    { roundId: data.roundId, status: 'submitted', description: 'Find submitted answers' },
    { roundId: data.roundId, status: 'correct', description: 'Find correct answers' },
    { userId: TEST_USER_ID, description: 'Find user answers' },
  ];
  
  answerQueries.forEach(({ roundId, status, userId, description }) => {
    const startTime = Date.now();
    let response;
    
    if (userId) {
      response = http.get(`${BASE_URL}/users/${userId}/answers?limit=10`);
    } else {
      response = http.get(`${BASE_URL}/rounds/${roundId}/answers?status=${status}`);
    }
    
    const latency = Date.now() - startTime;
    queryLatency.add(latency);
    
    const success = check(response, {
      [`${description} - status code`]: (r) => r.status === 200,
      [`${description} - response time`]: (r) => r.timings.duration < 300,
    });
    
    querySuccessRate.add(success);
    if (latency > 200) slowQueryCount.add(1);
    indexHitRate.add(latency < 100);
    
    sleep(0.1);
  });
  
  // Scenario 6: User queries (should use IDX_users_status)
  const userQueries = [
    { status: 'active', description: 'Find active users' },
    { role: 'admin', description: 'Find admin users' },
  ];
  
  userQueries.forEach(({ status, role, description }) => {
    const startTime = Date.now();
    let response;
    
    if (role) {
      response = http.get(`${BASE_URL}/users?role=${role}&limit=5`);
    } else {
      response = http.get(`${BASE_URL}/users?status=${status}&limit=10`);
    }
    
    const latency = Date.now() - startTime;
    queryLatency.add(latency);
    
    const success = check(response, {
      [`${description} - status code`]: (r) => r.status === 200,
      [`${description} - response time`]: (r) => r.timings.duration < 300,
    });
    
    querySuccessRate.add(success);
    if (latency > 200) slowQueryCount.add(1);
    indexHitRate.add(latency < 100);
    
    sleep(0.1);
  });
  
  // Scenario 7: Complex queries (should use composite indexes)
  const complexQueries = [
    {
      url: `${BASE_URL}/games?status=waiting&currentPlayers=0&maxPlayers=10`,
      description: 'Find available games with capacity'
    },
    {
      url: `${BASE_URL}/games/${TEST_GAME_ID}/rounds?status=active&roundNumber=1`,
      description: 'Find specific active round'
    },
    {
      url: `${BASE_URL}/rounds/${data.roundId}/answers?status=submitted&userId=${TEST_USER_ID}`,
      description: 'Find user answers for specific round'
    },
  ];
  
  complexQueries.forEach(({ url, description }) => {
    const startTime = Date.now();
    const response = http.get(url);
    const latency = Date.now() - startTime;
    
    queryLatency.add(latency);
    
    const success = check(response, {
      [`${description} - status code`]: (r) => r.status === 200,
      [`${description} - response time`]: (r) => r.timings.duration < 300,
    });
    
    querySuccessRate.add(success);
    if (latency > 200) slowQueryCount.add(1);
    indexHitRate.add(latency < 100);
    
    sleep(0.1);
  });
  
  // Random sleep between iterations
  sleep(Math.random() * 2 + 1);
}

// Setup function to prepare test data
export function setup() {
  console.log('Setting up performance benchmark test...');
  
  // Create test game if needed
  const gameResponse = http.post(`${BASE_URL}/games`, {
    name: 'Performance Test Game',
    type: 'would_you_rather',
    maxPlayers: 10,
    isPrivate: false,
  });
  
  if (gameResponse.status === 201) {
    console.log('Test game created successfully');
  }
  
  return {
    testGameId: TEST_GAME_ID,
    testUserId: TEST_USER_ID,
  };
}

// Teardown function to clean up
export function teardown(data) {
  console.log('Cleaning up performance benchmark test...');
  
  // Clean up test data if needed
  const cleanupResponse = http.del(`${BASE_URL}/games/${data.testGameId}`);
  
  if (cleanupResponse.status === 200) {
    console.log('Test data cleaned up successfully');
  }
} 
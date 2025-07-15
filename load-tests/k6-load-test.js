import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';
import { WebSocket } from 'k6/ws';
import { randomIntBetween } from 'k6/utils';

// Custom metrics
const wsLatency = new Trend('ws_latency_ms');
const wsMessages = new Counter('ws_messages_total');
const roomCreationRate = new Rate('room_creation_success');
const gameJoinRate = new Rate('game_join_success');
const questionFlagRate = new Rate('question_flag_success');

// Test configuration
export const options = {
  stages: [
    // Ramp up to 1000 concurrent users over 2 minutes
    { duration: '2m', target: 1000 },
    // Maintain 1000 concurrent users for 10 minutes
    { duration: '10m', target: 1000 },
    // Ramp down over 2 minutes
    { duration: '2m', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<300'], // 95% of requests should be below 300ms
    http_req_failed: ['rate<0.05'],   // Error rate should be below 5%
    ws_latency_ms: ['p(95)<100'],     // WebSocket latency should be below 100ms
    room_creation_success: ['rate>0.95'], // Room creation success rate > 95%
    game_join_success: ['rate>0.95'],      // Game join success rate > 95%
  },
};

// Test data
const BASE_URL = __ENV.API_URL || 'http://localhost:3001';
const WS_URL = __ENV.WS_URL || 'ws://localhost:3001/game';

// Simulate different user behaviors
const userBehaviors = {
  ROOM_CREATOR: 'room_creator',
  PLAYER: 'player',
  SPECTATOR: 'spectator',
};

// Generate random user data
function generateUserData() {
  const firstNames = ['Alice', 'Bob', 'Charlie', 'Diana', 'Eve', 'Frank', 'Grace', 'Henry'];
  const lastNames = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller'];
  
  return {
    firstName: firstNames[randomIntBetween(0, firstNames.length - 1)],
    lastName: lastNames[randomIntBetween(0, lastNames.length - 1)],
    username: `user_${randomIntBetween(1000, 9999)}`,
  };
}

// Create a game room
function createGameRoom(userData) {
  const payload = {
    name: `Test Game ${randomIntBetween(1, 1000)}`,
    type: 'would_you_rather',
    maxPlayers: randomIntBetween(4, 8),
    roundsPerGame: randomIntBetween(3, 5),
    timePerRound: 30,
    isPrivate: false,
    chillMode: Math.random() > 0.5, // 50% chance of chill mode
  };

  const response = http.post(`${BASE_URL}/api/games`, JSON.stringify(payload), {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${userData.token || 'test-token'}`,
    },
  });

  const success = check(response, {
    'room creation successful': (r) => r.status === 201,
    'room creation response time < 500ms': (r) => r.timings.duration < 500,
  });

  roomCreationRate.add(success);

  if (success && response.status === 201) {
    const gameData = JSON.parse(response.body);
    return {
      gameId: gameData.id,
      gameCode: gameData.code,
      success: true,
    };
  }

  return { success: false };
}

// Join a game room
function joinGameRoom(userData, gameCode) {
  const payload = {
    gameCode,
    playerName: `${userData.firstName} ${userData.lastName}`,
    isSpectator: userData.behavior === userBehaviors.SPECTATOR,
  };

  const response = http.post(`${BASE_URL}/api/games/join`, JSON.stringify(payload), {
    headers: {
      'Content-Type': 'application/json',
    },
  });

  const success = check(response, {
    'game join successful': (r) => r.status === 200,
    'game join response time < 300ms': (r) => r.timings.duration < 300,
  });

  gameJoinRate.add(success);

  if (success && response.status === 200) {
    const joinData = JSON.parse(response.body);
    return {
      playerId: joinData.playerId,
      gameId: joinData.gameId,
      success: true,
    };
  }

  return { success: false };
}

// WebSocket connection and game simulation
function simulateGameSession(userData, gameData) {
  const wsUrl = `${WS_URL}?gameId=${gameData.gameId}&playerId=${gameData.playerId}`;
  
  const ws = new WebSocket(wsUrl);
  
  ws.on('open', () => {
    console.log(`WebSocket connected for user ${userData.username}`);
    
    // Send initial connection message
    const connectMsg = {
      type: 'player_connected',
      data: {
        playerId: gameData.playerId,
        gameId: gameData.gameId,
      },
    };
    
    const startTime = Date.now();
    ws.send(JSON.stringify(connectMsg));
    
    // Simulate game activity
    const gameInterval = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        // Simulate random game actions
        const actions = [
          { type: 'ping', data: { timestamp: Date.now() } },
          { type: 'get_manifest', data: { gameId: gameData.gameId } },
          { type: 'player_ready', data: { playerId: gameData.playerId } },
        ];
        
        const action = actions[randomIntBetween(0, actions.length - 1)];
        ws.send(JSON.stringify(action));
        wsMessages.add(1);
      }
    }, randomIntBetween(5000, 15000)); // Random interval between 5-15 seconds
    
    // Clean up interval on close
    ws.on('close', () => {
      clearInterval(gameInterval);
    });
  });
  
  ws.on('message', (data) => {
    const endTime = Date.now();
    const message = JSON.parse(data);
    
    // Record WebSocket latency
    if (message.timestamp) {
      const latency = endTime - message.timestamp;
      wsLatency.add(latency);
    }
    
    // Simulate flagging questions occasionally
    if (message.type === 'question_displayed' && Math.random() < 0.01) {
      // 1% chance to flag a question
      flagQuestion(userData, message.data.questionId);
    }
  });
  
  ws.on('error', (e) => {
    console.error(`WebSocket error for user ${userData.username}:`, e);
  });
  
  return ws;
}

// Flag a question
function flagQuestion(userData, questionId) {
  const payload = {
    questionId,
    reason: 'inappropriate',
    details: 'Load test flag',
  };

  const response = http.post(`${BASE_URL}/api/questions/${questionId}/flag`, JSON.stringify(payload), {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${userData.token || 'test-token'}`,
    },
  });

  const success = check(response, {
    'question flag successful': (r) => r.status === 200,
  });

  questionFlagRate.add(success);
}

// Main test function
export default function() {
  const userData = generateUserData();
  userData.behavior = Object.values(userBehaviors)[randomIntBetween(0, 2)];
  
  // Create or join a game room
  let gameData;
  
  if (userData.behavior === userBehaviors.ROOM_CREATOR) {
    // Create a new room
    gameData = createGameRoom(userData);
    if (!gameData.success) {
      console.error('Failed to create game room');
      return;
    }
    
    // Join the room we just created
    const joinData = joinGameRoom(userData, gameData.gameCode);
    if (!joinData.success) {
      console.error('Failed to join created game room');
      return;
    }
    
    gameData = { ...gameData, ...joinData };
  } else {
    // Join an existing room (simulate by creating one first)
    const roomData = createGameRoom(userData);
    if (!roomData.success) {
      console.error('Failed to create game room for joining');
      return;
    }
    
    const joinData = joinGameRoom(userData, roomData.gameCode);
    if (!joinData.success) {
      console.error('Failed to join game room');
      return;
    }
    
    gameData = { ...roomData, ...joinData };
  }
  
  // Simulate game session
  const ws = simulateGameSession(userData, gameData);
  
  // Keep the connection alive for the duration of the test
  sleep(randomIntBetween(30, 60)); // Random sleep between 30-60 seconds
  
  // Close WebSocket connection
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.close();
  }
}

// Setup and teardown functions
export function setup() {
  console.log('Setting up load test...');
  console.log(`API URL: ${BASE_URL}`);
  console.log(`WebSocket URL: ${WS_URL}`);
  
  // Verify API is accessible
  const healthCheck = http.get(`${BASE_URL}/health`);
  check(healthCheck, {
    'API is accessible': (r) => r.status === 200,
  });
  
  return { baseUrl: BASE_URL, wsUrl: WS_URL };
}

export function teardown(data) {
  console.log('Cleaning up load test...');
} 
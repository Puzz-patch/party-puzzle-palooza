#!/usr/bin/env node

const { chromium } = require('playwright');
const axios = require('axios');

// Configuration
const config = {
  apiUrl: process.env.API_URL || 'http://localhost:3001',
  webUrl: process.env.WEB_URL || 'http://localhost:5173',
  databaseUrl: process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5432/party_puzzle_palooza_test',
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
  timeout: 30000,
  headless: true
};

// Test state
let gameId = null;
let playerTokens = [];
let roundId = null;

// Utility functions
const log = (message) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${message}`);
};

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const apiRequest = async (method, endpoint, data = null, headers = {}) => {
  try {
    const response = await axios({
      method,
      url: `${config.apiUrl}${endpoint}`,
      data,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      },
      timeout: config.timeout
    });
    return response.data;
  } catch (error) {
    log(`API Error: ${method} ${endpoint} - ${error.message}`);
    throw error;
  }
};

// Test functions
const testHealthCheck = async () => {
  log('🔍 Testing health check...');
  const health = await apiRequest('GET', '/health');
  
  if (health.status !== 'ok') {
    throw new Error(`Health check failed: ${JSON.stringify(health)}`);
  }
  
  log('✅ Health check passed');
};

const testGameCreation = async () => {
  log('🎮 Testing game creation...');
  
  // Create a new game via API
  const gameData = await apiRequest('POST', '/games', {
    name: 'E2E Test Game',
    maxPlayers: 4,
    chillMode: false
  });
  
  gameId = gameData.id;
  log(`✅ Game created with ID: ${gameId}`);
  
  return gameId;
};

const testPlayerJoining = async () => {
  log('👥 Testing player joining...');
  
  const players = [
    { name: 'Alice', avatar: '🐰' },
    { name: 'Bob', avatar: '🐻' },
    { name: 'Charlie', avatar: '🐸' },
    { name: 'Diana', avatar: '🦊' }
  ];
  
  for (let i = 0; i < players.length; i++) {
    const player = players[i];
    const joinData = await apiRequest('POST', `/games/${gameId}/join`, {
      name: player.name,
      avatar: player.avatar
    });
    
    playerTokens.push(joinData.token);
    log(`✅ ${player.name} joined with token: ${joinData.token.substring(0, 8)}...`);
    
    // Wait a bit between joins
    await sleep(500);
  }
  
  // Verify all players are in the game
  const manifest = await apiRequest('GET', `/games/${gameId}/manifest`);
  
  if (manifest.players.length !== 4) {
    throw new Error(`Expected 4 players, got ${manifest.players.length}`);
  }
  
  log('✅ All players joined successfully');
};

const testCustomQuestionSubmission = async () => {
  log('❓ Testing custom question submission...');
  
  const questions = [
    'Would you rather have the ability to fly or be invisible?',
    'Would you rather travel to the past or the future?',
    'Would you rather be a famous actor or a successful entrepreneur?',
    'Would you rather have unlimited money or unlimited knowledge?'
  ];
  
  for (let i = 0; i < questions.length; i++) {
    const question = questions[i];
    const playerToken = playerTokens[i];
    
    await apiRequest('POST', `/games/${gameId}/questions/custom`, {
      question: question,
      category: 'fun'
    }, {
      'Cookie': `player_token=${playerToken}`
    });
    
    log(`✅ Question submitted by player ${i + 1}: "${question.substring(0, 50)}..."`);
    
    // Wait between submissions to avoid rate limiting
    await sleep(1000);
  }
  
  // Verify questions were added
  const manifest = await apiRequest('GET', `/games/${gameId}/manifest`);
  
  if (manifest.questions.length < 4) {
    throw new Error(`Expected at least 4 questions, got ${manifest.questions.length}`);
  }
  
  log('✅ All custom questions submitted successfully');
};

const testGameStateTransition = async () => {
  log('🔄 Testing game state transitions...');
  
  // Transition to question_build state
  await apiRequest('POST', `/games/${gameId}/state/transition`, {
    targetState: 'question_build'
  });
  
  log('✅ Transitioned to question_build state');
  
  // Wait for all players to have questions
  let attempts = 0;
  while (attempts < 30) {
    const manifest = await apiRequest('GET', `/games/${gameId}/manifest`);
    
    if (manifest.questions.length >= 4) {
      log('✅ All players have submitted questions');
      break;
    }
    
    log(`⏳ Waiting for questions... (${manifest.questions.length}/4)`);
    await sleep(2000);
    attempts++;
  }
  
  if (attempts >= 30) {
    throw new Error('Timeout waiting for all players to submit questions');
  }
  
  // Transition to gameplay state
  await apiRequest('POST', `/games/${gameId}/state/transition`, {
    targetState: 'gameplay'
  });
  
  log('✅ Transitioned to gameplay state');
};

const testRoundExecution = async () => {
  log('🎯 Testing round execution...');
  
  // Start a new round
  const roundData = await apiRequest('POST', `/rounds/start`, {
    gameId: gameId
  });
  
  roundId = roundData.id;
  log(`✅ Round started with ID: ${roundId}`);
  
  // Set target player (first player targets second player)
  await apiRequest('POST', `/rounds/${roundId}/target`, {
    targetPlayerId: roundData.players[1].id
  }, {
    'Cookie': `player_token=${playerTokens[0]}`
  });
  
  log('✅ Target player set');
  
  // Wait for reveal phase
  await sleep(3000);
  
  // Take a shot (deduct tokens)
  const shotResult = await apiRequest('POST', `/rounds/${roundId}/shot`, {}, {
    'Cookie': `player_token=${playerTokens[0]}`
  });
  
  log(`✅ Shot taken, tokens remaining: ${shotResult.tokensRemaining}`);
  
  // Submit player actions
  const actions = ['roll', 'force', 'shield'];
  for (let i = 1; i < 4; i++) {
    const action = actions[i - 1];
    await apiRequest('POST', `/rounds/${roundId}/actions`, {
      action: action
    }, {
      'Cookie': `player_token=${playerTokens[i]}`
    });
    
    log(`✅ Player ${i + 1} submitted action: ${action}`);
    await sleep(500);
  }
  
  // Wait for round to complete
  await sleep(5000);
  
  log('✅ Round execution completed');
};

const testGameFinale = async () => {
  log('🏆 Testing game finale...');
  
  // Trigger finale
  const finaleResult = await apiRequest('POST', `/games/${gameId}/finale`);
  
  if (!finaleResult.completed) {
    throw new Error('Game finale failed to complete');
  }
  
  log('✅ Game finale completed');
  log(`📊 Final scores: ${JSON.stringify(finaleResult.scores)}`);
  log(`🎁 Tokens distributed: ${JSON.stringify(finaleResult.tokenDistribution)}`);
};

const testWebInterface = async () => {
  log('🌐 Testing web interface...');
  
  const browser = await chromium.launch({ 
    headless: config.headless,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  try {
    const context = await browser.newContext();
    const page = await context.newPage();
    
    // Navigate to the web app
    await page.goto(config.webUrl);
    log('✅ Web app loaded');
    
    // Wait for the page to be ready
    await page.waitForSelector('[data-testid="create-room"]', { timeout: 10000 });
    log('✅ Create room button found');
    
    // Create a room
    await page.click('[data-testid="create-room"]');
    await page.waitForSelector('[data-testid="room-lobby"]', { timeout: 10000 });
    log('✅ Room created and lobby loaded');
    
    // Get the room ID from the URL
    const url = page.url();
    const roomId = url.split('/').pop();
    log(`✅ Room ID from URL: ${roomId}`);
    
    // Open a new tab for the second player
    const page2 = await context.newPage();
    await page2.goto(`${config.webUrl}/room/${roomId}`);
    await page2.waitForSelector('[data-testid="join-room"]', { timeout: 10000 });
    
    // Join as second player
    await page2.fill('[data-testid="player-name"]', 'E2E Player 2');
    await page2.click('[data-testid="join-room"]');
    await page2.waitForSelector('[data-testid="room-lobby"]', { timeout: 10000 });
    log('✅ Second player joined');
    
    // Wait for both players to be visible
    await page.waitForSelector('[data-testid="player-avatar"]', { timeout: 10000 });
    await page2.waitForSelector('[data-testid="player-avatar"]', { timeout: 10000 });
    
    const playerCount = await page.locator('[data-testid="player-avatar"]').count();
    log(`✅ Found ${playerCount} players in lobby`);
    
    // Take a screenshot
    await page.screenshot({ path: 'test-results/lobby-screenshot.png' });
    log('✅ Screenshot saved');
    
  } finally {
    await browser.close();
  }
  
  log('✅ Web interface test completed');
};

const testWebSocketConnection = async () => {
  log('🔌 Testing WebSocket connection...');
  
  const WebSocket = require('ws');
  
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`${config.apiUrl.replace('http', 'ws')}/game`);
    
    ws.on('open', () => {
      log('✅ WebSocket connection established');
      
      // Subscribe to game room
      ws.send(JSON.stringify({
        type: 'SUBSCRIBE',
        gameId: gameId
      }));
      
      log('✅ Subscribed to game room');
      
      // Wait for subscription confirmation
      setTimeout(() => {
        ws.close();
        resolve();
      }, 2000);
    });
    
    ws.on('message', (data) => {
      const message = JSON.parse(data.toString());
      log(`📨 WebSocket message received: ${message.type}`);
    });
    
    ws.on('error', (error) => {
      log(`❌ WebSocket error: ${error.message}`);
      reject(error);
    });
    
    ws.on('close', () => {
      log('✅ WebSocket connection closed');
    });
  });
};

const testDatabaseIntegrity = async () => {
  log('🗄️ Testing database integrity...');
  
  // Check that game exists
  const manifest = await apiRequest('GET', `/games/${gameId}/manifest`);
  
  if (!manifest.id) {
    throw new Error('Game not found in database');
  }
  
  if (manifest.players.length !== 4) {
    throw new Error(`Expected 4 players, got ${manifest.players.length}`);
  }
  
  if (manifest.questions.length < 4) {
    throw new Error(`Expected at least 4 questions, got ${manifest.questions.length}`);
  }
  
  log('✅ Database integrity verified');
};

// Main test runner
const runTests = async () => {
  const startTime = Date.now();
  
  try {
    log('🚀 Starting E2E test suite...');
    
    // Create test results directory
    const fs = require('fs');
    if (!fs.existsSync('test-results')) {
      fs.mkdirSync('test-results');
    }
    
    // Run tests in sequence
    await testHealthCheck();
    await testGameCreation();
    await testPlayerJoining();
    await testCustomQuestionSubmission();
    await testGameStateTransition();
    await testRoundExecution();
    await testGameFinale();
    await testWebSocketConnection();
    await testWebInterface();
    await testDatabaseIntegrity();
    
    const duration = (Date.now() - startTime) / 1000;
    log(`🎉 All tests passed! Duration: ${duration.toFixed(2)}s`);
    
    // Write test summary
    const summary = {
      status: 'PASSED',
      duration: duration,
      gameId: gameId,
      roundId: roundId,
      playerCount: playerTokens.length,
      timestamp: new Date().toISOString()
    };
    
    fs.writeFileSync('test-results/summary.json', JSON.stringify(summary, null, 2));
    log('✅ Test summary written to test-results/summary.json');
    
  } catch (error) {
    const duration = (Date.now() - startTime) / 1000;
    log(`❌ Test failed after ${duration.toFixed(2)}s: ${error.message}`);
    
    // Write error summary
    const fs = require('fs');
    const summary = {
      status: 'FAILED',
      duration: duration,
      error: error.message,
      timestamp: new Date().toISOString()
    };
    
    if (!fs.existsSync('test-results')) {
      fs.mkdirSync('test-results');
    }
    
    fs.writeFileSync('test-results/summary.json', JSON.stringify(summary, null, 2));
    
    process.exit(1);
  }
};

// Run the tests
runTests(); 
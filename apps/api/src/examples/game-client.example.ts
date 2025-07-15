import { io, Socket } from 'socket.io-client';
import { GameMessageType } from '../dto/game-message.dto';

/**
 * Example client for connecting to the Party Puzzle Palooza Game Gateway
 * This demonstrates how to use the real-time game communication system
 */
class GameClient {
  private socket: Socket;
  private gameId: string;
  private userId: string;
  private username: string;

  constructor(gameId: string, userId: string, username: string) {
    this.gameId = gameId;
    this.userId = userId;
    this.username = username;
    
    // Connect to the game gateway
    this.socket = io('http://localhost:3001/game', {
      query: {
        gameId: this.gameId,
        userId: this.userId,
      },
      transports: ['websocket', 'polling'],
    });

    this.setupEventListeners();
  }

  private setupEventListeners() {
    // Connection events
    this.socket.on('connect', () => {
      console.log('✅ Connected to game gateway');
      this.subscribeToGame();
    });

    this.socket.on('disconnect', () => {
      console.log('❌ Disconnected from game gateway');
    });

    this.socket.on('connect_error', (error) => {
      console.error('❌ Connection error:', error);
    });

    // Game events
    this.socket.on('subscribed', (data) => {
      console.log('🎮 Subscribed to game:', data);
    });

    this.socket.on('unsubscribed', (data) => {
      console.log('👋 Unsubscribed from game:', data);
    });

    this.socket.on('game_message', (message) => {
      this.handleGameMessage(message);
    });

    this.socket.on('error', (error) => {
      console.error('❌ Game error:', error);
    });
  }

  private handleGameMessage(message: any) {
    console.log('📨 Received game message:', message);

    switch (message.type) {
      case GameMessageType.PLAYER_JOIN:
        console.log(`👋 ${message.username || message.userId} joined the game`);
        break;

      case GameMessageType.PLAYER_LEAVE:
        console.log(`👋 ${message.username || message.userId} left the game`);
        break;

      case GameMessageType.GAME_UPDATE:
        console.log('🔄 Game state updated with patches:', message.patches);
        break;

      case GameMessageType.ROUND_START:
        console.log('🎯 Round started:', message.data);
        break;

      case GameMessageType.ROUND_END:
        console.log('🏁 Round ended:', message.data);
        break;

      case GameMessageType.ANSWER_SUBMIT:
        console.log(`💭 ${message.username || message.userId} submitted answer:`, message.answer);
        break;

      case GameMessageType.CHAT_MESSAGE:
        console.log(`💬 ${message.username || message.userId}: ${message.message}`);
        break;

      default:
        console.log('📨 Unknown message type:', message.type);
    }
  }

  /**
   * Subscribe to a game room
   */
  subscribeToGame() {
    this.socket.emit('subscribe', {
      gameId: this.gameId,
      userId: this.userId,
      username: this.username,
    });
  }

  /**
   * Unsubscribe from a game room
   */
  unsubscribeFromGame() {
    this.socket.emit('unsubscribe', {
      gameId: this.gameId,
    });
  }

  /**
   * Send a game update with JSON patches
   */
  sendGameUpdate(patches: any[]) {
    this.socket.emit('game_update', {
      gameId: this.gameId,
      patches: patches,
      timestamp: Date.now(),
    });
  }

  /**
   * Send a player action
   */
  sendPlayerAction(action: string, data?: any) {
    this.socket.emit('player_action', {
      gameId: this.gameId,
      userId: this.userId,
      action: action,
      data: data,
    });
  }

  /**
   * Send a chat message
   */
  sendChatMessage(message: string) {
    this.socket.emit('chat_message', {
      gameId: this.gameId,
      userId: this.userId,
      message: message,
      username: this.username,
    });
  }

  /**
   * Submit an answer for a round
   */
  submitAnswer(answer: string, roundId: string) {
    this.socket.emit('answer_submit', {
      gameId: this.gameId,
      userId: this.userId,
      answer: answer,
      roundId: roundId,
    });
  }

  /**
   * Disconnect from the gateway
   */
  disconnect() {
    this.socket.disconnect();
  }

  /**
   * Get connection status
   */
  isConnected(): boolean {
    return this.socket.connected;
  }
}

// Example usage
async function runExample() {
  console.log('🎮 Party Puzzle Palooza Game Client Example');
  console.log('==========================================');

  // Create a client
  const client = new GameClient(
    'demo-game-id',
    'demo-user-id',
    'DemoPlayer'
  );

  // Wait for connection
  await new Promise(resolve => {
    client.socket.on('connect', resolve);
  });

  // Subscribe to game
  client.subscribeToGame();

  // Wait a bit then send some messages
  setTimeout(() => {
    console.log('\n📤 Sending example messages...');

    // Send a chat message
    client.sendChatMessage('Hello everyone! 👋');

    // Send a game update (example: player ready)
    client.sendGameUpdate([
      {
        op: 'add',
        path: '/players/ready',
        value: true,
      },
    ]);

    // Send a player action
    client.sendPlayerAction('ready', { timestamp: Date.now() });

    // Submit an answer
    client.submitAnswer('Canberra', 'round-1');

  }, 2000);

  // Keep the connection alive for a while
  setTimeout(() => {
    console.log('\n👋 Disconnecting...');
    client.disconnect();
    process.exit(0);
  }, 10000);
}

// Run the example if this file is executed directly
if (require.main === module) {
  runExample().catch(console.error);
}

export { GameClient }; 
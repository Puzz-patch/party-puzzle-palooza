import { useGameStore } from '../stores/game-store';
import { WebSocketMessage, GamePatch, validateWebSocketMessage, validateGamePatch } from '@party-puzzle-palooza/shared';

class RealtimeService {
  private ws: WebSocket | null = null;
  private gameId: string | null = null;
  private reconnectTimeout: NodeJS.Timeout | null = null;

  connect(gameId: string) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN && this.gameId === gameId) {
      return;
    }

    if (this.ws) {
      this.disconnect();
    }
    
    this.gameId = gameId;
    const wsUrl = process.env.NODE_ENV === 'production' 
      ? `wss://your-api-domain.com/game/${this.gameId}`
      : `ws://localhost:3001/game/${this.gameId}`;

    this.ws = new WebSocket(wsUrl);

    this.ws.onopen = () => {
      console.log('WebSocket connected');
      this.subscribe(gameId);
      if (this.reconnectTimeout) {
        clearTimeout(this.reconnectTimeout);
        this.reconnectTimeout = null;
      }
    };

    this.ws.onmessage = (event) => {
      try {
        const message = validateWebSocketMessage(JSON.parse(event.data));
        console.log('WebSocket message received:', message);
        
        if (message.type.startsWith('round_') || message.type.startsWith('responder_') || message.type.startsWith('phase_') || message.type === 'game_finale') {
          useGameStore.getState().handleRealtimeEvent(message);
        } else {
          const patch = validateGamePatch(message);
          useGameStore.getState().applyPatch(patch);
        }
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    };

    this.ws.onclose = () => {
      console.log('WebSocket disconnected');
      if (this.gameId) {
        this.reconnectTimeout = setTimeout(() => this.connect(this.gameId!), 3000);
      }
    };

    this.ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };
  }

  disconnect() {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.gameId = null;
  }

  sendMessage(message: WebSocketMessage) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    } else {
      console.warn('WebSocket is not connected');
    }
  }
  
  private subscribe(gameId: string) {
    this.sendMessage({
      type: 'subscribe',
      data: { gameId },
      timestamp: Date.now(),
    });
  }

  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }
}

export const realtimeService = new RealtimeService(); 
import { useEffect, useState, useCallback } from 'react';
import { realtimeService } from '../services/realtime-service';

interface WebSocketMessage {
  type: string;
  data: unknown;
  timestamp: number;
}

export const useWebSocket = (gameId: string) => {
  const [isConnected, setIsConnected] = useState(realtimeService.isConnected());

  useEffect(() => {
    realtimeService.connect(gameId);

    const interval = setInterval(() => {
      const currentStatus = realtimeService.isConnected();
      if (currentStatus !== isConnected) {
        setIsConnected(currentStatus);
      }
    }, 500);

    return () => {
      clearInterval(interval);
      realtimeService.disconnect();
    };
  }, [gameId, isConnected]);

  const sendMessage = useCallback((message: WebSocketMessage) => {
    realtimeService.sendMessage(message);
  }, []);

  return {
    sendMessage,
    isConnected,
  };
}; 
import { useState, useCallback } from 'react';
import { useWebSocket } from './useWebSocket';
import { useToast } from './use-toast';

interface PlayerFinalScore {
  playerId: string;
  username: string;
  firstName: string;
  lastName: string;
  finalScore: number;
  correctAnswers: number;
  totalAnswers: number;
  unusedPromptTokens: number;
  rank: number;
  stats: Record<string, any>;
}

interface GameFinaleResult {
  gameId: string;
  gameName: string;
  gameCode: string;
  totalRounds: number;
  deckUsagePercentage: number;
  deckUsageRequirementMet: boolean;
  winner?: PlayerFinalScore;
  playerScores: PlayerFinalScore[];
  totalUnusedPromptTokens: number;
  completedAt: string;
  gameStats: Record<string, any>;
}

interface UseGameFinaleProps {
  gameId: string;
}

export const useGameFinale = ({ gameId }: UseGameFinaleProps) => {
  const [isFinalizing, setIsFinalizing] = useState(false);
  const [finaleResult, setFinaleResult] = useState<GameFinaleResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { socket, isConnected } = useWebSocket();
  const { toast } = useToast();

  // Finalize the game
  const finalizeGame = useCallback(async () => {
    setIsFinalizing(true);
    setError(null);

    try {
      const response = await fetch(`/api/games/${gameId}/finale`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to finalize game');
      }

      const data = await response.json();
      setFinaleResult(data.data);

      toast({
        title: 'Game Finalized! 🎉',
        description: data.message,
        variant: 'default',
      });

      return data.data;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      
      toast({
        title: 'Finalization Failed ❌',
        description: errorMessage,
        variant: 'destructive',
      });

      throw err;
    } finally {
      setIsFinalizing(false);
    }
  }, [gameId, toast]);

  // Listen for finale events from WebSocket
  const handleFinaleEvent = useCallback((data: any) => {
    if (data.type === 'game_finale' && data.data.gameId === gameId) {
      setFinaleResult(data.data);
      
      toast({
        title: 'Game Finalized! 🎉',
        description: `Winner: ${data.data.winner.username} with ${data.data.winner.finalScore} points!`,
        variant: 'default',
      });
    }
  }, [gameId, toast]);

  // Set up WebSocket listener
  if (socket && isConnected) {
    socket.on('game_finale', handleFinaleEvent);
  }

  // Get winner information
  const getWinner = useCallback(() => {
    return finaleResult?.winner;
  }, [finaleResult]);

  // Get player by rank
  const getPlayerByRank = useCallback((rank: number) => {
    return finaleResult?.playerScores.find(player => player.rank === rank);
  }, [finaleResult]);

  // Get top players
  const getTopPlayers = useCallback((count: number = 3) => {
    return finaleResult?.playerScores.slice(0, count) || [];
  }, [finaleResult]);

  // Check if deck usage requirement was met
  const isDeckUsageRequirementMet = useCallback(() => {
    return finaleResult?.deckUsageRequirementMet || false;
  }, [finaleResult]);

  // Get deck usage status
  const getDeckUsageStatus = useCallback(() => {
    if (!finaleResult) return null;
    
    return {
      percentage: finaleResult.deckUsagePercentage,
      requirementMet: finaleResult.deckUsageRequirementMet,
      status: finaleResult.deckUsageRequirementMet ? 'success' : 'warning' as const
    };
  }, [finaleResult]);

  // Get total tokens distributed
  const getTotalTokensDistributed = useCallback(() => {
    return finaleResult?.totalUnusedPromptTokens || 0;
  }, [finaleResult]);

  // Get game statistics
  const getGameStats = useCallback(() => {
    return finaleResult?.gameStats || {};
  }, [finaleResult]);

  // Check if game is finalized
  const isGameFinalized = useCallback(() => {
    return finaleResult !== null;
  }, [finaleResult]);

  // Get completion time
  const getCompletionTime = useCallback(() => {
    if (!finaleResult?.completedAt) return null;
    return new Date(finaleResult.completedAt);
  }, [finaleResult]);

  // Format completion time
  const getFormattedCompletionTime = useCallback(() => {
    const completionTime = getCompletionTime();
    if (!completionTime) return '';
    
    return completionTime.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  }, [getCompletionTime]);

  // Get player statistics summary
  const getPlayerStatsSummary = useCallback(() => {
    if (!finaleResult?.playerScores) return null;

    const scores = finaleResult.playerScores;
    const totalPlayers = scores.length;
    const averageScore = scores.reduce((sum, p) => sum + p.finalScore, 0) / totalPlayers;
    const highestScore = Math.max(...scores.map(p => p.finalScore));
    const lowestScore = Math.min(...scores.map(p => p.finalScore));
    const totalCorrectAnswers = scores.reduce((sum, p) => sum + p.correctAnswers, 0);
    const totalAnswers = scores.reduce((sum, p) => sum + p.totalAnswers, 0);
    const averageAccuracy = totalAnswers > 0 ? (totalCorrectAnswers / totalAnswers) * 100 : 0;

    return {
      totalPlayers,
      averageScore: Math.round(averageScore * 100) / 100,
      highestScore,
      lowestScore,
      averageAccuracy: Math.round(averageAccuracy * 100) / 100,
      totalCorrectAnswers,
      totalAnswers
    };
  }, [finaleResult]);

  return {
    // State
    isFinalizing,
    finaleResult,
    error,
    
    // Actions
    finalizeGame,
    
    // Computed values
    winner: getWinner(),
    topPlayers: getTopPlayers(),
    deckUsageStatus: getDeckUsageStatus(),
    totalTokensDistributed: getTotalTokensDistributed(),
    gameStats: getGameStats(),
    playerStatsSummary: getPlayerStatsSummary(),
    completionTime: getCompletionTime(),
    formattedCompletionTime: getFormattedCompletionTime(),
    
    // Utility functions
    getPlayerByRank,
    isDeckUsageRequirementMet,
    isGameFinalized,
    
    // Data
    hasFinaleResult: finaleResult !== null,
    canFinalize: !isFinalizing && !finaleResult
  };
}; 
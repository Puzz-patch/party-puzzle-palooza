import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from './use-toast';

interface UsePlayAgainProps {
  gameId: string;
  onResetGame?: () => Promise<void>;
}

export const usePlayAgain = ({ gameId, onResetGame }: UsePlayAgainProps) => {
  const [isResetting, setIsResetting] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const resetAndPlayAgain = useCallback(async () => {
    setIsResetting(true);

    try {
      // Step 1: Reset the current game to lobby state
      if (onResetGame) {
        await onResetGame();
      } else {
        // Default reset behavior - call API to reset game
        const response = await fetch(`/api/games/${gameId}/reset`, {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) {
          throw new Error('Failed to reset game');
        }
      }

      // Step 2: Show success message
      toast({
        title: 'Game Reset! 🔄',
        description: 'The game has been reset to lobby state. Ready for a new round!',
        variant: 'default',
      });

      // Step 3: Navigate to the game lobby
      navigate(`/game/${gameId}/lobby`);

    } catch (error) {
      console.error('Error resetting game:', error);
      
      toast({
        title: 'Reset Failed ❌',
        description: error instanceof Error ? error.message : 'Failed to reset game',
        variant: 'destructive',
      });

      // Fallback: navigate to lobby anyway
      navigate(`/game/${gameId}/lobby`);
    } finally {
      setIsResetting(false);
    }
  }, [gameId, onResetGame, navigate, toast]);

  const createNewGame = useCallback(async () => {
    setIsResetting(true);

    try {
      // Create a new game
      const response = await fetch('/api/games', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: 'New Game',
          type: 'would_you_rather',
          maxPlayers: 8,
          roundsPerGame: 5,
          timePerRound: 30,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create new game');
      }

      const data = await response.json();
      const newGameId = data.id;

      toast({
        title: 'New Game Created! 🎮',
        description: `Game code: ${data.code}`,
        variant: 'default',
      });

      // Navigate to the new game
      navigate(`/game/${newGameId}/lobby`);

    } catch (error) {
      console.error('Error creating new game:', error);
      
      toast({
        title: 'Creation Failed ❌',
        description: error instanceof Error ? error.message : 'Failed to create new game',
        variant: 'destructive',
      });
    } finally {
      setIsResetting(false);
    }
  }, [navigate, toast]);

  const joinRandomGame = useCallback(async () => {
    setIsResetting(true);

    try {
      // Find available games
      const response = await fetch('/api/games/available', {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to find available games');
      }

      const data = await response.json();
      const availableGames = data.games || [];

      if (availableGames.length === 0) {
        // No available games, create a new one
        await createNewGame();
        return;
      }

      // Join a random available game
      const randomGame = availableGames[Math.floor(Math.random() * availableGames.length)];
      
      const joinResponse = await fetch(`/api/games/${randomGame.id}/join`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!joinResponse.ok) {
        throw new Error('Failed to join game');
      }

      toast({
        title: 'Joined Game! 🎯',
        description: `Joined: ${randomGame.name} (${randomGame.code})`,
        variant: 'default',
      });

      // Navigate to the joined game
      navigate(`/game/${randomGame.id}/lobby`);

    } catch (error) {
      console.error('Error joining random game:', error);
      
      toast({
        title: 'Join Failed ❌',
        description: error instanceof Error ? error.message : 'Failed to join game',
        variant: 'destructive',
      });

      // Fallback: create new game
      await createNewGame();
    } finally {
      setIsResetting(false);
    }
  }, [createNewGame, navigate, toast]);

  return {
    // State
    isResetting,
    
    // Actions
    resetAndPlayAgain,
    createNewGame,
    joinRandomGame,
    
    // Utility
    canReset: !isResetting
  };
}; 
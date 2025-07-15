import { useEffect, useRef, useState, useCallback } from 'react';
import { useGameStore, useGame } from '../stores/game-store';

interface ManifestDiff {
  hasChanges: boolean;
  newQuestions?: number;
  newPlayers?: number;
  allPlayersHaveQuestions?: boolean;
}

export const useManifestPolling = (gameId: string, pollInterval = 2000) => {
  const [isPolling, setIsPolling] = useState(false);
  const [lastManifest, setLastManifest] = useState<string>('');
  const [diff, setDiff] = useState<ManifestDiff>({ hasChanges: false });
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  
  const game = useGame();
  const { setGame } = useGameStore();

  // Check if all players have at least one queued question
  const checkAllPlayersHaveQuestions = useCallback((manifest: any): boolean => {
    if (!manifest.players || !manifest.queuedQuestions) return false;
    
    // Get all unique creators of queued questions
    const questionCreators = new Set(
      manifest.queuedQuestions.map((q: any) => q.createdBy || q.createdById)
    );
    
    // Check if all players have created at least one question
    return manifest.players.every((player: any) => 
      questionCreators.has(player.id)
    );
  }, []);

  // Compare manifests and detect changes
  const compareManifests = useCallback((oldManifest: any, newManifest: any): ManifestDiff => {
    if (!oldManifest || !newManifest) {
      return { hasChanges: true };
    }

    const oldQuestionsCount = oldManifest.queuedQuestions?.length || 0;
    const newQuestionsCount = newManifest.queuedQuestions?.length || 0;
    const oldPlayersCount = oldManifest.players?.length || 0;
    const newPlayersCount = newManifest.players?.length || 0;

    const hasChanges = 
      oldQuestionsCount !== newQuestionsCount ||
      oldPlayersCount !== newPlayersCount ||
      JSON.stringify(oldManifest.queuedQuestions) !== JSON.stringify(newManifest.queuedQuestions) ||
      JSON.stringify(oldManifest.players) !== JSON.stringify(newManifest.players);

    const allPlayersHaveQuestions = checkAllPlayersHaveQuestions(newManifest);

    return {
      hasChanges,
      newQuestions: newQuestionsCount - oldQuestionsCount,
      newPlayers: newPlayersCount - oldPlayersCount,
      allPlayersHaveQuestions,
    };
  }, [checkAllPlayersHaveQuestions]);

  // Fetch manifest from API
  const fetchManifest = useCallback(async (): Promise<any> => {
    try {
      const response = await fetch(`/api/games/${gameId}/manifest`, {
        headers: {
          'Content-Type': 'application/json',
        },
        signal: abortControllerRef.current?.signal,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        // Request was aborted, don't set error
        return null;
      }
      throw error;
    }
  }, [gameId]);

  // Start round when all players have questions
  const startRound = useCallback(async () => {
    try {
      const response = await fetch(`/api/games/${gameId}/rounds/start`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to start round: ${response.status}`);
      }

      console.log('Round started successfully');
      return await response.json();
    } catch (error) {
      console.error('Error starting round:', error);
      setError(error instanceof Error ? error.message : 'Failed to start round');
    }
  }, [gameId]);

  // Polling function
  const pollManifest = useCallback(async () => {
    try {
      const manifest = await fetchManifest();
      if (!manifest) return; // Request was aborted

      const currentManifestString = JSON.stringify(manifest);
      
      if (lastManifest) {
        const oldManifest = JSON.parse(lastManifest);
        const manifestDiff = compareManifests(oldManifest, manifest);
        
        setDiff(manifestDiff);
        
        // Update store with new manifest
        setGame(manifest);
        
        // Auto-start round if all players have questions
        if (manifestDiff.allPlayersHaveQuestions && !diff.allPlayersHaveQuestions) {
          console.log('All players have questions, starting round...');
          await startRound();
        }
      } else {
        // First load
        setGame(manifest);
        setDiff({
          hasChanges: false,
          allPlayersHaveQuestions: checkAllPlayersHaveQuestions(manifest),
        });
      }
      
      setLastManifest(currentManifestString);
      setError(null);
    } catch (error) {
      console.error('Error polling manifest:', error);
      setError(error instanceof Error ? error.message : 'Failed to fetch manifest');
    }
  }, [fetchManifest, lastManifest, compareManifests, setGame, startRound, diff.allPlayersHaveQuestions, checkAllPlayersHaveQuestions]);

  // Start polling
  const startPolling = useCallback(() => {
    if (isPolling) return;
    
    setIsPolling(true);
    abortControllerRef.current = new AbortController();
    
    // Initial fetch
    pollManifest();
    
    // Set up interval
    intervalRef.current = setInterval(pollManifest, pollInterval);
  }, [isPolling, pollManifest, pollInterval]);

  // Stop polling
  const stopPolling = useCallback(() => {
    setIsPolling(false);
    
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  }, []);

  // Auto-start polling when component mounts
  useEffect(() => {
    if (gameId) {
      startPolling();
    }

    return () => {
      stopPolling();
    };
  }, [gameId, startPolling, stopPolling]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopPolling();
    };
  }, [stopPolling]);

  return {
    isPolling,
    diff,
    error,
    startPolling,
    stopPolling,
    pollManifest,
    startRound,
  };
}; 
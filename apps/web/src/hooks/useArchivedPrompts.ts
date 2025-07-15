import { useState, useEffect, useCallback } from 'react';
import { useWebSocket } from './useWebSocket';
import { useToast } from './use-toast';

interface ArchivedPrompt {
  id: string;
  roundId: string;
  roundNumber: number;
  question: string;
  options: string[];
  correctAnswer?: string;
  revealed: boolean;
  archivedAt: string;
  totalPlayers: number;
  respondedPlayers: number;
  winner?: string;
  winnerScore?: number;
}

interface UseArchivedPromptsProps {
  gameId: string;
}

export const useArchivedPrompts = ({ gameId }: UseArchivedPromptsProps) => {
  const [archivedPrompts, setArchivedPrompts] = useState<ArchivedPrompt[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useWebSocket(gameId);
  const { toast } = useToast();

  // Fetch archived prompts from API
  const fetchArchivedPrompts = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/games/${gameId}/archived-prompts`, {
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error('Failed to fetch archived prompts');
      }

      const data = await response.json();
      setArchivedPrompts(data.prompts || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      console.error('Error fetching archived prompts:', err);
    } finally {
      setIsLoading(false);
    }
  }, [gameId]);

  // Listen for WebSocket events
  useEffect(() => {
    // This logic should be moved to the RealtimeService and update the store
  }, [gameId, toast]);

  // Initial fetch
  useEffect(() => {
    fetchArchivedPrompts();
  }, [fetchArchivedPrompts]);

  // Get revealed prompts
  const revealedPrompts = archivedPrompts.filter(prompt => prompt.revealed);

  // Get hidden prompts
  const hiddenPrompts = archivedPrompts.filter(prompt => !prompt.revealed);

  // Get prompt by ID
  const getPromptById = useCallback((promptId: string) => {
    return archivedPrompts.find(prompt => prompt.id === promptId);
  }, [archivedPrompts]);

  // Get prompt by round ID
  const getPromptByRoundId = useCallback((roundId: string) => {
    return archivedPrompts.find(prompt => prompt.roundId === roundId);
  }, [archivedPrompts]);

  // Check if round is archived
  const isRoundArchived = useCallback((roundId: string) => {
    return archivedPrompts.some(prompt => prompt.roundId === roundId);
  }, [archivedPrompts]);

  // Get completion statistics
  const getCompletionStats = useCallback(() => {
    const total = archivedPrompts.length;
    const revealed = revealedPrompts.length;
    const hidden = hiddenPrompts.length;
    const completed = archivedPrompts.filter(p => 
      p.respondedPlayers === p.totalPlayers
    ).length;

    return {
      total,
      revealed,
      hidden,
      completed,
      completionRate: total > 0 ? (completed / total) * 100 : 0
    };
  }, [archivedPrompts, revealedPrompts, hiddenPrompts]);

  // Refresh archived prompts
  const refresh = useCallback(() => {
    fetchArchivedPrompts();
  }, [fetchArchivedPrompts]);

  return {
    // State
    archivedPrompts,
    revealedPrompts,
    hiddenPrompts,
    isLoading,
    error,
    
    // Computed values
    completionStats: getCompletionStats(),
    
    // Actions
    getPromptById,
    getPromptByRoundId,
    isRoundArchived,
    refresh,
    
    // Data
    totalPrompts: archivedPrompts.length,
    revealedCount: revealedPrompts.length,
    hiddenCount: hiddenPrompts.length
  };
}; 
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
  const { socket, isConnected } = useWebSocket();
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
    if (!socket || !isConnected) return;

    const handleRoundArchived = (data: any) => {
      if (data.type === 'round_archived' && data.data.gameId === gameId) {
        const newPrompt: ArchivedPrompt = {
          id: data.data.roundId,
          roundId: data.data.roundId,
          roundNumber: data.data.roundNumber,
          question: data.data.question,
          options: data.data.options,
          correctAnswer: data.data.correctAnswer,
          revealed: data.data.revealed,
          archivedAt: data.data.archivedAt,
          totalPlayers: data.data.totalPlayers,
          respondedPlayers: data.data.respondedPlayers,
          winner: data.data.winner,
          winnerScore: data.data.winnerScore
        };

        setArchivedPrompts(prev => [newPrompt, ...prev]);

        toast({
          title: 'Round Archived! 📦',
          description: `Round ${data.data.roundNumber} has been added to the archive.`,
          variant: 'default',
        });
      }
    };

    const handleRoundRevealed = (data: any) => {
      if (data.type === 'round_revealed' && data.data.gameId === gameId) {
        setArchivedPrompts(prev => 
          prev.map(prompt => 
            prompt.roundId === data.data.roundId
              ? {
                  ...prompt,
                  revealed: true,
                  correctAnswer: data.data.correctAnswer,
                  winner: data.data.winner,
                  winnerScore: data.data.winnerScore
                }
              : prompt
          )
        );

        toast({
          title: 'Round Revealed! 👁️',
          description: `Round ${data.data.roundNumber} details are now visible.`,
          variant: 'default',
        });
      }
    };

    const handleRoundUpdated = (data: any) => {
      if (data.type === 'round_updated' && data.data.gameId === gameId) {
        setArchivedPrompts(prev => 
          prev.map(prompt => 
            prompt.roundId === data.data.roundId
              ? {
                  ...prompt,
                  respondedPlayers: data.data.respondedPlayers,
                  totalPlayers: data.data.totalPlayers
                }
              : prompt
          )
        );
      }
    };

    socket.on('round_archived', handleRoundArchived);
    socket.on('round_revealed', handleRoundRevealed);
    socket.on('round_updated', handleRoundUpdated);

    return () => {
      socket.off('round_archived', handleRoundArchived);
      socket.off('round_revealed', handleRoundRevealed);
      socket.off('round_updated', handleRoundUpdated);
    };
  }, [socket, isConnected, gameId, toast]);

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
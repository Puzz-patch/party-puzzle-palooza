import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface Room {
  id: string;
  room_code: string;
  name: string;
  host_id: string;
  current_game: string;
  game_state: any;
  is_active: boolean;
}

interface Player {
  id: string;
  player_name: string;
  player_id: string;
  is_host: boolean;
  selected_character_id?: string;
}

interface ParanoiaQuestion {
  id: string;
  question: string;
  category?: string;
  spiciness_level?: number;
}

type GamePhase = 'waiting' | 'playing' | 'answering' | 'waiting_for_flip' | 'coin_flip' | 'revealed' | 'not_revealed' | 'ended';

interface GameState {
  phase: GamePhase;
  currentTurnIndex: number;
  playerOrder: string[];
  currentRound: number;
  currentQuestion: string | null;
  currentAnswer: string | null;
  targetPlayerId: string | null;
  usedAskers: string[];
  lastRevealResult: boolean | null;
  isFlipping: boolean;
}

export const useParanoiaGame = (room: Room, players: Player[], currentPlayer: Player, onUpdateRoom: (room: Room) => void) => {
  const { toast } = useToast();
  const [questions, setQuestions] = useState<ParanoiaQuestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const gameState: GameState = room.game_state || {
    phase: 'waiting',
    currentTurnIndex: 0,
    playerOrder: [],
    currentRound: 1,
    currentQuestion: null,
    currentAnswer: null,
    targetPlayerId: null,
    usedAskers: [],
    lastRevealResult: null,
    isFlipping: false
  };

  // Load questions when game starts
  useEffect(() => {
    if (gameState.phase === 'playing' && questions.length === 0) {
      loadQuestions();
    }
  }, [gameState.phase]);

  const loadQuestions = async () => {
    try {
      // First try AI generated questions
      const { data: roomQuestions } = await supabase
        .from("room_questions")
        .select("question_data")
        .eq("room_id", room.room_code)
        .eq("game_type", "paranoia");

      if (roomQuestions && roomQuestions.length > 0) {
        const aiQuestions = roomQuestions.map((rq: any, index: number) => ({
          id: `ai-${index}`,
          question: rq.question_data.question,
          category: rq.question_data.category || "general",
          spiciness_level: rq.question_data.spiciness_level || 1
        }));
        setQuestions(aiQuestions);
        return;
      }

      // Fallback to default questions
      const { data: questionsData } = await supabase
        .from("paranoia_questions")
        .select("*")
        .eq("category", "general")
        .limit(20);
      
      setQuestions(questionsData || []);
    } catch (error) {
      console.error("Error loading questions:", error);
    }
  };

  const updateGameState = async (newState: Partial<GameState>) => {
    setIsLoading(true);
    try {
      const updatedState = { ...gameState, ...newState };
      
      const { error } = await supabase
        .from("rooms")
        .update({ game_state: updatedState })
        .eq("id", room.id);

      if (error) throw error;

      onUpdateRoom({ ...room, game_state: updatedState });
    } catch (error) {
      console.error("Error updating game state:", error);
      toast({
        title: "Error",
        description: "Failed to update game state",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const startGame = useCallback(async () => {
    if (players.length < 3) {
      toast({
        title: "Not Enough Players",
        description: "You need at least 3 players to start Paranoia.",
        variant: "destructive",
      });
      return;
    }

    const shuffledPlayers = [...players].sort(() => Math.random() - 0.5);
    
    await updateGameState({
      phase: 'playing',
      currentTurnIndex: 0,
      playerOrder: shuffledPlayers.map(p => p.player_id),
      currentRound: 1,
      currentQuestion: null,
      currentAnswer: null,
      targetPlayerId: null,
      usedAskers: [],
      lastRevealResult: null,
      isFlipping: false
    });

    toast({
      title: "Game Started!",
      description: "Let the Paranoia begin!",
      className: "bg-success text-success-foreground",
    });
  }, [players]);

  const selectQuestion = useCallback(async (questionText: string) => {
    if (isLoading) return;

    try {
      const nextPlayerIndex = (gameState.currentTurnIndex + 1) % gameState.playerOrder.length;
      const nextPlayerId = gameState.playerOrder[nextPlayerIndex];
      const currentAskerPlayerId = gameState.playerOrder[gameState.currentTurnIndex];

      await updateGameState({
        phase: 'answering',
        currentQuestion: questionText,
        targetPlayerId: nextPlayerId,
        usedAskers: [...gameState.usedAskers, currentAskerPlayerId]
      });
    } catch (error) {
      console.error("Error selecting question:", error);
      toast({
        title: "Error",
        description: "Failed to select question. Please try again.",
        variant: "destructive",
      });
    }
  }, [gameState, isLoading]);

  const submitAnswer = useCallback(async (answer: string) => {
    if (!answer.trim()) {
      toast({
        title: "Empty Answer",
        description: "Please enter an answer.",
        variant: "destructive",
      });
      return;
    }

    await updateGameState({
      phase: 'waiting_for_flip',
      currentAnswer: answer.trim()
    });
  }, []);

  const flipCoin = useCallback(async () => {
    if (gameState.isFlipping) return;

    // Set flipping state
    await updateGameState({
      phase: 'coin_flip',
      isFlipping: true
    });

    // Simulate coin flip delay
    setTimeout(async () => {
      const willReveal = Math.random() < 0.5;
      const answererPlayerId = gameState.targetPlayerId;
      const nextAskerIndex = gameState.playerOrder.findIndex(id => id === answererPlayerId);

      await updateGameState({
        phase: willReveal ? 'revealed' : 'not_revealed',
        lastRevealResult: willReveal,
        currentTurnIndex: nextAskerIndex,
        targetPlayerId: null,
        isFlipping: false
      });

      toast({
        title: willReveal ? "🎉 Question Revealed!" : "🤫 Question Stays Secret",
        description: willReveal ? "Everyone can see the question and answer!" : "The question remains a secret.",
        className: willReveal ? "bg-success text-success-foreground" : "bg-primary text-primary-foreground",
      });
    }, 2500);
  }, [gameState]);

  const nextTurn = useCallback(async () => {
    const allPlayersAsked = gameState.usedAskers.length === players.length;
    
    if (allPlayersAsked) {
      // Start new round
      const shuffledPlayers = [...players].sort(() => Math.random() - 0.5);
      
      await updateGameState({
        phase: 'playing',
        currentQuestion: null,
        currentAnswer: null,
        lastRevealResult: null,
        targetPlayerId: null,
        playerOrder: shuffledPlayers.map(p => p.player_id),
        currentTurnIndex: 0,
        currentRound: gameState.currentRound + 1,
        usedAskers: []
      });
    } else {
      // Find next player who hasn't asked
      let nextIndex = 0;
      for (let i = 0; i < gameState.playerOrder.length; i++) {
        const candidatePlayerId = gameState.playerOrder[i];
        if (!gameState.usedAskers.includes(candidatePlayerId)) {
          nextIndex = i;
          break;
        }
      }

      await updateGameState({
        phase: 'playing',
        currentQuestion: null,
        currentAnswer: null,
        lastRevealResult: null,
        targetPlayerId: null,
        currentTurnIndex: nextIndex
      });
    }
  }, [gameState, players]);

  const resetGame = useCallback(async () => {
    await updateGameState({
      phase: 'waiting',
      currentTurnIndex: 0,
      playerOrder: [],
      currentRound: 1,
      currentQuestion: null,
      currentAnswer: null,
      lastRevealResult: null,
      targetPlayerId: null,
      usedAskers: [],
      isFlipping: false
    });
  }, []);

  // Helper functions
  const getCurrentPlayerName = () => {
    if (!gameState.playerOrder || gameState.playerOrder.length === 0) return "Unknown";
    const currentPlayerId = gameState.playerOrder[gameState.currentTurnIndex];
    const player = players.find(p => p.player_id === currentPlayerId);
    return player?.player_name || "Unknown";
  };

  const getTargetPlayerName = () => {
    const targetPlayer = players.find(p => p.player_id === gameState.targetPlayerId);
    return targetPlayer?.player_name || "Unknown";
  };

  const isCurrentPlayerTurn = () => {
    if (!gameState.playerOrder || gameState.playerOrder.length === 0) {
      return false;
    }
    if (gameState.currentTurnIndex >= gameState.playerOrder.length) {
      return false;
    }
    return gameState.playerOrder[gameState.currentTurnIndex] === currentPlayer.player_id;
  };

  const isTargetPlayer = () => {
    return gameState.targetPlayerId === currentPlayer.player_id;
  };

  return {
    gameState,
    questions,
    isLoading,
    startGame,
    selectQuestion,
    submitAnswer,
    flipCoin,
    nextTurn,
    resetGame,
    getCurrentPlayerName,
    getTargetPlayerName,
    isCurrentPlayerTurn,
    isTargetPlayer
  };
};
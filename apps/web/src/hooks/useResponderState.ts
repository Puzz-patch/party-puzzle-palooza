import { useState, useEffect, useCallback } from 'react';
import { useWebSocket } from './useWebSocket';
import { useToast } from './use-toast';

interface ResponderData {
  responderId: string;
  responderName: string;
  responderAvatar?: string;
  phase: 'response' | 'reveal_gamble' | 'finished';
  responseStartTime: string;
  responseEndTime: string;
  countdownDuration: number;
  nextPhase: string;
}

interface UseResponderStateProps {
  roundId: string;
  onPhaseChange?: (phase: string) => void;
}

export const useResponderState = ({ roundId, onPhaseChange }: UseResponderStateProps) => {
  const [responderData, setResponderData] = useState<ResponderData | null>(null);
  const [isResponderSelected, setIsResponderSelected] = useState(false);
  const { socket, isConnected } = useWebSocket();
  const { toast } = useToast();

  // Listen for responder selection broadcasts
  useEffect(() => {
    if (!socket || !isConnected) return;

    const handleResponderSelected = (data: any) => {
      if (data.type === 'responder_selected' && data.data.roundId === roundId) {
        const responderInfo = data.data;
        setResponderData(responderInfo);
        setIsResponderSelected(true);

        // Show toast notification
        toast({
          title: 'Responder Selected! 🎯',
          description: `${responderInfo.responderName} has been selected to respond.`,
          variant: 'default',
        });

        // Notify parent component of phase change
        onPhaseChange?.(responderInfo.phase);
      }
    };

    const handlePhaseChange = (data: any) => {
      if (data.type === 'phase_change' && data.data.roundId === roundId) {
        const newPhase = data.data.phase;
        setResponderData(prev => prev ? { ...prev, phase: newPhase } : null);

        // Show phase transition toast
        if (newPhase === 'reveal_gamble') {
          toast({
            title: 'Reveal & Gamble Phase! ⚡',
            description: 'Time to reveal answers and place bets!',
            variant: 'default',
          });
        } else if (newPhase === 'finished') {
          toast({
            title: 'Round Complete! ✅',
            description: 'The round has finished.',
            variant: 'default',
          });
        }

        onPhaseChange?.(newPhase);
      }
    };

    socket.on('responder_selected', handleResponderSelected);
    socket.on('phase_change', handlePhaseChange);

    return () => {
      socket.off('responder_selected', handleResponderSelected);
      socket.off('phase_change', handlePhaseChange);
    };
  }, [socket, isConnected, roundId, onPhaseChange, toast]);

  // Calculate time remaining
  const getTimeRemaining = useCallback(() => {
    if (!responderData || responderData.phase !== 'response') {
      return 0;
    }

    const endTime = new Date(responderData.responseEndTime).getTime();
    const now = Date.now();
    return Math.max(0, endTime - now);
  }, [responderData]);

  // Check if countdown is active
  const isCountdownActive = useCallback(() => {
    return responderData?.phase === 'response' && getTimeRemaining() > 0;
  }, [responderData, getTimeRemaining]);

  // Format time for display
  const formatTimeRemaining = useCallback(() => {
    const timeRemaining = getTimeRemaining();
    if (timeRemaining <= 0) return '0:00';

    const seconds = Math.ceil(timeRemaining / 1000);
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }, [getTimeRemaining]);

  // Get progress percentage for countdown bar
  const getCountdownProgress = useCallback(() => {
    if (!responderData || !isCountdownActive()) {
      return 100;
    }

    const totalDuration = responderData.countdownDuration;
    const remaining = getTimeRemaining();
    return ((totalDuration - remaining) / totalDuration) * 100;
  }, [responderData, isCountdownActive, getTimeRemaining]);

  // Clear responder data (for new rounds)
  const clearResponderData = useCallback(() => {
    setResponderData(null);
    setIsResponderSelected(false);
  }, []);

  // Check if current user is the responder
  const isCurrentUserResponder = useCallback((currentUserId: string) => {
    return responderData?.responderId === currentUserId;
  }, [responderData]);

  return {
    // State
    responderData,
    isResponderSelected,
    isCountdownActive: isCountdownActive(),
    
    // Computed values
    timeRemaining: getTimeRemaining(),
    formattedTime: formatTimeRemaining(),
    countdownProgress: getCountdownProgress(),
    
    // Actions
    clearResponderData,
    isCurrentUserResponder,
  };
}; 
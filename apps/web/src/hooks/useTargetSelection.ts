import { useState, useCallback } from 'react';
import { useToast } from './use-toast';

interface UseTargetSelectionProps {
  roundId: string;
  currentAskerId: string;
  onTargetSet?: (targetPlayerId: string, targetPlayerName: string) => void;
}

interface TargetSelectionState {
  isModalOpen: boolean;
  selectedTarget: string | null;
  isSubmitting: boolean;
  error: string | null;
}

export const useTargetSelection = ({ 
  roundId, 
  currentAskerId, 
  onTargetSet 
}: UseTargetSelectionProps) => {
  const [state, setState] = useState<TargetSelectionState>({
    isModalOpen: false,
    selectedTarget: null,
    isSubmitting: false,
    error: null,
  });

  const { toast } = useToast();

  const openModal = useCallback(() => {
    setState(prev => ({
      ...prev,
      isModalOpen: true,
      selectedTarget: null,
      error: null,
    }));
  }, []);

  const closeModal = useCallback(() => {
    if (!state.isSubmitting) {
      setState(prev => ({
        ...prev,
        isModalOpen: false,
        selectedTarget: null,
        error: null,
      }));
    }
  }, [state.isSubmitting]);

  const selectTarget = useCallback((targetId: string) => {
    setState(prev => ({
      ...prev,
      selectedTarget: prev.selectedTarget === targetId ? null : targetId,
      error: null,
    }));
  }, []);

  const setTarget = useCallback(async (targetPlayerId: string) => {
    if (!targetPlayerId) {
      setState(prev => ({
        ...prev,
        error: 'Please select a target player',
      }));
      return;
    }

    setState(prev => ({
      ...prev,
      isSubmitting: true,
      error: null,
    }));

    try {
      const response = await fetch(`/api/rounds/${roundId}/target`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          targetPlayerId,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to set target');
      }

      const result = await response.json();

      // Optimistic UI update
      if (onTargetSet) {
        onTargetSet(targetPlayerId, result.targetPlayerName);
      }

      // Show success toast
      toast({
        title: 'Target Set! 🎯',
        description: `You've selected ${result.targetPlayerName} as your target.`,
        variant: 'default',
      });

      // Close modal
      setState(prev => ({
        ...prev,
        isModalOpen: false,
        selectedTarget: null,
        isSubmitting: false,
      }));

      return result;

    } catch (error) {
      console.error('Error setting target:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to set target';
      
      setState(prev => ({
        ...prev,
        error: errorMessage,
        isSubmitting: false,
      }));

      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      });

      throw error;
    }
  }, [roundId, onTargetSet, toast]);

  const clearError = useCallback(() => {
    setState(prev => ({
      ...prev,
      error: null,
    }));
  }, []);

  return {
    // State
    isModalOpen: state.isModalOpen,
    selectedTarget: state.selectedTarget,
    isSubmitting: state.isSubmitting,
    error: state.error,

    // Actions
    openModal,
    closeModal,
    selectTarget,
    setTarget,
    clearError,
  };
}; 
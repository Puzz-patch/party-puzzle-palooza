import { useState, useCallback } from 'react';
import { useToast } from './use-toast';
import { FlagReason } from '../components/FlagButton';

interface UseQuestionFlagOptions {
  onFlagged?: (questionId: string, flagCount: number, isFlagged: boolean, isHidden: boolean) => void;
}

export const useQuestionFlag = (options: UseQuestionFlagOptions = {}) => {
  const [isFlagging, setIsFlagging] = useState(false);
  const { toast } = useToast();

  const flagQuestion = useCallback(async (
    questionId: string,
    reason: FlagReason,
    details?: string
  ) => {
    setIsFlagging(true);

    try {
      const response = await fetch(`/api/questions/${questionId}/flag`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          questionId,
          reason,
          details: details?.trim() || undefined,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to flag question');
      }

      const data = await response.json();

      // Call the callback with updated flag information
      options.onFlagged?.(questionId, data.flagCount, data.isFlagged, data.isHidden);

      toast({
        title: 'Question Flagged! 🚩',
        description: data.message,
        variant: data.isFlagged ? 'destructive' : 'default',
      });

      return data;

    } catch (error) {
      console.error('Error flagging question:', error);
      
      toast({
        title: 'Flag Failed ❌',
        description: error instanceof Error ? error.message : 'Failed to flag question',
        variant: 'destructive',
      });

      throw error;
    } finally {
      setIsFlagging(false);
    }
  }, [options.onFlagged, toast]);

  const getQuestionFlags = useCallback(async (questionId: string) => {
    try {
      const response = await fetch(`/api/questions/${questionId}/flags`, {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to fetch question flags');
      }

      const data = await response.json();
      return data.data;

    } catch (error) {
      console.error('Error fetching question flags:', error);
      throw error;
    }
  }, []);

  const getFlaggedQuestions = useCallback(async () => {
    try {
      const response = await fetch('/api/questions/flagged', {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to fetch flagged questions');
      }

      const data = await response.json();
      return data.data;

    } catch (error) {
      console.error('Error fetching flagged questions:', error);
      throw error;
    }
  }, []);

  const getFlagStatistics = useCallback(async () => {
    try {
      const response = await fetch('/api/questions/flags/statistics', {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to fetch flag statistics');
      }

      const data = await response.json();
      return data.data;

    } catch (error) {
      console.error('Error fetching flag statistics:', error);
      throw error;
    }
  }, []);

  return {
    flagQuestion,
    getQuestionFlags,
    getFlaggedQuestions,
    getFlagStatistics,
    isFlagging,
  };
}; 
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { Target, Users, Clock, Trophy, QuestionMark } from 'lucide-react';
import { TargetSelectionModal } from './TargetSelectionModal';
import { useTargetSelection } from '../hooks/useTargetSelection';
import { useGameStore, useGamePlayers } from '../stores/game-store';

interface GameRoundProps {
  roundId: string;
  roundNumber: number;
  question: string;
  type: string;
  options: string[];
  correctAnswer?: string;
  timeLimit: number;
  maskedAuthorId: string;
  currentAskerId: string;
  isCurrentAsker: boolean;
  targetPlayerId?: string;
  targetPlayerName?: string;
  status: 'pending' | 'active' | 'finished';
  onTargetSet?: (targetPlayerId: string, targetPlayerName: string) => void;
}

export const GameRound: React.FC<GameRoundProps> = ({
  roundId,
  roundNumber,
  question,
  type,
  options,
  correctAnswer,
  timeLimit,
  maskedAuthorId,
  currentAskerId,
  isCurrentAsker,
  targetPlayerId,
  targetPlayerName,
  status,
  onTargetSet,
}) => {
  const players = useGamePlayers();
  
  const {
    isModalOpen,
    selectedTarget,
    isSubmitting,
    error,
    openModal,
    closeModal,
    selectTarget,
    setTarget,
    clearError,
  } = useTargetSelection({
    roundId,
    currentAskerId,
    onTargetSet,
  });

  const handleSetTarget = async () => {
    if (selectedTarget) {
      try {
        await setTarget(selectedTarget);
      } catch (error) {
        // Error is already handled in the hook
      }
    }
  };

  const getTypeIcon = (questionType: string) => {
    switch (questionType) {
      case 'would_you_rather':
        return '🤔';
      case 'trivia':
        return '🧠';
      case 'word_association':
        return '💭';
      case 'drawing':
        return '🎨';
      default:
        return '❓';
    }
  };

  const getTypeLabel = (questionType: string) => {
    switch (questionType) {
      case 'would_you_rather':
        return 'Would You Rather';
      case 'trivia':
        return 'Trivia';
      case 'word_association':
        return 'Word Association';
      case 'drawing':
        return 'Drawing';
      default:
        return 'Question';
    }
  };

  const getStatusColor = (roundStatus: string) => {
    switch (roundStatus) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'active':
        return 'bg-green-100 text-green-800';
      case 'finished':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (roundStatus: string) => {
    switch (roundStatus) {
      case 'pending':
        return <Clock className="h-4 w-4" />;
      case 'active':
        return <QuestionMark className="h-4 w-4" />;
      case 'finished':
        return <Trophy className="h-4 w-4" />;
      default:
        return <QuestionMark className="h-4 w-4" />;
    }
  };

  return (
    <>
      <Card className="w-full">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <span className="text-lg font-bold">Round {roundNumber}</span>
              <Badge className={getStatusColor(status)}>
                {getStatusIcon(status)}
                <span className="ml-1 capitalize">{status}</span>
              </Badge>
            </CardTitle>
            
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="flex items-center gap-1">
                {getTypeIcon(type)}
                {getTypeLabel(type)}
              </Badge>
              
              <Badge variant="outline" className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {timeLimit}s
              </Badge>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Question */}
          <div className="space-y-2">
            <h3 className="font-medium text-gray-900">{question}</h3>
            <p className="text-sm text-gray-600">
              By {maskedAuthorId}
            </p>
          </div>

          {/* Options */}
          {options && options.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-gray-700">Options:</h4>
              <div className="grid gap-2">
                {options.map((option, index) => (
                  <div
                    key={index}
                    className="p-2 bg-gray-50 rounded-md text-sm"
                  >
                    {String.fromCharCode(65 + index)}. {option}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Target Selection */}
          <div className="space-y-3">
            {targetPlayerId && targetPlayerName ? (
              <div className="flex items-center gap-2 p-3 bg-blue-50 rounded-md">
                <Target className="h-4 w-4 text-blue-600" />
                <span className="text-sm font-medium text-blue-800">
                  Target: {targetPlayerName}
                </span>
              </div>
            ) : isCurrentAsker && status === 'active' ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Target className="h-4 w-4 text-orange-600" />
                  <span className="text-sm font-medium text-gray-700">
                    Select who to ask this question to:
                  </span>
                </div>
                
                <Button
                  onClick={openModal}
                  variant="outline"
                  className="w-full"
                >
                  <Target className="h-4 w-4 mr-2" />
                  Choose Target
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-md">
                <Users className="h-4 w-4 text-gray-500" />
                <span className="text-sm text-gray-600">
                  Waiting for target selection...
                </span>
              </div>
            )}
          </div>

          {/* Current Asker Info */}
          {isCurrentAsker && (
            <div className="flex items-center gap-2 p-2 bg-green-50 rounded-md">
              <Avatar className="h-6 w-6">
                <AvatarFallback className="bg-green-100 text-green-700 text-xs">
                  You
                </AvatarFallback>
              </Avatar>
              <span className="text-sm font-medium text-green-800">
                You're asking this question
              </span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Target Selection Modal */}
      <TargetSelectionModal
        roundId={roundId}
        isOpen={isModalOpen}
        onClose={closeModal}
        currentAskerId={currentAskerId}
      />
    </>
  );
}; 
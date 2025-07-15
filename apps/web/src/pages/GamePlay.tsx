import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Progress } from '../components/ui/progress';
import { 
  Play, 
  Pause, 
  SkipForward, 
  Users, 
  Clock, 
  Trophy,
  Target,
  User,
  Zap,
  AlertTriangle,
  Shield
} from 'lucide-react';
import { GameRound } from '../components/GameRound';
import { ResponderHighlight } from '../components/ResponderHighlight';
import { ArchivedPrompts } from '../components/ArchivedPrompts';
import { useGameStore, useGamePlayers, useGameFlags } from '../stores/game-store';
import { useResponderState } from '../hooks/useResponderState';
import { useArchivedPrompts } from '../hooks/useArchivedPrompts';
import { useToast } from '../hooks/use-toast';

export const GamePlay: React.FC = () => {
  const { gid } = useParams<{ gid: string }>();
  const [currentRound, setCurrentRound] = useState<any>(null);
  const [timeRemaining, setTimeRemaining] = useState(30);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [currentAskerId, setCurrentAskerId] = useState<string>('player1'); // Mock current asker
  const [currentPhase, setCurrentPhase] = useState<'pending' | 'response' | 'reveal_gamble' | 'finished'>('pending');
  const [isArchiveOpen, setIsArchiveOpen] = useState(false);
  
  const players = useGamePlayers();
  const gameFlags = useGameFlags();
  const { toast } = useToast();

  // Check if game is in chill mode
  const isChillMode = gameFlags?.chillMode || false;

  // Use archived prompts hook
  const {
    archivedPrompts,
    isLoading: archiveLoading,
    error: archiveError,
    completionStats,
    getPromptById,
    refresh: refreshArchive
  } = useArchivedPrompts({ gameId: gid! });

  // Mock round data - in real app this would come from API
  const mockRound = {
    roundId: 'round-1',
    roundNumber: 1,
    question: 'Would you rather have the ability to fly or be invisible?',
    type: 'would_you_rather',
    options: ['Fly', 'Be invisible'],
    correctAnswer: null,
    timeLimit: 30,
    maskedAuthorId: 'author_a1b2c3d4',
    status: 'active' as const,
  };

  // Mock current player - in real app this would come from JWT
  const currentPlayerId = 'player1';
  const isCurrentAsker = currentPlayerId === currentAskerId;

  // Use responder state hook
  const {
    responderData,
    isResponderSelected,
    isCountdownActive,
    timeRemaining: responderTimeRemaining,
    formattedTime: responderFormattedTime,
    countdownProgress,
    clearResponderData,
    isCurrentUserResponder,
  } = useResponderState({
    roundId: mockRound.roundId,
    onPhaseChange: (phase) => {
      setCurrentPhase(phase as any);
      if (phase === 'reveal_gamble') {
        handlePhaseTransition();
      }
    },
  });

  useEffect(() => {
    setCurrentRound(mockRound);
  }, []);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (isTimerRunning && timeRemaining > 0) {
      interval = setInterval(() => {
        setTimeRemaining(prev => {
          if (prev <= 1) {
            setIsTimerRunning(false);
            toast({
              title: 'Time\'s up! ⏰',
              description: 'The round has ended.',
              variant: 'warning',
            });
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isTimerRunning, timeRemaining, toast]);

  const handleTargetSet = (targetPlayerId: string, targetPlayerName: string) => {
    // Update local state optimistically
    setCurrentRound(prev => ({
      ...prev,
      targetPlayerId,
      targetPlayerName,
    }));

    // Simulate responder selection broadcast (in real app this would come from WebSocket)
    setTimeout(() => {
      // This would normally come from WebSocket
      const mockResponderData = {
        responderId: targetPlayerId,
        responderName: targetPlayerName,
        responderAvatar: undefined,
        phase: 'response' as const,
        responseStartTime: new Date().toISOString(),
        responseEndTime: new Date(Date.now() + 30000).toISOString(),
        countdownDuration: 30000,
        nextPhase: 'reveal_gamble',
      };

      // Simulate the WebSocket event
      const event = new CustomEvent('responder_selected', {
        detail: {
          type: 'responder_selected',
          data: {
            roundId: mockRound.roundId,
            ...mockResponderData,
          },
        },
      });
      window.dispatchEvent(event);
    }, 1000);

    toast({
      title: 'Target Selected! 🎯',
      description: `You've chosen ${targetPlayerName} as your target.`,
      variant: 'success',
    });
  };

  const handlePhaseTransition = () => {
    toast({
      title: 'Phase Transition! ⚡',
      description: 'Moving to Reveal & Gamble phase.',
      variant: 'default',
    });
  };

  const handleCountdownComplete = () => {
    // Simulate phase change to reveal_gamble
    const event = new CustomEvent('phase_change', {
      detail: {
        type: 'phase_change',
        data: {
          roundId: mockRound.roundId,
          phase: 'reveal_gamble',
        },
      },
    });
    window.dispatchEvent(event);
  };

  const startTimer = () => {
    setIsTimerRunning(true);
    toast({
      title: 'Round Started! 🚀',
      description: 'The timer is now running.',
      variant: 'default',
    });
  };

  const pauseTimer = () => {
    setIsTimerRunning(false);
    toast({
      title: 'Timer Paused ⏸️',
      description: 'The round has been paused.',
      variant: 'default',
    });
  };

  const skipRound = () => {
    setIsTimerRunning(false);
    setTimeRemaining(30);
    clearResponderData();
    setCurrentPhase('pending');
    toast({
      title: 'Round Skipped ⏭️',
      description: 'Moving to the next round.',
      variant: 'default',
    });
  };

  if (!currentRound) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading game...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50">
      {/* Header */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Game Session</h1>
              <p className="text-sm text-gray-600">Code: {gid}</p>
            </div>
            
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Users className="h-4 w-4" />
                <span>{players.length} players</span>
              </div>
              
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Trophy className="h-4 w-4" />
                <span>Round {currentRound.roundNumber}</span>
              </div>

              <Badge className={`${
                currentPhase === 'pending' ? 'bg-gray-100 text-gray-800' :
                currentPhase === 'response' ? 'bg-blue-100 text-blue-800' :
                currentPhase === 'reveal_gamble' ? 'bg-orange-100 text-orange-800' :
                'bg-green-100 text-green-800'
              }`}>
                {currentPhase === 'pending' && <Clock className="h-3 w-3 mr-1" />}
                {currentPhase === 'response' && <Target className="h-3 w-3 mr-1" />}
                {currentPhase === 'reveal_gamble' && <Zap className="h-3 w-3 mr-1" />}
                {currentPhase === 'finished' && <Trophy className="h-3 w-3 mr-1" />}
                {currentPhase.charAt(0).toUpperCase() + currentPhase.slice(1)}
              </Badge>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Timer Section */}
        <Card className="mb-8">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-blue-600" />
                <h2 className="text-lg font-semibold">Round Timer</h2>
              </div>
              
              <div className="flex items-center gap-2">
                <Badge className="text-lg font-mono">
                  {Math.floor(timeRemaining / 60)}:{(timeRemaining % 60).toString().padStart(2, '0')}
                </Badge>
                
                <div className="flex gap-2">
                  {!isTimerRunning ? (
                    <Button onClick={startTimer} size="sm">
                      <Play className="h-4 w-4 mr-1" />
                      Start
                    </Button>
                  ) : (
                    <Button onClick={pauseTimer} variant="outline" size="sm">
                      <Pause className="h-4 w-4 mr-1" />
                      Pause
                    </Button>
                  )}
                  
                  <Button onClick={skipRound} variant="outline" size="sm">
                    <SkipForward className="h-4 w-4 mr-1" />
                    Skip
                  </Button>
                </div>
              </div>
            </div>
            
            <Progress 
              value={(timeRemaining / currentRound.timeLimit) * 100} 
              className="h-2"
            />
          </CardContent>
        </Card>

        {/* Responder Highlight */}
        {isResponderSelected && responderData && (
          <div className="mb-8">
            <ResponderHighlight
              responderId={responderData.responderId}
              responderName={responderData.responderName}
              responderAvatar={responderData.responderAvatar}
              countdownDuration={responderData.countdownDuration}
              onCountdownComplete={handleCountdownComplete}
              phase={responderData.phase}
            />
          </div>
        )}

        {/* Current Round */}
        <div className="mb-8">
          <GameRound
            roundId={currentRound.roundId}
            roundNumber={currentRound.roundNumber}
            question={currentRound.question}
            type={currentRound.type}
            options={currentRound.options}
            correctAnswer={currentRound.correctAnswer}
            timeLimit={currentRound.timeLimit}
            maskedAuthorId={currentRound.maskedAuthorId}
            currentAskerId={currentAskerId}
            isCurrentAsker={isCurrentAsker}
            targetPlayerId={currentRound.targetPlayerId}
            targetPlayerName={currentRound.targetPlayerName}
            status={currentRound.status}
            onTargetSet={handleTargetSet}
          />
        </div>

        {/* Shot-related UI - Only show when NOT in chill mode */}
        {!isChillMode && (
          <Card className="mb-8 border-orange-200 bg-orange-50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-orange-800">
                <Zap className="h-5 w-5" />
                Shot System
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center gap-2 p-3 bg-orange-100 rounded-md">
                  <AlertTriangle className="h-4 w-4 text-orange-600" />
                  <span className="text-sm font-medium text-orange-800">
                    Shot system is active - players can take shots and perform actions
                  </span>
                </div>
                
                {/* Placeholder for shot-related components */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="p-4 bg-white rounded-md border border-orange-200">
                    <div className="flex items-center gap-2 mb-2">
                      <Zap className="h-4 w-4 text-orange-600" />
                      <span className="font-medium text-sm">Take Shot</span>
                    </div>
                    <p className="text-xs text-gray-600">
                      Spend tokens to take a shot at the target
                    </p>
                  </div>
                  
                  <div className="p-4 bg-white rounded-md border border-orange-200">
                    <div className="flex items-center gap-2 mb-2">
                      <Shield className="h-4 w-4 text-blue-600" />
                      <span className="font-medium text-sm">Shield</span>
                    </div>
                    <p className="text-xs text-gray-600">
                      Defend against incoming shots
                    </p>
                  </div>
                  
                  <div className="p-4 bg-white rounded-md border border-orange-200">
                    <div className="flex items-center gap-2 mb-2">
                      <Target className="h-4 w-4 text-red-600" />
                      <span className="font-medium text-sm">Force</span>
                    </div>
                    <p className="text-xs text-gray-600">
                      Force a specific outcome
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Chill Mode Indicator */}
        {isChillMode && (
          <Card className="mb-8 border-green-200 bg-green-50">
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 p-3 bg-green-100 rounded-md">
                <Shield className="h-4 w-4 text-green-600" />
                <span className="text-sm font-medium text-green-800">
                  Chill Mode Active - Shot system disabled for a more relaxed experience
                </span>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Player List with Highlighted Responder */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Players ({players.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3">
              {players.map((player) => {
                const isResponder = responderData?.responderId === player.id;
                const isAsker = player.id === currentAskerId;
                
                return (
                  <div
                    key={player.id}
                    className={`flex items-center justify-between p-3 rounded-lg border transition-all duration-200 ${
                      isResponder 
                        ? 'bg-blue-50 border-blue-300 ring-2 ring-blue-200' 
                        : isAsker
                        ? 'bg-green-50 border-green-200'
                        : 'bg-gray-50 border-gray-200'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-gray-500" />
                        <span className={`font-medium ${
                          isResponder ? 'text-blue-900' : 
                          isAsker ? 'text-green-900' : 
                          'text-gray-900'
                        }`}>
                          {player.firstName} {player.lastName}
                        </span>
                        
                        {isResponder && (
                          <Badge className="bg-blue-100 text-blue-800 animate-pulse">
                            <Target className="h-3 w-3 mr-1" />
                            Responder
                          </Badge>
                        )}
                        
                        {isAsker && (
                          <Badge className="bg-green-100 text-green-800">
                            <User className="h-3 w-3 mr-1" />
                            Asker
                          </Badge>
                        )}
                        
                        {player.isHost && (
                          <Badge className="bg-yellow-100 text-yellow-800">
                            Host
                          </Badge>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-600">
                        Score: {player.score}
                      </span>
                      
                      {isResponder && isCountdownActive && (
                        <div className="flex items-center gap-1 text-blue-600">
                          <Clock className="h-3 w-3" />
                          <span className="text-xs font-mono">
                            {responderFormattedTime}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Archived Prompts Sidebar */}
      <ArchivedPrompts
        gameId={gid!}
        isOpen={isArchiveOpen}
        onToggle={() => setIsArchiveOpen(!isArchiveOpen)}
        prompts={archivedPrompts}
        onPromptSelect={(prompt) => {
          toast({
            title: `Round ${prompt.roundNumber}`,
            description: prompt.revealed 
              ? `Question: ${prompt.question}`
              : 'This round is still hidden',
            variant: 'default',
          });
        }}
      />
    </div>
  );
}; 
import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Progress } from './ui/progress';
import { 
  Trophy, 
  Medal, 
  Users, 
  Target, 
  Clock, 
  Star,
  CheckCircle,
  AlertTriangle,
  Coins,
  BarChart3,
  Calendar,
  Award,
  Play,
  RefreshCw,
  Sparkles
} from 'lucide-react';
import { usePlayAgain } from '../hooks/usePlayAgain';

interface PlayerFinalScore {
  playerId: string;
  username: string;
  firstName: string;
  lastName: string;
  finalScore: number;
  correctAnswers: number;
  totalAnswers: number;
  unusedPromptTokens: number;
  rank: number;
  stats: Record<string, any>;
}

interface GameFinaleResult {
  gameId: string;
  gameName: string;
  gameCode: string;
  totalRounds: number;
  deckUsagePercentage: number;
  deckUsageRequirementMet: boolean;
  winner?: PlayerFinalScore;
  playerScores: PlayerFinalScore[];
  totalUnusedPromptTokens: number;
  completedAt: string;
  gameStats: Record<string, any>;
}

interface GameFinaleResultsProps {
  finaleResult: GameFinaleResult;
  onPlayAgain?: () => void;
  onViewArchive?: () => void;
  onShareResults?: () => void;
}

// Confetti component
const Confetti: React.FC = () => {
  const [particles, setParticles] = useState<Array<{
    id: number;
    x: number;
    y: number;
    color: string;
    size: number;
    speed: number;
    angle: number;
  }>>([]);

  useEffect(() => {
    // Create confetti particles
    const colors = ['#FFD700', '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#98D8C8'];
    const newParticles = Array.from({ length: 150 }, (_, i) => ({
      id: i,
      x: Math.random() * window.innerWidth,
      y: -20,
      color: colors[Math.floor(Math.random() * colors.length)],
      size: Math.random() * 8 + 4,
      speed: Math.random() * 3 + 2,
      angle: Math.random() * 360,
    }));

    setParticles(newParticles);

    // Animate confetti
    const interval = setInterval(() => {
      setParticles(prev => 
        prev.map(particle => ({
          ...particle,
          y: particle.y + particle.speed,
          x: particle.x + Math.sin(particle.angle * Math.PI / 180) * 0.5,
          angle: particle.angle + 2,
        })).filter(particle => particle.y < window.innerHeight + 50)
      );
    }, 50);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="fixed inset-0 pointer-events-none z-50">
      {particles.map(particle => (
        <div
          key={particle.id}
          className="absolute w-2 h-2 rounded-full animate-bounce"
          style={{
            left: particle.x,
            top: particle.y,
            backgroundColor: particle.color,
            width: particle.size,
            height: particle.size,
            transform: `rotate(${particle.angle}deg)`,
          }}
        />
      ))}
    </div>
  );
};

// Podium component for top 3 players
const Podium: React.FC<{ players: PlayerFinalScore[] }> = ({ players }) => {
  const top3 = players.slice(0, 3);
  
  const getPodiumPosition = (rank: number) => {
    switch (rank) {
      case 1: return 'order-2'; // Center
      case 2: return 'order-1'; // Left
      case 3: return 'order-3'; // Right
      default: return '';
    }
  };

  const getPodiumHeight = (rank: number) => {
    switch (rank) {
      case 1: return 'h-32'; // Tallest
      case 2: return 'h-24'; // Medium
      case 3: return 'h-20'; // Shortest
      default: return 'h-16';
    }
  };

  const getPodiumColor = (rank: number) => {
    switch (rank) {
      case 1: return 'bg-gradient-to-b from-yellow-400 to-yellow-600';
      case 2: return 'bg-gradient-to-b from-gray-300 to-gray-500';
      case 3: return 'bg-gradient-to-b from-amber-600 to-amber-800';
      default: return 'bg-gray-400';
    }
  };

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1: return <Trophy className="h-6 w-6 text-yellow-800" />;
      case 2: return <Medal className="h-6 w-6 text-gray-600" />;
      case 3: return <Medal className="h-6 w-6 text-amber-700" />;
      default: return <Star className="h-6 w-6 text-blue-500" />;
    }
  };

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-center justify-center">
          <Award className="h-6 w-6" />
          Winners Podium
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-end justify-center gap-4 h-40">
          {top3.map((player) => (
            <div key={player.playerId} className={`flex flex-col items-center ${getPodiumPosition(player.rank)}`}>
              {/* Player info on podium */}
              <div className="text-center mb-2">
                <div className="flex items-center justify-center gap-1 mb-1">
                  {getRankIcon(player.rank)}
                  <Badge className="text-xs">#{player.rank}</Badge>
                </div>
                <p className="font-semibold text-sm text-gray-900">
                  {player.firstName}
                </p>
                <p className="text-xs text-gray-600">@{player.username}</p>
                <p className="text-lg font-bold text-gray-900">
                  {player.finalScore.toLocaleString()}
                </p>
                <p className="text-xs text-gray-500">points</p>
              </div>
              
              {/* Podium base */}
              <div className={`w-20 ${getPodiumHeight(player.rank)} ${getPodiumColor(player.rank)} rounded-t-lg flex items-center justify-center shadow-lg`}>
                <div className="text-white font-bold text-lg">
                  {player.rank}
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

// Token summary component
const TokenSummary: React.FC<{ finaleResult: GameFinaleResult }> = ({ finaleResult }) => {
  const playersWithTokens = finaleResult.playerScores.filter(p => p.unusedPromptTokens > 0);
  
  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Coins className="h-5 w-5" />
          Token Distribution Summary
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Total tokens distributed */}
          <div className="text-center p-4 bg-gradient-to-r from-green-50 to-blue-50 rounded-lg border border-green-200">
            <div className="flex items-center justify-center gap-2 mb-2">
              <Coins className="h-6 w-6 text-green-600" />
              <span className="text-2xl font-bold text-green-700">
                {finaleResult.totalUnusedPromptTokens}
              </span>
            </div>
            <p className="text-sm text-green-600 font-medium">
              Total Unused Prompt Tokens Distributed
            </p>
          </div>

          {/* Individual player tokens */}
          {playersWithTokens.length > 0 && (
            <div>
              <h4 className="font-semibold text-gray-900 mb-3">Player Token Rewards:</h4>
              <div className="grid gap-3">
                {playersWithTokens.map((player) => (
                  <div
                    key={player.playerId}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                        <span className="text-sm font-semibold text-blue-700">
                          {player.rank}
                        </span>
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">
                          {player.firstName} {player.lastName}
                        </p>
                        <p className="text-sm text-gray-600">@{player.username}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Coins className="h-4 w-4 text-green-600" />
                      <span className="font-semibold text-green-700">
                        +{player.unusedPromptTokens} tokens
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Token explanation */}
          <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
            <p className="text-sm text-blue-800">
              <strong>How tokens work:</strong> Players earn 1 token for each unused question they created. 
              These tokens can be used to create custom questions in future games!
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export const GameFinaleResults: React.FC<GameFinaleResultsProps> = ({
  finaleResult,
  onPlayAgain,
  onViewArchive,
  onShareResults
}) => {
  const [showConfetti, setShowConfetti] = useState(true);
  
  // Use the play again hook
  const { resetAndPlayAgain, isResetting } = usePlayAgain({
    gameId: finaleResult.gameId,
    onResetGame: onPlayAgain
  });

  useEffect(() => {
    // Show confetti for 5 seconds
    const timer = setTimeout(() => {
      setShowConfetti(false);
    }, 5000);

    return () => clearTimeout(timer);
  }, []);

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1: return <Trophy className="h-5 w-5 text-yellow-500" />;
      case 2: return <Medal className="h-5 w-5 text-gray-400" />;
      case 3: return <Medal className="h-5 w-5 text-amber-600" />;
      default: return <Star className="h-5 w-5 text-blue-500" />;
    }
  };

  const getRankColor = (rank: number) => {
    switch (rank) {
      case 1: return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 2: return 'bg-gray-100 text-gray-800 border-gray-200';
      case 3: return 'bg-amber-100 text-amber-800 border-amber-200';
      default: return 'bg-blue-100 text-blue-800 border-blue-200';
    }
  };

  const formatScore = (score: number) => {
    return score.toLocaleString();
  };

  const formatAccuracy = (correct: number, total: number) => {
    if (total === 0) return '0%';
    return `${Math.round((correct / total) * 100)}%`;
  };

  const formatCompletionTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      {/* Confetti Animation */}
      {showConfetti && <Confetti />}

      {/* Header with celebration */}
      <div className="text-center">
        <div className="flex items-center justify-center gap-2 mb-4">
          <Sparkles className="h-8 w-8 text-yellow-500 animate-pulse" />
          <h1 className="text-4xl font-bold text-gray-900">
            Game Complete! 🎉
          </h1>
          <Sparkles className="h-8 w-8 text-yellow-500 animate-pulse" />
        </div>
        <p className="text-xl text-gray-600 mb-4">
          {finaleResult.gameName} ({finaleResult.gameCode})
        </p>
        <div className="flex items-center justify-center gap-4 text-sm text-gray-500">
          <div className="flex items-center gap-1">
            <Calendar className="h-4 w-4" />
            <span>{formatCompletionTime(finaleResult.completedAt)}</span>
          </div>
          <div className="flex items-center gap-1">
            <Users className="h-4 w-4" />
            <span>{finaleResult.playerScores.length} players</span>
          </div>
          <div className="flex items-center gap-1">
            <Target className="h-4 w-4" />
            <span>{finaleResult.totalRounds} rounds</span>
          </div>
        </div>
      </div>

      {/* Winners Podium */}
      <Podium players={finaleResult.playerScores} />

      {/* Token Summary */}
      <TokenSummary finaleResult={finaleResult} />

      {/* Winner Section */}
      {finaleResult.winner && (
        <Card className="bg-gradient-to-r from-yellow-50 to-amber-50 border-yellow-200">
          <CardHeader className="text-center">
            <CardTitle className="flex items-center justify-center gap-2 text-2xl font-bold text-yellow-800">
              <Trophy className="h-8 w-8" />
              Winner: {finaleResult.winner.firstName} {finaleResult.winner.lastName}
            </CardTitle>
            <p className="text-lg text-yellow-700">
              {formatScore(finaleResult.winner.finalScore)} points
            </p>
          </CardHeader>
          <CardContent className="text-center">
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <p className="text-yellow-600 font-medium">Accuracy</p>
                <p className="text-lg font-bold">
                  {formatAccuracy(finaleResult.winner.correctAnswers, finaleResult.winner.totalAnswers)}
                </p>
              </div>
              <div>
                <p className="text-yellow-600 font-medium">Correct Answers</p>
                <p className="text-lg font-bold">{finaleResult.winner.correctAnswers}</p>
              </div>
              <div>
                <p className="text-yellow-600 font-medium">Tokens Earned</p>
                <p className="text-lg font-bold">{finaleResult.winner.unusedPromptTokens}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Deck Usage Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Deck Usage
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Questions Used</span>
              <span className="text-sm text-gray-600">
                {finaleResult.deckUsagePercentage}% ({finaleResult.gameStats.usedQuestions || 0} of {finaleResult.gameStats.totalQuestions || 0})
              </span>
            </div>
            <Progress value={finaleResult.deckUsagePercentage} className="h-2" />
            <div className="flex items-center gap-2">
              {finaleResult.deckUsageRequirementMet ? (
                <CheckCircle className="h-4 w-4 text-green-500" />
              ) : (
                <AlertTriangle className="h-4 w-4 text-red-500" />
              )}
              <span className={`text-sm font-medium ${
                finaleResult.deckUsageRequirementMet ? 'text-green-700' : 'text-red-700'
              }`}>
                {finaleResult.deckUsageRequirementMet 
                  ? 'Deck usage requirement met (≥50%)' 
                  : 'Deck usage requirement not met (≥50% required)'
                }
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Player Rankings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Award className="h-5 w-5" />
            Final Rankings
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {finaleResult.playerScores.map((player, index) => (
              <div
                key={player.playerId}
                className={`flex items-center justify-between p-4 rounded-lg border transition-all duration-200 ${
                  player.rank === 1 
                    ? 'bg-yellow-50 border-yellow-200 ring-2 ring-yellow-100' 
                    : player.rank === 2
                    ? 'bg-gray-50 border-gray-200'
                    : player.rank === 3
                    ? 'bg-amber-50 border-amber-200'
                    : 'bg-white border-gray-200'
                }`}
              >
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    {getRankIcon(player.rank)}
                    <Badge className={getRankColor(player.rank)}>
                      #{player.rank}
                    </Badge>
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">
                      {player.firstName} {player.lastName}
                    </p>
                    <p className="text-sm text-gray-600">@{player.username}</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-6 text-sm">
                  <div className="text-center">
                    <p className="font-medium text-gray-900">{formatScore(player.finalScore)}</p>
                    <p className="text-gray-600">points</p>
                  </div>
                  <div className="text-center">
                    <p className="font-medium text-gray-900">
                      {formatAccuracy(player.correctAnswers, player.totalAnswers)}
                    </p>
                    <p className="text-gray-600">accuracy</p>
                  </div>
                  <div className="text-center">
                    <p className="font-medium text-gray-900">{player.unusedPromptTokens}</p>
                    <p className="text-gray-600">tokens</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Game Statistics */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Game Statistics
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <p className="text-2xl font-bold text-blue-600">
                {finaleResult.gameStats.averageScore || 0}
              </p>
              <p className="text-sm text-gray-600">Average Score</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-green-600">
                {finaleResult.gameStats.averageAccuracy || 0}%
              </p>
              <p className="text-sm text-gray-600">Average Accuracy</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-purple-600">
                {finaleResult.totalUnusedPromptTokens}
              </p>
              <p className="text-sm text-gray-600">Total Tokens</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-orange-600">
                {finaleResult.gameStats.totalCorrectAnswers || 0}
              </p>
              <p className="text-sm text-gray-600">Correct Answers</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Action Buttons */}
      <div className="flex flex-col sm:flex-row gap-4 justify-center">
        <Button 
          onClick={resetAndPlayAgain} 
          size="lg" 
          className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white"
          disabled={isResetting}
        >
          {isResetting ? (
            <RefreshCw className="h-4 w-4 animate-spin" />
          ) : (
            <Play className="h-4 w-4" />
          )}
          {isResetting ? 'Resetting...' : 'Play Again'}
        </Button>
        
        {onViewArchive && (
          <Button onClick={onViewArchive} variant="outline" size="lg" className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            View Archive
          </Button>
        )}
        
        {onShareResults && (
          <Button onClick={onShareResults} variant="outline" size="lg" className="flex items-center gap-2">
            <Coins className="h-4 w-4" />
            Share Results
          </Button>
        )}
      </div>
    </div>
  );
}; 
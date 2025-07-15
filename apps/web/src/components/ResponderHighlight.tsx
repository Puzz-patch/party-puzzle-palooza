import React, { useState, useEffect } from 'react';
import { Card, CardContent } from './ui/card';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { Badge } from './ui/badge';
import { Progress } from './ui/progress';
import { 
  User, 
  Clock, 
  Target, 
  AlertTriangle,
  CheckCircle,
  Zap
} from 'lucide-react';

interface ResponderHighlightProps {
  responderId: string;
  responderName: string;
  responderAvatar?: string;
  countdownDuration: number; // in milliseconds
  onCountdownComplete?: () => void;
  phase: 'response' | 'reveal_gamble' | 'finished';
}

export const ResponderHighlight: React.FC<ResponderHighlightProps> = ({
  responderId,
  responderName,
  responderAvatar,
  countdownDuration,
  onCountdownComplete,
  phase,
}) => {
  const [timeRemaining, setTimeRemaining] = useState(countdownDuration);
  const [isCountdownActive, setIsCountdownActive] = useState(true);

  useEffect(() => {
    if (phase !== 'response') {
      setIsCountdownActive(false);
      return;
    }

    setIsCountdownActive(true);
    setTimeRemaining(countdownDuration);

    const interval = setInterval(() => {
      setTimeRemaining(prev => {
        if (prev <= 1000) {
          setIsCountdownActive(false);
          onCountdownComplete?.();
          return 0;
        }
        return prev - 1000;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [countdownDuration, phase, onCountdownComplete]);

  const getPlayerInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n.charAt(0))
      .join('')
      .toUpperCase()
      .substring(0, 2);
  };

  const formatTime = (milliseconds: number) => {
    const seconds = Math.ceil(milliseconds / 1000);
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getProgressPercentage = () => {
    return ((countdownDuration - timeRemaining) / countdownDuration) * 100;
  };

  const getPhaseColor = () => {
    switch (phase) {
      case 'response':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'reveal_gamble':
        return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'finished':
        return 'bg-green-100 text-green-800 border-green-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getPhaseIcon = () => {
    switch (phase) {
      case 'response':
        return <Clock className="h-4 w-4" />;
      case 'reveal_gamble':
        return <Zap className="h-4 w-4" />;
      case 'finished':
        return <CheckCircle className="h-4 w-4" />;
      default:
        return <Clock className="h-4 w-4" />;
    }
  };

  const getPhaseLabel = () => {
    switch (phase) {
      case 'response':
        return 'Response Phase';
      case 'reveal_gamble':
        return 'Reveal & Gamble';
      case 'finished':
        return 'Round Complete';
      default:
        return 'Waiting';
    }
  };

  return (
    <Card className="w-full border-2 border-blue-200 bg-blue-50">
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="relative">
              <Avatar className="h-16 w-16 ring-4 ring-blue-400 ring-offset-2 animate-pulse">
                <AvatarImage src={responderAvatar} />
                <AvatarFallback className="bg-blue-100 text-blue-700 text-lg font-bold">
                  {getPlayerInitials(responderName)}
                </AvatarFallback>
              </Avatar>
              <div className="absolute -top-1 -right-1">
                <Target className="h-5 w-5 text-blue-600 bg-white rounded-full p-0.5" />
              </div>
            </div>
            
            <div>
              <h3 className="text-lg font-bold text-blue-900">
                {responderName}
              </h3>
              <p className="text-sm text-blue-700">
                Selected to respond
              </p>
            </div>
          </div>

          <Badge className={`${getPhaseColor()} flex items-center gap-1`}>
            {getPhaseIcon()}
            {getPhaseLabel()}
          </Badge>
        </div>

        {/* Countdown Section */}
        {isCountdownActive && phase === 'response' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-blue-600" />
                <span className="text-sm font-medium text-blue-800">
                  Time to respond:
                </span>
              </div>
              
              <div className="text-lg font-mono font-bold text-blue-900">
                {formatTime(timeRemaining)}
              </div>
            </div>

            <Progress 
              value={getProgressPercentage()} 
              className="h-2 bg-blue-100"
            />

            {/* Warning when time is running low */}
            {timeRemaining <= 10000 && timeRemaining > 0 && (
              <div className="flex items-center gap-2 p-2 bg-orange-100 rounded-md">
                <AlertTriangle className="h-4 w-4 text-orange-600" />
                <span className="text-sm font-medium text-orange-800">
                  Time is running out!
                </span>
              </div>
            )}
          </div>
        )}

        {/* Phase transition message */}
        {!isCountdownActive && phase === 'response' && (
          <div className="flex items-center gap-2 p-3 bg-orange-100 rounded-md">
            <Zap className="h-4 w-4 text-orange-600" />
            <span className="text-sm font-medium text-orange-800">
              Time's up! Moving to Reveal & Gamble phase...
            </span>
          </div>
        )}

        {/* Reveal & Gamble phase */}
        {phase === 'reveal_gamble' && (
          <div className="flex items-center gap-2 p-3 bg-orange-100 rounded-md">
            <Zap className="h-4 w-4 text-orange-600" />
            <span className="text-sm font-medium text-orange-800">
              Reveal & Gamble phase active
            </span>
          </div>
        )}

        {/* Round complete */}
        {phase === 'finished' && (
          <div className="flex items-center gap-2 p-3 bg-green-100 rounded-md">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <span className="text-sm font-medium text-green-800">
              Round complete!
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}; 
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { ScrollArea } from './ui/scroll-area';
import { Button } from './ui/button';
import { 
  Eye, 
  EyeOff, 
  Archive, 
  Clock, 
  Users, 
  Trophy,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';

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

interface ArchivedPromptsProps {
  gameId: string;
  isOpen: boolean;
  onToggle: () => void;
  prompts: ArchivedPrompt[];
  onPromptSelect?: (prompt: ArchivedPrompt) => void;
}

export const ArchivedPrompts: React.FC<ArchivedPromptsProps> = ({
  gameId,
  isOpen,
  onToggle,
  prompts,
  onPromptSelect
}) => {
  const [selectedPrompt, setSelectedPrompt] = useState<string | null>(null);

  const handlePromptClick = (prompt: ArchivedPrompt) => {
    setSelectedPrompt(prompt.id);
    onPromptSelect?.(prompt);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getRevealStatus = (prompt: ArchivedPrompt) => {
    if (prompt.revealed) {
      return {
        icon: <Eye className="h-4 w-4" />,
        label: 'Revealed',
        color: 'bg-green-100 text-green-800 border-green-200'
      };
    } else {
      return {
        icon: <EyeOff className="h-4 w-4" />,
        label: 'Hidden',
        color: 'bg-gray-100 text-gray-800 border-gray-200'
      };
    }
  };

  const getCompletionStatus = (prompt: ArchivedPrompt) => {
    const completionRate = (prompt.respondedPlayers / prompt.totalPlayers) * 100;
    
    if (completionRate === 100) {
      return {
        icon: <Trophy className="h-4 w-4" />,
        label: 'Complete',
        color: 'bg-blue-100 text-blue-800 border-blue-200'
      };
    } else if (completionRate > 50) {
      return {
        icon: <Clock className="h-4 w-4" />,
        label: `${Math.round(completionRate)}%`,
        color: 'bg-yellow-100 text-yellow-800 border-yellow-200'
      };
    } else {
      return {
        icon: <Users className="h-4 w-4" />,
        label: `${prompt.respondedPlayers}/${prompt.totalPlayers}`,
        color: 'bg-orange-100 text-orange-800 border-orange-200'
      };
    }
  };

  const renderPromptContent = (prompt: ArchivedPrompt) => {
    if (prompt.revealed) {
      return (
        <div className="space-y-2">
          <p className="text-sm font-medium text-gray-900">
            {prompt.question}
          </p>
          <div className="space-y-1">
            {prompt.options.map((option, index) => (
              <div
                key={index}
                className={`text-xs p-2 rounded ${
                  option === prompt.correctAnswer
                    ? 'bg-green-100 text-green-800 border border-green-200'
                    : 'bg-gray-50 text-gray-700 border border-gray-200'
                }`}
              >
                {option}
                {option === prompt.correctAnswer && (
                  <span className="ml-2 text-green-600">✓</span>
                )}
              </div>
            ))}
          </div>
          {prompt.winner && (
            <div className="text-xs text-blue-600 font-medium">
              Winner: {prompt.winner} ({prompt.winnerScore} pts)
            </div>
          )}
        </div>
      );
    } else {
      return (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-gray-500">
            <span className="text-lg">🌫️</span>
            <span className="text-sm font-medium">Fog of War</span>
          </div>
          <p className="text-sm text-gray-400 italic">
            This round's details are hidden until revealed
          </p>
          <div className="space-y-1">
            {prompt.options.map((_, index) => (
              <div
                key={index}
                className="text-xs p-2 rounded bg-gray-100 text-gray-400 border border-gray-200"
              >
                ••••••••
              </div>
            ))}
          </div>
        </div>
      );
    }
  };

  if (!isOpen) {
    return (
      <div className="fixed right-0 top-1/2 transform -translate-y-1/2 z-40">
        <Button
          onClick={onToggle}
          variant="outline"
          size="sm"
          className="rounded-l-lg rounded-r-none border-r-0 shadow-lg"
        >
          <Archive className="h-4 w-4 mr-2" />
          Archive
          <ChevronLeft className="h-4 w-4 ml-2" />
        </Button>
      </div>
    );
  }

  return (
    <div className="fixed right-0 top-0 h-full w-80 bg-white border-l border-gray-200 shadow-xl z-50 flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 bg-gray-50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Archive className="h-5 w-5 text-gray-600" />
            <h2 className="text-lg font-semibold text-gray-900">Archived Rounds</h2>
          </div>
          <Button
            onClick={onToggle}
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <p className="text-sm text-gray-600 mt-1">
          {prompts.length} round{prompts.length !== 1 ? 's' : ''} completed
        </p>
      </div>

      {/* Content */}
      <ScrollArea className="flex-1 p-4">
        <div className="space-y-4">
          {prompts.length === 0 ? (
            <div className="text-center py-8">
              <Archive className="h-12 w-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500 text-sm">
                No archived rounds yet
              </p>
              <p className="text-gray-400 text-xs mt-1">
                Completed rounds will appear here
              </p>
            </div>
          ) : (
            prompts.map((prompt) => {
              const revealStatus = getRevealStatus(prompt);
              const completionStatus = getCompletionStatus(prompt);
              const isSelected = selectedPrompt === prompt.id;

              return (
                <Card
                  key={prompt.id}
                  className={`cursor-pointer transition-all duration-200 hover:shadow-md ${
                    isSelected
                      ? 'ring-2 ring-blue-500 bg-blue-50'
                      : 'hover:bg-gray-50'
                  }`}
                  onClick={() => handlePromptClick(prompt)}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm font-medium text-gray-900">
                        Round {prompt.roundNumber}
                      </CardTitle>
                      <div className="flex items-center gap-1">
                        <Badge className={`text-xs ${revealStatus.color}`}>
                          {revealStatus.icon}
                          {revealStatus.label}
                        </Badge>
                        <Badge className={`text-xs ${completionStatus.color}`}>
                          {completionStatus.icon}
                          {completionStatus.label}
                        </Badge>
                      </div>
                    </div>
                    <p className="text-xs text-gray-500">
                      {formatDate(prompt.archivedAt)}
                    </p>
                  </CardHeader>
                  <CardContent className="pt-0">
                    {renderPromptContent(prompt)}
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>
      </ScrollArea>

      {/* Footer */}
      <div className="p-4 border-t border-gray-200 bg-gray-50">
        <div className="flex items-center justify-between text-xs text-gray-600">
          <span>
            {prompts.filter(p => p.revealed).length} revealed
          </span>
          <span>
            {prompts.filter(p => !p.revealed).length} hidden
          </span>
        </div>
      </div>
    </div>
  );
}; 
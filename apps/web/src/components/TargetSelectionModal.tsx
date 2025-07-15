import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { Badge } from './ui/badge';
import { Loader2, Target, Users, CheckCircle, XCircle } from 'lucide-react';
import { useGameStore, useGamePlayers } from '../stores/game-store';
import { useToast } from '../hooks/use-toast';

interface TargetSelectionModalProps {
  roundId: string;
  isOpen: boolean;
  onClose: () => void;
  currentAskerId: string;
}

interface TargetPlayer {
  id: string;
  username: string;
  firstName: string;
  lastName: string;
  avatarUrl?: string;
  score: number;
  isHost: boolean;
  isSpectator: boolean;
}

export const TargetSelectionModal: React.FC<TargetSelectionModalProps> = ({
  roundId,
  isOpen,
  onClose,
  currentAskerId,
}) => {
  const [selectedTarget, setSelectedTarget] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const players = useGamePlayers();
  const { toast } = useToast();

  // Filter out the current asker and spectators from target options
  const availableTargets = players.filter(
    (player) => player.id !== currentAskerId && !player.isSpectator
  );

  const handleTargetSelect = (targetId: string) => {
    setSelectedTarget(targetId === selectedTarget ? null : targetId);
    setError(null);
  };

  const handleSubmit = async () => {
    if (!selectedTarget) {
      setError('Please select a target player');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch(`/api/rounds/${roundId}/target`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          targetPlayerId: selectedTarget,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to set target');
      }

      const result = await response.json();

      // Optimistic UI update
      // You can add game state updates here if needed

      // Show success toast
      toast({
        title: 'Target Set!',
        description: `You've selected ${availableTargets.find(p => p.id === selectedTarget)?.firstName} as your target.`,
        variant: 'default',
      });

      // Close modal
      onClose();
      setSelectedTarget(null);

    } catch (error) {
      console.error('Error setting target:', error);
      setError(error instanceof Error ? error.message : 'Failed to set target');
      
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to set target',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      setSelectedTarget(null);
      setError(null);
      onClose();
    }
  };

  const getPlayerInitials = (player: TargetPlayer) => {
    return `${player.firstName.charAt(0)}${player.lastName.charAt(0)}`.toUpperCase();
  };

  const getPlayerDisplayName = (player: TargetPlayer) => {
    return `${player.firstName} ${player.lastName}`;
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Target className="h-5 w-5 text-blue-600" />
            Select Your Target
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Instructions */}
          <div className="text-sm text-gray-600 bg-blue-50 p-3 rounded-md">
            <p className="font-medium mb-1">🎯 Choose who you want to ask this question to:</p>
            <p>This selection will be private and only visible to you.</p>
          </div>

          {/* Available Targets */}
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-gray-700 flex items-center gap-2">
              <Users className="h-4 w-4" />
              Available Players ({availableTargets.length})
            </h3>
            
            <div className="grid gap-2 max-h-60 overflow-y-auto">
              {availableTargets.map((player) => (
                <Card
                  key={player.id}
                  className={`cursor-pointer transition-all duration-200 hover:shadow-md ${
                    selectedTarget === player.id
                      ? 'ring-2 ring-blue-500 bg-blue-50'
                      : 'hover:bg-gray-50'
                  }`}
                  onClick={() => handleTargetSelect(player.id)}
                >
                  <CardContent className="p-3">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={player.avatarUrl} />
                        <AvatarFallback className="bg-blue-100 text-blue-700">
                          {getPlayerInitials(player)}
                        </AvatarFallback>
                      </Avatar>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-sm truncate">
                            {getPlayerDisplayName(player)}
                          </p>
                          {player.isHost && (
                            <Badge className="text-xs bg-yellow-100 text-yellow-800">
                              Host
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-gray-500">
                          Score: {player.score} points
                        </p>
                      </div>

                      <div className="flex items-center">
                        {selectedTarget === player.id ? (
                          <CheckCircle className="h-5 w-5 text-blue-600" />
                        ) : (
                          <div className="h-5 w-5 rounded-full border-2 border-gray-300" />
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {availableTargets.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                <Users className="h-12 w-12 mx-auto mb-2 text-gray-300" />
                <p>No players available to target</p>
              </div>
            )}
          </div>

          {/* Error Display */}
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-md">
              <div className="flex items-center gap-2 text-red-800">
                <XCircle className="h-4 w-4" />
                <span className="text-sm font-medium">Error</span>
              </div>
              <p className="text-sm text-red-600 mt-1">{error}</p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-2 pt-4">
            <Button
              variant="outline"
              onClick={handleClose}
              disabled={isSubmitting}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={!selectedTarget || isSubmitting}
              className="flex-1"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Setting Target...
                </>
              ) : (
                <>
                  <Target className="h-4 w-4 mr-2" />
                  Set Target
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}; 
import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { 
  Users, 
  Play, 
  Settings, 
  Copy, 
  Check,
  RefreshCw,
  Sparkles
} from 'lucide-react';
import { useToast } from '../hooks/use-toast';

export const GameLobby: React.FC = () => {
  const { gid } = useParams<{ gid: string }>();
  const [game, setGame] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    if (gid) {
      fetchGameData();
    }
  }, [gid]);

  const fetchGameData = async () => {
    if (!gid) return;
    
    try {
      const response = await fetch(`/api/games/${gid}/manifest`, {
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error('Failed to fetch game data');
      }

      const data = await response.json();
      setGame(data);
    } catch (error) {
      console.error('Error fetching game data:', error);
      toast({
        title: 'Error',
        description: 'Failed to load game data',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const copyGameCode = async () => {
    if (game?.code) {
      try {
        await navigator.clipboard.writeText(game.code);
        setCopied(true);
        toast({
          title: 'Copied! 📋',
          description: 'Game code copied to clipboard',
          variant: 'default',
        });
        setTimeout(() => setCopied(false), 2000);
      } catch (error) {
        console.error('Failed to copy:', error);
      }
    }
  };

  const startGame = () => {
    if (gid) {
      navigate(`/game/${gid}/build`);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="h-12 w-12 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Loading lobby...</p>
        </div>
      </div>
    );
  }

  if (!game) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600">Game not found</p>
          <Button onClick={() => navigate('/')} className="mt-4">
            Go Home
          </Button>
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
              <h1 className="text-2xl font-bold text-gray-900">{game.name}</h1>
              <p className="text-sm text-gray-600">Game Lobby</p>
            </div>
            
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Users className="h-4 w-4" />
                <span>{game.currentPlayers}/{game.maxPlayers} players</span>
              </div>
              
              <Badge className="bg-green-100 text-green-800 border-green-200">
                <Sparkles className="h-3 w-3 mr-1" />
                Ready
              </Badge>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Game Code Section */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Copy className="h-5 w-5" />
              Game Code
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <div className="bg-gray-100 p-4 rounded-lg">
                  <p className="text-2xl font-mono font-bold text-center text-gray-900">
                    {game.code}
                  </p>
                </div>
              </div>
              <Button 
                onClick={copyGameCode} 
                variant="outline"
                className="flex items-center gap-2"
              >
                {copied ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
                {copied ? 'Copied!' : 'Copy'}
              </Button>
            </div>
            <p className="text-sm text-gray-600 mt-2 text-center">
              Share this code with friends to join the game
            </p>
          </CardContent>
        </Card>

        {/* Players Section */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Players ({game.players?.length || 0})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {game.players && game.players.length > 0 ? (
              <div className="grid gap-3">
                {game.players.map((player: any) => (
                  <div
                    key={player.id}
                    className="flex items-center justify-between p-3 rounded-lg border border-gray-200 bg-white"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                        <span className="text-sm font-semibold text-blue-700">
                          {player.firstName.charAt(0)}
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
                      {player.isHost && (
                        <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200">
                          Host
                        </Badge>
                      )}
                      <Badge className="bg-green-100 text-green-800 border-green-200">
                        Ready
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <Users className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500">No players joined yet</p>
                <p className="text-gray-400 text-sm mt-1">
                  Share the game code to invite players
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Game Settings */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Game Settings
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <p className="text-2xl font-bold text-blue-600">{game.roundsPerGame}</p>
                <p className="text-sm text-gray-600">Rounds</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-green-600">{game.timePerRound}s</p>
                <p className="text-sm text-gray-600">Time per Round</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-purple-600">{game.maxPlayers}</p>
                <p className="text-sm text-gray-600">Max Players</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-orange-600">{game.type}</p>
                <p className="text-sm text-gray-600">Game Type</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Button 
            onClick={startGame}
            size="lg" 
            className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white"
            disabled={!game.players || game.players.length < 2}
          >
            <Play className="h-4 w-4" />
            Start Game
          </Button>
          
          <Button 
            onClick={fetchGameData}
            variant="outline" 
            size="lg" 
            className="flex items-center gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
        </div>

        {(!game.players || game.players.length < 2) && (
          <div className="text-center mt-4">
            <p className="text-sm text-gray-600">
              Need at least 2 players to start the game
            </p>
          </div>
        )}
      </div>
    </div>
  );
}; 
import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Copy, Play, Users, Crown, LogOut } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface Room {
  id: string;
  room_code: string;
  name: string;
  host_id: string;
  current_game: string;
  game_state: any;
  is_active: boolean;
}

interface Player {
  id: string;
  player_name: string;
  player_id: string;
  is_host: boolean;
}

interface RoomLobbyProps {
  room: Room;
  players: Player[];
  currentPlayer: Player;
  onUpdateRoom: (room: Room) => void;
}

export const RoomLobby = ({ room, players, currentPlayer, onUpdateRoom }: RoomLobbyProps) => {
  const [isStarting, setIsStarting] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  const copyRoomCode = () => {
    navigator.clipboard.writeText(room.room_code);
    toast({
      title: "Copied!",
      description: "Room code copied to clipboard",
      className: "bg-success text-success-foreground",
    });
  };

  const startGame = async () => {
    if (!currentPlayer.is_host) return;

    setIsStarting(true);
    try {
      const { error } = await supabase
        .from("rooms")
        .update({
          game_state: { 
            phase: "playing", 
            currentQuestion: null, 
            questionIndex: 0,
            votes: {},
            showResults: false
          }
        })
        .eq("id", room.id);

      if (error) throw error;

      toast({
        title: "Game Started!",
        description: "Would You Rather game is now beginning",
        className: "bg-success text-success-foreground",
      });
    } catch (error) {
      console.error("Error starting game:", error);
      toast({
        title: "Error",
        description: "Failed to start game",
        variant: "destructive",
      });
    } finally {
      setIsStarting(false);
    }
  };

  const leaveRoom = async () => {
    try {
      // Remove player from room
      await supabase
        .from("players")
        .delete()
        .eq("player_id", currentPlayer.player_id);

      // If host is leaving, close the room
      if (currentPlayer.is_host) {
        await supabase
          .from("rooms")
          .update({ is_active: false })
          .eq("id", room.id);
      }

      // Clear local storage
      localStorage.removeItem("puzzz_player_id");
      localStorage.removeItem("puzzz_player_name");

      toast({
        title: "Left Room",
        description: "You have left the room",
      });

      navigate("/");
    } catch (error) {
      console.error("Error leaving room:", error);
      toast({
        title: "Error",
        description: "Failed to leave room",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-foreground mb-4">{room.name}</h1>
          <div className="flex items-center justify-center gap-4 mb-4">
            <div className="room-code">{room.room_code}</div>
            <Button
              variant="outline"
              size="sm"
              onClick={copyRoomCode}
              className="gap-2"
            >
              <Copy className="h-4 w-4" />
              Copy Code
            </Button>
          </div>
          <p className="text-muted-foreground">
            Share the room code with friends to let them join
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-8">
          {/* Players List */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Players ({players.length})
              </CardTitle>
              <CardDescription>
                Waiting for more players to join...
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {players.map((player) => (
                  <div
                    key={player.id}
                    className="flex items-center justify-between p-3 bg-muted rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-primary rounded-full flex items-center justify-center text-primary-foreground font-semibold">
                        {player.player_name.charAt(0).toUpperCase()}
                      </div>
                      <span className="font-medium">{player.player_name}</span>
                    </div>
                    {player.is_host && (
                      <Badge variant="secondary" className="gap-1">
                        <Crown className="h-3 w-3" />
                        Host
                      </Badge>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Game Info */}
          <Card>
            <CardHeader>
              <CardTitle>Would You Rather</CardTitle>
              <CardDescription>
                Choose between two interesting scenarios and see how everyone votes!
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 bg-muted rounded-lg">
                <h4 className="font-semibold mb-2">How to Play:</h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• Read the question carefully</li>
                  <li>• Choose Option A or Option B</li>
                  <li>• See how others voted</li>
                  <li>• Discuss and have fun!</li>
                </ul>
              </div>

              <div className="flex gap-2">
                <div className="flex-1 p-3 game-option-a rounded-lg text-center text-white font-medium">
                  Option A
                </div>
                <div className="flex-1 p-3 game-option-b rounded-lg text-center text-white font-medium">
                  Option B
                </div>
              </div>

              {currentPlayer.is_host ? (
                <Button
                  onClick={startGame}
                  disabled={isStarting || players.length < 2}
                  className="w-full text-lg py-6"
                  size="lg"
                >
                  {isStarting ? (
                    "Starting Game..."
                  ) : players.length < 2 ? (
                    "Need at least 2 players"
                  ) : (
                    <>
                      <Play className="mr-2 h-5 w-5" />
                      Start Game
                    </>
                  )}
                </Button>
              ) : (
                <div className="text-center p-4 bg-muted rounded-lg">
                  <p className="text-muted-foreground">
                    Waiting for the host to start the game...
                  </p>
                  <div className="inline-flex items-center gap-2 mt-2">
                    <div className="w-2 h-2 bg-primary rounded-full animate-bounce"></div>
                    <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: "0.1s" }}></div>
                    <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: "0.2s" }}></div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Leave Room Button */}
        <div className="flex justify-center mt-8">
          <Button
            variant="outline"
            onClick={leaveRoom}
            className="gap-2 text-destructive hover:text-destructive"
          >
            <LogOut className="h-4 w-4" />
            Leave Room
          </Button>
        </div>
      </div>
    </div>
  );
};
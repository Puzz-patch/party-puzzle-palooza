import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Plus } from "lucide-react";

export const CreateRoom = () => {
  const [roomName, setRoomName] = useState("");
  const [hostName, setHostName] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const generateRoomCode = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 6; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  };

  const createRoom = async () => {
    if (!roomName.trim() || !hostName.trim()) {
      toast({
        title: "Missing Information",
        description: "Please fill in both room name and your name.",
        variant: "destructive",
      });
      return;
    }

    setIsCreating(true);
    try {
      const roomCode = generateRoomCode();
      const hostId = crypto.randomUUID();

      // Create room
      const { data: roomData, error: roomError } = await supabase
        .from("rooms")
        .insert({
          room_code: roomCode,
          name: roomName.trim(),
          host_id: hostId,
          current_game: "would_you_rather",
          game_state: { phase: "lobby", currentQuestion: null, votes: {} }
        })
        .select()
        .single();

      if (roomError) throw roomError;

      // Add host as player
      const { error: playerError } = await supabase
        .from("players")
        .insert({
          room_id: roomData.id,
          player_name: hostName.trim(),
          player_id: hostId,
          is_host: true
        });

      if (playerError) throw playerError;

      // Store host info in localStorage
      localStorage.setItem("puzzz_player_id", hostId);
      localStorage.setItem("puzzz_player_name", hostName.trim());

      toast({
        title: "Room Created!",
        description: `Room "${roomName}" created with code ${roomCode}`,
        className: "bg-success text-success-foreground",
      });

      navigate(`/room/${roomCode}`);
    } catch (error) {
      console.error("Error creating room:", error);
      toast({
        title: "Error",
        description: "Failed to create room. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <Card className="w-full max-w-lg shadow-lg">
      <CardHeader className="text-center">
        <div className="mx-auto mb-4 p-3 bg-primary/10 rounded-full w-fit">
          <Plus className="h-8 w-8 text-primary" />
        </div>
        <CardTitle className="text-2xl">Create New Room</CardTitle>
        <CardDescription className="text-base">
          Start a new game session for you and your friends
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="roomName" className="text-base font-medium">
            Room Name
          </Label>
          <Input
            id="roomName"
            placeholder="Enter a fun room name..."
            value={roomName}
            onChange={(e) => setRoomName(e.target.value)}
            className="text-lg py-3"
            maxLength={50}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="hostName" className="text-base font-medium">
            Your Name
          </Label>
          <Input
            id="hostName"
            placeholder="Enter your name..."
            value={hostName}
            onChange={(e) => setHostName(e.target.value)}
            className="text-lg py-3"
            maxLength={30}
          />
        </div>

        <Button 
          onClick={createRoom} 
          disabled={isCreating}
          className="w-full text-lg py-6 bg-primary hover:bg-primary-hover shadow-md"
          size="lg"
        >
          {isCreating ? (
            <>
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              Creating Room...
            </>
          ) : (
            <>
              <Plus className="mr-2 h-5 w-5" />
              Create Room
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
};
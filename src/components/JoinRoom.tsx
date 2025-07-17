
import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, UserPlus } from "lucide-react";
import { useAnalyticsContext } from "@/providers/AnalyticsProvider";
import { useAuth } from "@/hooks/useAuth";
import { validatePlayerName, validateRoomCode } from "@/utils/inputValidation";

export const JoinRoom = () => {
  const [roomCode, setRoomCode] = useState("");
  const [playerName, setPlayerName] = useState("");
  const [isJoining, setIsJoining] = useState(false);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const { trackEvent } = useAnalyticsContext();
  const { createSession } = useAuth();

  // Check for room code in URL parameters (from QR code)
  useEffect(() => {
    const urlRoomCode = searchParams.get("room");
    if (urlRoomCode) {
      setRoomCode(urlRoomCode.toUpperCase());
    }
  }, [searchParams]);

  const joinRoom = async () => {
    const trimmedRoomCode = roomCode.trim().toUpperCase();
    const trimmedPlayerName = playerName.trim();

    if (!trimmedRoomCode || !trimmedPlayerName) {
      toast({
        title: "Missing Information",
        description: "Please fill in both room code and your name.",
        variant: "destructive",
      });
      return;
    }

    if (trimmedRoomCode.length !== 6) {
      toast({
        title: "Invalid Room Code",
        description: "Room code must be 6 characters long.",
        variant: "destructive",
      });
      return;
    }

    // Validate inputs using enhanced validation
    const isValidRoomCode = await validateRoomCode(trimmedRoomCode);
    const isValidPlayerName = await validatePlayerName(trimmedPlayerName);

    if (!isValidRoomCode) {
      toast({
        title: "Invalid Room Code",
        description: "Please enter a valid room code.",
        variant: "destructive",
      });
      return;
    }

    if (!isValidPlayerName) {
      toast({
        title: "Invalid Name",
        description: "Please enter a valid name (1-30 characters, no special characters).",
        variant: "destructive",
      });
      return;
    }

    setIsJoining(true);
    try {
      console.log("Joining room with code:", trimmedRoomCode);
      
      // Check if room exists and is active
      const { data: roomData, error: roomError } = await supabase
        .from("rooms")
        .select("*")
        .eq("room_code", trimmedRoomCode)
        .eq("is_active", true)
        .maybeSingle();

      if (roomError) {
        console.error("Room lookup error:", roomError);
        throw new Error("Failed to check room");
      }

      if (!roomData) {
        toast({
          title: "Room Not Found",
          description: "Please check your room code and try again.",
          variant: "destructive",
        });
        return;
      }

      console.log("Room found:", roomData);

      // Check if player name is already taken in this room
      const { data: existingPlayer } = await supabase
        .from("players")
        .select("player_name")
        .eq("room_id", roomData.id)
        .eq("player_name", trimmedPlayerName)
        .maybeSingle();

      if (existingPlayer) {
        toast({
          title: "Name Taken",
          description: "This name is already taken in this room. Please choose another.",
          variant: "destructive",
        });
        return;
      }

      const playerId = crypto.randomUUID();

      // Create session first
      await createSession(playerId, trimmedPlayerName);

      // Add player to room
      const { data: playerData, error: playerError } = await supabase
        .from("players")
        .insert({
          room_id: roomData.id,
          player_name: trimmedPlayerName,
          player_id: playerId,
          is_host: false
        })
        .select()
        .single();

      if (playerError) {
        console.error("Player creation error:", playerError);
        
        // Check if this is a unique constraint violation
        if (playerError.code === '23505') {
          toast({
            title: "Name Already Taken",
            description: "This name is already in use in this room. Please choose another name.",
            variant: "destructive",
          });
        } else {
          throw new Error("Failed to join room");
        }
        return;
      }

      console.log("Player created successfully:", playerData);

      // Store additional session data
      localStorage.setItem("puzzz_room_code", trimmedRoomCode);

      // Track player join
      trackEvent("player_joined", { 
        roomCode: trimmedRoomCode, 
        playerName: trimmedPlayerName 
      });

      toast({
        title: "Joined Room!",
        description: `Welcome to "${roomData.name}"`,
        className: "bg-success text-success-foreground",
      });

      navigate(`/room/${trimmedRoomCode}`);
    } catch (error) {
      console.error("Error joining room:", error);
      toast({
        title: "Error",
        description: "Failed to join room. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsJoining(false);
    }
  };

  return (
    <Card className="w-full max-w-lg shadow-lg">
      <CardHeader className="text-center">
        <div className="mx-auto mb-4 p-3 bg-accent/10 rounded-full w-fit">
          <UserPlus className="h-8 w-8 text-accent" />
        </div>
        <CardTitle className="text-2xl">Join Room</CardTitle>
        <CardDescription className="text-base">
          Enter a room code to join your friends
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="roomCode" className="text-base font-medium">
            Room Code
          </Label>
          <Input
            id="roomCode"
            placeholder="Enter 6-digit room code..."
            value={roomCode}
            onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
            className="text-lg py-3 text-center font-mono tracking-wider"
            maxLength={6}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="playerName" className="text-base font-medium">
            Your Name
          </Label>
          <Input
            id="playerName"
            placeholder="Enter your name..."
            value={playerName}
            onChange={(e) => setPlayerName(e.target.value)}
            className="text-lg py-3"
            maxLength={30}
          />
        </div>

        <Button 
          onClick={joinRoom} 
          disabled={isJoining}
          className="w-full text-lg py-6 bg-accent hover:bg-accent/90 shadow-md"
          size="lg"
        >
          {isJoining ? (
            <>
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              Joining Room...
            </>
          ) : (
            <>
              <UserPlus className="mr-2 h-5 w-5" />
              Join Room
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
};

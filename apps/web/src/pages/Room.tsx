import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { RoomLobby } from "@/components/RoomLobby";
import { WouldYouRatherGame } from "@/components/WouldYouRatherGame";
import { Loader2 } from "lucide-react";

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

export const Room = () => {
  const { roomCode } = useParams<{ roomCode: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [room, setRoom] = useState<Room | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [currentPlayer, setCurrentPlayer] = useState<Player | null>(null);
  const [loading, setLoading] = useState(true);
  const cleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!roomCode) {
      navigate("/");
      return;
    }

    const playerId = localStorage.getItem("puzzz_player_id");
    const playerName = localStorage.getItem("puzzz_player_name");

    if (!playerId || !playerName) {
      toast({
        title: "Access Denied",
        description: "Please join the room properly.",
        variant: "destructive",
      });
      navigate("/");
      return;
    }

    loadRoomData();
    
    // Cleanup on unmount
    return () => {
      if (cleanupRef.current) {
        cleanupRef.current();
      }
    };
  }, [roomCode]);

  const loadRoomData = async () => {
    try {
      // Load room data
      const { data: roomData, error: roomError } = await supabase
        .from("rooms")
        .select("*")
        .eq("room_code", roomCode)
        .eq("is_active", true)
        .single();

      if (roomError || !roomData) {
        toast({
          title: "Room Not Found",
          description: "This room doesn't exist or has been closed.",
          variant: "destructive",
        });
        navigate("/");
        return;
      }

      setRoom(roomData);

      // Set up real-time subscriptions after room is loaded
      const cleanup = setupRealtimeSubscriptions(roomData);
      
      // Store cleanup function for later use
      cleanupRef.current = cleanup;

      // Load players
      const { data: playersData, error: playersError } = await supabase
        .from("players")
        .select("*")
        .eq("room_id", roomData.id)
        .order("joined_at", { ascending: true });

      if (playersError) throw playersError;

      setPlayers(playersData || []);

      // Find current player
      const playerId = localStorage.getItem("puzzz_player_id");
      const player = playersData?.find(p => p.player_id === playerId);
      setCurrentPlayer(player || null);

      if (!player) {
        toast({
          title: "Player Not Found",
          description: "You are not a member of this room.",
          variant: "destructive",
        });
        navigate("/");
        return;
      }

    } catch (error) {
      console.error("Error loading room data:", error);
      toast({
        title: "Error",
        description: "Failed to load room data.",
        variant: "destructive",
      });
      navigate("/");
    } finally {
      setLoading(false);
    }
  };

  const setupRealtimeSubscriptions = (roomData: Room) => {
    const roomChannel = supabase
      .channel(`room_${roomCode}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "rooms",
          filter: `room_code=eq.${roomCode}`,
        },
        (payload) => {
          console.log("Room update received:", payload);
          if (payload.eventType === "UPDATE") {
            setRoom(payload.new as Room);
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "players",
          filter: `room_id=eq.${roomData.id}`,
        },
        (payload) => {
          console.log("Player update received:", payload);
          // Reload players when any player in this room changes
          loadPlayers();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(roomChannel);
    };
  };

  const loadPlayers = async () => {
    if (!room) return;

    const { data: playersData } = await supabase
      .from("players")
      .select("*")
      .eq("room_id", room.id)
      .order("joined_at", { ascending: true });

    setPlayers(playersData || []);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center gradient-bg">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-lg text-muted-foreground">Loading room...</p>
        </div>
      </div>
    );
  }

  if (!room || !currentPlayer) {
    return null; // Will redirect in useEffect
  }

  const gamePhase = room.game_state?.phase || "lobby";

  return (
    <div className="min-h-screen gradient-bg">
      {gamePhase === "lobby" ? (
        <RoomLobby 
          room={room} 
          players={players} 
          currentPlayer={currentPlayer}
          onUpdateRoom={setRoom}
        />
      ) : (
        <WouldYouRatherGame 
          room={room} 
          players={players} 
          currentPlayer={currentPlayer}
          onUpdateRoom={setRoom}
        />
      )}
    </div>
  );
};
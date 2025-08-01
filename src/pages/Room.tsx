import { useParams, useNavigate } from "react-router-dom";
import { useRoom } from "@/hooks/useRoom";
import { RoomLobby } from "@/components/RoomLobby";
import { WouldYouRatherGame } from "@/components/WouldYouRatherGame";
import { ParanoiaGameV2 } from "@/components/ParanoiaGameV2";
import { OddOneOutGame } from "@/components/OddOneOutGame";
import { DogpatchGame } from "@/components/DogpatchGame";
import { NewFormsGame } from "@/components/NewFormsGame";
import { DramamatchingGame } from "@/components/DramamatchingGame";
import { SayItOrPayItGame } from "@/components/SayItOrPayItGame";
import CoupGame from "@/components/CoupGame";
import AIChatbot from "@/components/AIChatbot";
import { Loader2 } from "lucide-react";
import type { Room as LegacyRoom, Player as LegacyPlayer } from "@/types/room";

export const Room = () => {
  const { roomCode } = useParams<{ roomCode: string }>();
  const navigate = useNavigate();
  
  // Redirect if no room code
  if (!roomCode) {
    navigate("/");
    return null;
  }

  const { room, players, currentPlayer, loading, error, updateRoom, reload } = useRoom(roomCode);

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

  if (error || !room || !currentPlayer) {
    return (
      <div className="min-h-screen flex items-center justify-center gradient-bg">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-4 text-destructive">
            {error || "Room not found"}
          </h2>
          <p className="text-muted-foreground mb-4">
            Unable to access this room. Please check the room code or try again.
          </p>
          <button
            onClick={() => navigate("/")}
            className="px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90"
          >
            Go Home
          </button>
        </div>
      </div>
    );
  }

  const gamePhase = room.gameState?.phase || "lobby";
  const currentGame = room.currentGame || "would_you_rather";
  
  return (
    <div className="min-h-screen gradient-bg">
      {gamePhase === "lobby" ? (
        <RoomLobby 
          room={room as any} 
          players={players as any} 
          currentPlayer={currentPlayer as any}
          onUpdateRoom={updateRoom}
        />
      ) : currentGame === "paranoia" ? (
        <ParanoiaGameV2 
          room={room as any} 
          players={players as any} 
          currentPlayer={currentPlayer as any}
          onUpdateRoom={updateRoom}
        />
      ) : (currentGame === "odd_one_out" || currentGame === "odd-one-out") ? (
        <OddOneOutGame 
          room={room as any} 
          players={players as any} 
          currentPlayer={currentPlayer as any}
          onUpdateRoom={updateRoom}
        />
      ) : currentGame === "dogpatch" ? (
        <DogpatchGame 
          room={room as any} 
          players={players as any} 
          currentPlayer={currentPlayer as any}
          onUpdateRoom={updateRoom}
        />
      ) : currentGame === "dramamatching" ? (
        <DramamatchingGame 
          room={room as any} 
          players={players as any} 
          currentPlayer={currentPlayer as any}
          onUpdateRoom={updateRoom}
        />
      ) : currentGame === "forms" ? (
        <NewFormsGame 
          room={room as any} 
          players={players as any} 
          currentPlayer={currentPlayer as any}
          onUpdateRoom={updateRoom}
        />
      ) : currentGame === "say_it_or_pay_it" ? (
        <SayItOrPayItGame 
          room={room as any} 
          players={players as any} 
          currentPlayer={currentPlayer as any}
          onUpdateRoom={updateRoom}
        />
      ) : currentGame === "coup" ? (
        <CoupGame 
          room={room as any} 
          players={players as any} 
          currentPlayer={currentPlayer as any}
          onUpdateRoom={updateRoom}
        />
      ) : (
        <WouldYouRatherGame 
          room={room as any} 
          players={players as any} 
          currentPlayer={currentPlayer as any}
          onUpdateRoom={updateRoom}
        />
      )}
      
    </div>
  );
};

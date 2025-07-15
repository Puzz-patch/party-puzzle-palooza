import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { ChevronRight, Users, RotateCcw, Crown } from "lucide-react";

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

interface Question {
  id: string;
  option_a: string;
  option_b: string;
  category: string;
}

interface WouldYouRatherGameProps {
  room: Room;
  players: Player[];
  currentPlayer: Player;
  onUpdateRoom: (room: Room) => void;
}

export const WouldYouRatherGame = ({ room, players, currentPlayer, onUpdateRoom }: WouldYouRatherGameProps) => {
  const [currentQuestion, setCurrentQuestion] = useState<Question | null>(null);
  const [hasVoted, setHasVoted] = useState(false);
  const [votes, setVotes] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const gameState = room.game_state || {};
  const showResults = gameState.showResults || false;
  const questionIndex = gameState.questionIndex || 0;

  useEffect(() => {
    loadCurrentQuestion();
    loadVotes();
    
    // Check if current player has voted
    const playerVoted = Object.keys(gameState.votes || {}).includes(currentPlayer.player_id);
    setHasVoted(playerVoted);
  }, [room.game_state, currentPlayer.player_id]);

  const loadCurrentQuestion = async () => {
    if (gameState.currentQuestion) {
      setCurrentQuestion(gameState.currentQuestion);
      return;
    }

    // Load a random question if none is set
    if (currentPlayer.is_host) {
      await loadNextQuestion();
    }
  };

  const loadVotes = async () => {
    try {
      const { data: votesData } = await supabase
        .from("game_votes")
        .select("player_id, vote")
        .eq("room_id", room.id)
        .eq("question_id", gameState.currentQuestion?.id || "");

      const votesMap: Record<string, string> = {};
      votesData?.forEach(vote => {
        votesMap[vote.player_id] = vote.vote;
      });
      setVotes(votesMap);
    } catch (error) {
      console.error("Error loading votes:", error);
    }
  };

  const loadNextQuestion = async () => {
    if (!currentPlayer.is_host) return;

    setIsLoading(true);
    try {
      // Get a random question
      const { data: questionsData } = await supabase
        .from("would_you_rather_questions")
        .select("*");

      if (!questionsData || questionsData.length === 0) {
        toast({
          title: "No Questions Available",
          description: "No questions found in the database",
          variant: "destructive",
        });
        return;
      }

      const randomQuestion = questionsData[Math.floor(Math.random() * questionsData.length)];

      // Update room with new question
      const newGameState = {
        ...gameState,
        currentQuestion: randomQuestion,
        questionIndex: questionIndex + 1,
        votes: {},
        showResults: false
      };

      const { error } = await supabase
        .from("rooms")
        .update({ game_state: newGameState })
        .eq("id", room.id);

      if (error) throw error;

      // Clear votes for this question
      await supabase
        .from("game_votes")
        .delete()
        .eq("room_id", room.id);

      setCurrentQuestion(randomQuestion);
      setVotes({});
      setHasVoted(false);
    } catch (error) {
      console.error("Error loading next question:", error);
      toast({
        title: "Error",
        description: "Failed to load next question",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const vote = async (option: "A" | "B") => {
    if (hasVoted || !currentQuestion) return;

    try {
      // Save vote to database
      const { error } = await supabase
        .from("game_votes")
        .insert({
          room_id: room.id,
          player_id: currentPlayer.player_id,
          question_id: currentQuestion.id,
          vote: option
        });

      if (error) throw error;

      // Update local state
      const newVotes = { ...votes, [currentPlayer.player_id]: option };
      setVotes(newVotes);
      setHasVoted(true);

      // Update room game state with vote
      const updatedGameState = {
        ...gameState,
        votes: newVotes
      };

      await supabase
        .from("rooms")
        .update({ game_state: updatedGameState })
        .eq("id", room.id);

      toast({
        title: "Vote Recorded!",
        description: `You chose Option ${option}`,
        className: "bg-success text-success-foreground",
      });

      // Auto-show results if everyone has voted
      if (Object.keys(newVotes).length === players.length && currentPlayer.is_host) {
        setTimeout(() => showResultsHandler(), 1000);
      }
    } catch (error) {
      console.error("Error voting:", error);
      toast({
        title: "Error",
        description: "Failed to record vote",
        variant: "destructive",
      });
    }
  };

  const showResultsHandler = async () => {
    if (!currentPlayer.is_host) return;

    const updatedGameState = {
      ...gameState,
      showResults: true
    };

    await supabase
      .from("rooms")
      .update({ game_state: updatedGameState })
      .eq("id", room.id);
  };

  const backToLobby = async () => {
    if (!currentPlayer.is_host) return;

    const { error } = await supabase
      .from("rooms")
      .update({
        game_state: { phase: "lobby", currentQuestion: null, votes: {} }
      })
      .eq("id", room.id);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to return to lobby",
        variant: "destructive",
      });
    }
  };

  if (!currentQuestion) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-lg text-muted-foreground">Loading question...</p>
        </div>
      </div>
    );
  }

  const optionAVotes = Object.values(votes).filter(vote => vote === "A").length;
  const optionBVotes = Object.values(votes).filter(vote => vote === "B").length;
  const totalVotes = optionAVotes + optionBVotes;
  const optionAPercentage = totalVotes > 0 ? (optionAVotes / totalVotes) * 100 : 0;
  const optionBPercentage = totalVotes > 0 ? (optionBVotes / totalVotes) * 100 : 0;

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-4 mb-4">
            <h1 className="text-3xl font-bold text-foreground">Would You Rather</h1>
            <Badge variant="outline" className="text-sm">
              Question {questionIndex}
            </Badge>
          </div>
          <div className="room-code text-lg">{room.room_code}</div>
        </div>

        {/* Question Card */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="text-2xl text-center">
              Would You Rather...
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-6">
              {/* Option A */}
              <div
                className={`relative p-6 rounded-lg border-2 transition-all duration-300 cursor-pointer ${
                  hasVoted && votes[currentPlayer.player_id] === "A"
                    ? "border-game-option-a bg-game-option-a/10"
                    : hasVoted
                    ? "border-muted bg-muted/50 opacity-60"
                    : "border-game-option-a/30 hover:border-game-option-a hover:bg-game-option-a/5"
                }`}
                onClick={() => !hasVoted && vote("A")}
              >
                <div className="text-center">
                  <div className="text-lg font-semibold mb-2 text-game-option-a">Option A</div>
                  <p className="text-base text-foreground">{currentQuestion.option_a}</p>
                </div>
                
                {showResults && (
                  <div className="mt-4">
                    <div className="flex justify-between text-sm mb-2">
                      <span>{optionAVotes} votes</span>
                      <span>{Math.round(optionAPercentage)}%</span>
                    </div>
                    <Progress value={optionAPercentage} className="h-3" />
                  </div>
                )}
              </div>

              {/* Option B */}
              <div
                className={`relative p-6 rounded-lg border-2 transition-all duration-300 cursor-pointer ${
                  hasVoted && votes[currentPlayer.player_id] === "B"
                    ? "border-game-option-b bg-game-option-b/10"
                    : hasVoted
                    ? "border-muted bg-muted/50 opacity-60"
                    : "border-game-option-b/30 hover:border-game-option-b hover:bg-game-option-b/5"
                }`}
                onClick={() => !hasVoted && vote("B")}
              >
                <div className="text-center">
                  <div className="text-lg font-semibold mb-2 text-game-option-b">Option B</div>
                  <p className="text-base text-foreground">{currentQuestion.option_b}</p>
                </div>
                
                {showResults && (
                  <div className="mt-4">
                    <div className="flex justify-between text-sm mb-2">
                      <span>{optionBVotes} votes</span>
                      <span>{Math.round(optionBPercentage)}%</span>
                    </div>
                    <Progress value={optionBPercentage} className="h-3" />
                  </div>
                )}
              </div>
            </div>

            {/* Voting Status */}
            <div className="mt-6 text-center">
              {!showResults && (
                <div className="flex items-center justify-center gap-4">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    <span className="text-sm text-muted-foreground">
                      {Object.keys(votes).length} of {players.length} voted
                    </span>
                  </div>
                  {hasVoted && (
                    <Badge variant="secondary">
                      You voted for Option {votes[currentPlayer.player_id]}
                    </Badge>
                  )}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Players Voting Status */}
        {!showResults && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="text-lg">Voting Progress</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {players.map((player) => (
                  <div
                    key={player.id}
                    className={`flex items-center gap-2 p-2 rounded-lg ${
                      votes[player.player_id] ? "bg-success/10" : "bg-muted"
                    }`}
                  >
                    <div className="w-6 h-6 bg-primary rounded-full flex items-center justify-center text-primary-foreground text-xs">
                      {player.player_name.charAt(0).toUpperCase()}
                    </div>
                    <span className="text-sm font-medium truncate">{player.player_name}</span>
                    {player.is_host && <Crown className="h-3 w-3 text-warning" />}
                    {votes[player.player_id] && (
                      <div className="ml-auto w-2 h-2 bg-success rounded-full"></div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Host Controls */}
        {currentPlayer.is_host && (
          <div className="flex justify-center gap-4">
            {showResults ? (
              <Button
                onClick={loadNextQuestion}
                disabled={isLoading}
                className="gap-2"
                size="lg"
              >
                {isLoading ? (
                  "Loading..."
                ) : (
                  <>
                    <ChevronRight className="h-4 w-4" />
                    Next Question
                  </>
                )}
              </Button>
            ) : (
              totalVotes > 0 && (
                <Button
                  onClick={showResultsHandler}
                  variant="outline"
                  className="gap-2"
                >
                  Show Results Now
                </Button>
              )
            )}
            
            <Button
              onClick={backToLobby}
              variant="outline"
              className="gap-2"
            >
              <RotateCcw className="h-4 w-4" />
              Back to Lobby
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};
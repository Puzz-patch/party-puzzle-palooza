import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Crown, Users, SkipForward } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { getCatImageUrl } from '@/assets/catImages';

interface Question {
  id: string;
  image: string;
  options: string[];
  correctAnswer: string;
}

interface Player {
  id: string;
  player_id: string;
  player_name: string;
  is_host: boolean;
  room_id: string;
  joined_at: string;
  selected_character_id?: string;
}

interface CatCharacter {
  id: string;
  name: string;
  icon_url: string | null;
}

interface Room {
  id: string;
  room_code: string;
  name: string;
  host_id: string;
  current_game: string;
  game_state: any;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface DogpatchGameProps {
  room: Room;
  players: Player[];
  currentPlayer: Player;
  onUpdateRoom: (updates: Partial<Room>) => Promise<void>;
}

// Hardcoded questions with correct answers matching the PDF
const questionsData: Omit<Question, 'options'>[] = [
  {
    id: "1",
    image: '/1.png',
    correctAnswer: 'Deirbhile Gorman'
  },
  {
    id: "2",
    image: '/2.png',
    correctAnswer: 'Joe Gorman'
  },
  {
    id: "3",
    image: '/3.png',
    correctAnswer: 'Ruairi Forde'
  },
  {
    id: "4",
    image: '/4.png',
    correctAnswer: 'Menno Axt'
  },
  {
    id: "5",
    image: '/5.png',
    correctAnswer: 'Paige Haaroff'
  },
  {
    id: "6",
    image: '/6.png',
    correctAnswer: 'Tim'
  },
  {
    id: "7",
    image: '/7.png',
    correctAnswer: 'Aisling Conlon'
  },
  {
    id: "8",
    image: '/8.png',
    correctAnswer: 'Malaika Judd'
  },
  {
    id: "9",
    image: '/9.png',
    correctAnswer: 'Gleb Sapunenko'
  },
  {
    id: "10",
    image: '/10.png',
    correctAnswer: 'Elizabeth Fingleton'
  },
  {
    id: "11",
    image: '/11.png',
    correctAnswer: 'Raquel Nogueira da Silva'
  },
  {
    id: "12",
    image: '/12.png',
    correctAnswer: 'Ben Beattie'
  },
  {
    id: "13",
    image: '/13.png',
    correctAnswer: 'Mark Farrelly'
  },
  {
    id: "14",
    image: '/14.png',
    correctAnswer: 'Maria Reyes'
  },
  {
    id: "15",
    image: '/15.png',
    correctAnswer: 'Conor Burke'
  },
  {
    id: "16",
    image: '/16.png',
    correctAnswer: 'Andrew McCann'
  }
];

// All possible names for wrong answers
const allNames = [
  'Patrick Walsh', 'Andrew McCann', 'Cristina Bob', 'Ben Beattie', 'Patrick Curran', 
  'Gleb Sapunenko', 'Jill Drennan', 'Jennifer Breathnach', 'Joe Lanzillotta', 
  'Conor Burke', 'Marcos Escobar', 'Lucy Daly', 'Ruairi Forde', 'Maria Reyes',
  'Dave Power', 'Elizabeth Fingleton', 'Tamara Leigh', 'Raquel Nogueira da Silva', 
  'Roisin Murphy', 'Alexander O\'Sullivan', 'Emma Heaton-Esposito', 'Paige Haaroff', 
  'Aisling Conlon', 'Ciaran Kelly', 'Mark Farrelly', 'Niamh Sterling', 'Madison Roche', 
  'Menno Axt', 'Malaika Judd', 'Ian Browne', 'Lorraine Curham', 'Reta Octania', 
  'Joe Gorman', 'Lizzy Hayashida', 'Deirbhile Gorman', 'Tim'
];

// Function to shuffle array
const shuffleArray = <T,>(array: T[]): T[] => {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    if (shuffled[j] !== undefined) {
      [shuffled[i], shuffled[j]] = [shuffled[j]!, shuffled[i]!];
    }
  }
  return shuffled;
};

// Generate questions with randomized options
const generateQuestions = (): Question[] => {
  return questionsData.map(questionData => {
    // Get 3 random wrong answers (excluding the correct answer)
    const wrongAnswers = allNames
      .filter(name => name !== questionData.correctAnswer)
      .sort(() => Math.random() - 0.5)
      .slice(0, 3);
    
    // Combine correct answer with wrong answers and shuffle
    const allOptions = [questionData.correctAnswer, ...wrongAnswers];
    const shuffledOptions = shuffleArray(allOptions);
    
    return {
      ...questionData,
      options: shuffledOptions
    };
  });
};

const questions: Question[] = generateQuestions();

export const DogpatchGame: React.FC<DogpatchGameProps> = ({
  room,
  players,
  currentPlayer,
  onUpdateRoom
}) => {
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [gamePhase, setGamePhase] = useState<'waiting' | 'question' | 'results' | 'finished'>('waiting');
  const [playerAnswers, setPlayerAnswers] = useState<Record<string, string>>({});
  const [scores, setScores] = useState<Record<string, number>>({});
  const [characterData, setCharacterData] = useState<Record<string, CatCharacter>>({});
  const [questionResults, setQuestionResults] = useState<Array<{questionId: string, playerAnswers: Record<string, string>, correctAnswer: string}>>([]);

  // Sync game state from room
  useEffect(() => {
    if (room.game_state) {
      if (room.game_state.gamePhase) {
        setGamePhase(room.game_state.gamePhase);
      }
      if (room.game_state.currentQuestion !== undefined) {
        setCurrentQuestionIndex(room.game_state.currentQuestion);
      }
      if (room.game_state.scores) {
        setScores(room.game_state.scores);
      }
      if (room.game_state.playerAnswers) {
        setPlayerAnswers(room.game_state.playerAnswers);
      }
      if (room.game_state.questionResults) {
        setQuestionResults(room.game_state.questionResults);
      }
    }
  }, [room.game_state]);

  // Reset selected answer when question changes
  useEffect(() => {
    setSelectedAnswer(null);
  }, [currentQuestionIndex]);

  const currentQuestion = questions[currentQuestionIndex];
  const isHost = currentPlayer.is_host;
  const allPlayersAnswered = Object.keys(playerAnswers).length === players.length;
  const showResults = gamePhase === 'results';

  // Load cat characters
  useEffect(() => {
    const loadCharacters = async () => {
      try {
        const { data, error } = await supabase
          .from('cat_characters')
          .select('*');
        
        if (error) {
          console.error('Error loading characters:', error);
          return;
        }

        const charactersMap: Record<string, CatCharacter> = {};
        data?.forEach((char) => {
          if (char.icon_url) { // Only add characters with valid icon URLs
            charactersMap[char.id] = char as CatCharacter;
          }
        });
        setCharacterData(charactersMap);
      } catch (error) {
        console.error('Error loading characters:', error);
      }
    };

    loadCharacters();
  }, []);

  // Check if all players have answered (only host handles this)
  useEffect(() => {
    if (isHost && gamePhase === 'question' && allPlayersAnswered && Object.keys(playerAnswers).length > 0) {
      setTimeout(() => showQuestionResults(), 1000);
    }
  }, [playerAnswers, gamePhase, allPlayersAnswered, isHost]);

  const startGame = async () => {
    const initialState = {
      phase: 'question', // For Room component compatibility
      gamePhase: 'question',
      currentQuestion: 0,
      scores: {},
      playerAnswers: {},
      questionResults: []
    };
    
    await onUpdateRoom({
      game_state: initialState
    });
  };

  const handleAnswerSelect = async (answer: string) => {
    if (selectedAnswer || gamePhase !== 'question') return;
    
    setSelectedAnswer(answer);
    const newAnswers = { ...playerAnswers, [currentPlayer.player_id]: answer };
    
    // Update room state with new answer
    await onUpdateRoom({
      game_state: {
        ...room.game_state,
        playerAnswers: newAnswers
      }
    });
  };

  const showQuestionResults = async () => {
    // Calculate scores
    const newScores = { ...scores };
    Object.entries(playerAnswers).forEach(([playerId, answer]) => {
      if (currentQuestion && answer === currentQuestion.correctAnswer) {
        newScores[playerId] = (newScores[playerId] || 0) + 1;
      }
    });
    
    // Store this question's results
    if (currentQuestion) {
      const newQuestionResults = [...questionResults, {
        questionId: currentQuestion.id,
        playerAnswers: { ...playerAnswers },
        correctAnswer: currentQuestion.correctAnswer
      }];
      await onUpdateRoom({
        game_state: {
          ...room.game_state,
          phase: 'results', // For Room component compatibility
          gamePhase: 'results',
          scores: newScores,
          questionResults: newQuestionResults
        }
      });
      
      setTimeout(() => {
        nextQuestion(newScores, newQuestionResults);
      }, 3000);
    }
  };

  const handleSkipQuestion = () => {
    showQuestionResults();
  };

  const nextQuestion = async (preservedScores?: Record<string, number>, preservedResults?: Array<{questionId: string, playerAnswers: Record<string, string>, correctAnswer: string}>) => {
    if (currentQuestionIndex + 1 >= questions.length) {
      await onUpdateRoom({
        game_state: {
          ...room.game_state,
          phase: 'finished', // For Room component compatibility
          gamePhase: 'finished',
          // Preserve all final data
          scores: preservedScores || scores,
          questionResults: preservedResults || questionResults
        }
      });
      return;
    }
    
    setSelectedAnswer(null);
    
    await onUpdateRoom({
      game_state: {
        ...room.game_state,
        phase: 'question', // For Room component compatibility
        gamePhase: 'question',
        currentQuestion: currentQuestionIndex + 1,
        playerAnswers: {},
        // Reset selectedAnswer for next question
        resetAnswers: true,
        // Keep existing questionResults and scores from parameters or current state
        questionResults: preservedResults || questionResults,
        scores: preservedScores || scores
      }
    });
  };

  const resetGame = async () => {
    setSelectedAnswer(null);
    
    await onUpdateRoom({
      game_state: {
        phase: 'lobby', // For Room component compatibility - goes back to lobby
        gamePhase: 'waiting',
        currentQuestion: 0,
        scores: {},
        playerAnswers: {},
        questionResults: []
      }
    });
  };

  if (gamePhase === 'waiting') {
    return (
      <div className="min-h-screen gradient-bg p-6">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold mb-4 text-primary">Guess Who</h1>
            <h2 className="text-2xl mb-6 text-muted-foreground">Dogpatch Game</h2>
            
            <Card className="mb-6">
              <CardContent className="p-6">
                <div className="flex items-center justify-center gap-4 mb-4">
                  <Users className="h-6 w-6" />
                  <span className="text-lg font-semibold">{players.length} Players</span>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                  {players.map((player) => (
                    <div key={player.id} className="flex items-center gap-2 p-2 bg-muted rounded">
                      {player.is_host && <Crown className="h-4 w-4 text-yellow-500" />}
                      <span className="text-sm">{player.player_name}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {isHost && (
              <Button onClick={startGame} size="lg" className="text-lg px-8 py-4">
                Start Guess Who Game
              </Button>
            )}
            
            {!isHost && (
              <p className="text-muted-foreground">Waiting for host to start the game...</p>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (gamePhase === 'finished') {
    const sortedScores = Object.entries(scores)
      .map(([playerId, score]) => ({
        player: players.find(p => p.player_id === playerId),
        score
      }))
      .sort((a, b) => b.score - a.score);

    return (
      <div className="min-h-screen gradient-bg p-6">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-4xl font-bold mb-4 text-primary">Game Over!</h1>
          <h2 className="text-2xl mb-8 text-muted-foreground">Final Results</h2>
          
          <Card className="mb-6">
            <CardContent className="p-6">
              <h3 className="text-xl font-semibold mb-4">Final Scores</h3>
              <div className="space-y-2">
                {sortedScores.map((item, index) => {
                  const playerCharacter = item.player?.selected_character_id ? characterData[item.player.selected_character_id] : null;
                  return (
                    <div key={item.player?.player_id} className="flex items-center justify-between p-3 bg-muted rounded">
                      <div className="flex items-center gap-3">
                        <span className="font-bold text-lg">{index + 1}.</span>
                        {index === 0 && <Crown className="h-5 w-5 text-yellow-500" />}
                        {playerCharacter && (
                          <img
                            src={getCatImageUrl(playerCharacter.icon_url)}
                            alt={playerCharacter.name}
                            className="w-8 h-8 rounded-full object-cover"
                          />
                        )}
                        <span className="font-medium">{item.player?.player_name}</span>
                      </div>
                      <span className="font-bold text-lg">{item.score}/{questions.length}</span>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          <Card className="mb-6">
            <CardContent className="p-6">
              <h3 className="text-xl font-semibold mb-4">Question Results</h3>
              <div className="space-y-4">
                {questionResults.map((result, qIndex) => (
                  <div key={result.questionId} className="border rounded-lg p-4">
                    <h4 className="font-medium mb-2">Question {qIndex + 1}</h4>
                    <p className="text-sm text-muted-foreground mb-3">Correct Answer: {result.correctAnswer}</p>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      <div>
                        <h5 className="text-sm font-medium text-green-600 mb-1">✓ Correct</h5>
                        {players.filter(p => result.playerAnswers[p.player_id] === result.correctAnswer).map(player => {
                          const playerCharacter = player.selected_character_id ? characterData[player.selected_character_id] : null;
                          return (
                            <div key={player.player_id} className="flex items-center gap-2 text-sm p-1">
                              {playerCharacter && (
                                <img
                                  src={getCatImageUrl(playerCharacter.icon_url)}
                                  alt={playerCharacter.name}
                                  className="w-4 h-4 rounded-full object-cover"
                                />
                              )}
                              <span>{player.player_name}</span>
                            </div>
                          );
                        })}
                      </div>
                      
                      <div>
                        <h5 className="text-sm font-medium text-red-600 mb-1">✗ Incorrect</h5>
                        {players.filter(p => result.playerAnswers[p.player_id] && result.playerAnswers[p.player_id] !== result.correctAnswer).map(player => {
                          const playerCharacter = player.selected_character_id ? characterData[player.selected_character_id] : null;
                          return (
                            <div key={player.player_id} className="flex items-center gap-2 text-sm p-1">
                              {playerCharacter && (
                                <img
                                  src={getCatImageUrl(playerCharacter.icon_url)}
                                  alt={playerCharacter.name}
                                  className="w-4 h-4 rounded-full object-cover"
                                />
                              )}
                              <span>{player.player_name}</span>
                              <span className="text-muted-foreground">({result.playerAnswers[player.player_id]})</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {isHost && (
            <Button onClick={resetGame} size="lg">
              Play Again
            </Button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen gradient-bg p-6">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold mb-4 text-primary">Guess Who</h1>
          
          <div className="flex items-center justify-center gap-6 mb-6">
            <div className="text-lg">
              Question {currentQuestionIndex + 1} of {questions.length}
            </div>
            <div className="text-sm text-muted-foreground">
              {Object.keys(playerAnswers).length}/{players.length} players answered
            </div>
          </div>
          
          {isHost && gamePhase === 'question' && (
            <div className="mb-4">
              <Button 
                onClick={handleSkipQuestion} 
                variant="outline" 
                size="sm"
                className="mb-2"
              >
                <SkipForward className="h-4 w-4 mr-2" />
                Skip Question (Host)
              </Button>
            </div>
          )}
        </div>

        <Card className="mb-6">
          <CardContent className="p-6 text-center">
            {currentQuestion && (
              <>
                <img 
                  src={currentQuestion.image} 
                  alt="Guess who this is" 
                  className="w-80 h-80 object-contain rounded-lg mx-auto mb-6 bg-white/10"
                />
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl mx-auto">
                  {currentQuestion.options.map((option: string, index: number) => (
                    <Button
                      key={index}
                      variant={
                        gamePhase === 'results' && option === currentQuestion.correctAnswer
                          ? "default"
                          : gamePhase === 'results' && selectedAnswer === option && option !== currentQuestion.correctAnswer
                          ? "destructive"
                          : selectedAnswer === option
                          ? "default"
                          : "outline"
                      }
                      size="lg"
                      onClick={() => handleAnswerSelect(option)}
                      disabled={selectedAnswer !== null || gamePhase === 'results'}
                      className="p-4 text-left h-auto"
                    >
                      {option}
                    </Button>
                  ))}
                </div>

                {showResults && (
                  <div className="mt-6 p-4 bg-muted rounded-lg">
                    <p className="text-lg font-semibold">
                      Correct Answer: {currentQuestion.correctAnswer}
                    </p>
                    <p className="text-sm text-muted-foreground mt-2">
                      Next question in 3 seconds...
                    </p>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <h3 className="font-semibold mb-2">Current Scores</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {players.map((player) => {
                const playerCharacter = player.selected_character_id ? characterData[player.selected_character_id] : null;
                return (
                  <div key={player.id} className="flex items-center justify-between p-2 bg-muted rounded text-sm">
                    <div className="flex items-center gap-2">
                      {playerCharacter && (
                        <img
                          src={getCatImageUrl(playerCharacter.icon_url)}
                          alt={playerCharacter.name}
                          className="w-6 h-6 rounded-full object-cover"
                        />
                      )}
                      <span>{player.player_name}</span>
                    </div>
                    <span className="font-semibold">{scores[player.player_id] || 0}</span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
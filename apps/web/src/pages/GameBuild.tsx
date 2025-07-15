import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Progress } from '../components/ui/progress';
import { 
  Lock, 
  Unlock, 
  Rocket, 
  Users, 
  Clock, 
  CheckCircle,
  Plus,
  AlertCircle,
  RefreshCw,
  CheckCircle2
} from 'lucide-react';
import { QuestionCard } from '../components/QuestionCard';
import { CustomQuestionForm } from '../components/CustomQuestionForm';
import { useManifestPolling } from '../hooks/useManifestPolling';
import { 
  useGameStore, 
  useGame, 
  useSelectedQuestions, 
  useCustomQuestions, 
  useIsLocked,
  useGamePlayers,
  useGameQuestions,
  GameQuestion
} from '../stores/game-store';

// Mock data for demonstration
const mockQuestions: GameQuestion[] = [
  {
    id: '1',
    question: 'Would you rather have the ability to fly or be invisible?',
    type: 'would_you_rather',
    category: 'fun',
    roundNumber: 1,
    options: ['Fly', 'Be invisible'],
  },
  {
    id: '2',
    question: 'What is the capital of Australia?',
    type: 'trivia',
    category: 'geography',
    roundNumber: 2,
    options: ['Sydney', 'Melbourne', 'Canberra', 'Brisbane'],
    correctAnswer: 'Canberra',
  },
  {
    id: '3',
    question: 'What word comes to mind when you think of "ocean"?',
    type: 'word_association',
    category: 'nature',
    roundNumber: 3,
  },
  {
    id: '4',
    question: 'Draw something that represents "happiness"',
    type: 'drawing',
    category: 'emotions',
    roundNumber: 4,
  },
  {
    id: '5',
    question: 'Would you rather travel to the past or the future?',
    type: 'would_you_rather',
    category: 'adventure',
    roundNumber: 5,
    options: ['Past', 'Future'],
  },
  {
    id: '6',
    question: 'Which planet is known as the Red Planet?',
    type: 'trivia',
    category: 'science',
    roundNumber: 6,
    options: ['Venus', 'Mars', 'Jupiter', 'Saturn'],
    correctAnswer: 'Mars',
  },
];

export const GameBuild: React.FC = () => {
  const { gid } = useParams<{ gid: string }>();
  const navigate = useNavigate();
  
  // Zustand store hooks
  const game = useGame();
  const selectedQuestions = useSelectedQuestions();
  const customQuestions = useCustomQuestions();
  const isLocked = useIsLocked();
  const players = useGamePlayers();
  const questions = useGameQuestions();
  
  // Local state
  const [showCustomForm, setShowCustomForm] = useState(false);
  const [filterType, setFilterType] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Store actions
  const {
    setGame,
    selectQuestion,
    deselectQuestion,
    addCustomQuestion,
    removeCustomQuestion,
    lockQuestions,
    unlockQuestions,
    loadQuestions,
  } = useGameStore();

  // Manifest polling
  const { isPolling, diff, error: pollingError, startRound } = useManifestPolling(gid || '');

  // Initialize mock game data
  useEffect(() => {
    if (!game && gid) {
      setGame({
        id: gid,
        name: 'Demo Game',
        code: 'DEMO123',
        status: 'playing',
        type: 'would_you_rather',
        maxPlayers: 8,
        currentPlayers: 4,
        roundsPerGame: 5,
        timePerRound: 30,
        players: [
          { id: '1', username: 'player1', firstName: 'John', lastName: 'Doe', score: 0, correctAnswers: 0, totalAnswers: 0, isHost: true, isSpectator: false, joinedAt: new Date() },
          { id: '2', username: 'player2', firstName: 'Jane', lastName: 'Smith', score: 0, correctAnswers: 0, totalAnswers: 0, isHost: false, isSpectator: false, joinedAt: new Date() },
        ],
        queuedQuestions: mockQuestions,
        flags: {
          isPrivate: false,
          hasPassword: false,
          isStarted: true,
          isFinished: false,
          isFull: false,
        },
        createdAt: new Date(),
        currentState: 'question_build',
      });
    }
  }, [gid, game, setGame]);

  // Filter questions based on type and search
  const filteredQuestions = (questions.length > 0 ? questions : mockQuestions).filter(q => {
    const matchesType = filterType === 'all' || q.type === filterType;
    const matchesSearch = q.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         q.category.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesType && matchesSearch;
  });

  const handleSelectQuestion = (questionId: string) => {
    if (isLocked) return;
    selectQuestion(questionId);
  };

  const handleDeselectQuestion = (questionId: string) => {
    if (isLocked) return;
    deselectQuestion(questionId);
  };

  const handleCreateCustomQuestion = (questionData: Omit<GameQuestion, 'id' | 'roundNumber' | 'status'>) => {
    const newQuestion: GameQuestion = {
      ...questionData,
      id: `custom-${Date.now()}`,
      roundNumber: questions.length + 1,
      status: 'pending',
    };
    addCustomQuestion(newQuestion);
    setShowCustomForm(false);
  };

  const handleLockQuestions = () => {
    if (selectedQuestions.length + customQuestions.length >= game?.roundsPerGame) {
      lockQuestions();
    }
  };

  const handleLoadQuestions = () => {
    loadQuestions();
    // Navigate to game play
    navigate(`/game/${gid}/play`);
  };

  const progressPercentage = ((selectedQuestions.length + customQuestions.length) / (game?.roundsPerGame || 5)) * 100;

  if (!game) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p>Loading game...</p>
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
              <p className="text-sm text-gray-600">Code: {game.code}</p>
            </div>
            
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Users className="h-4 w-4" />
                <span>{game.currentPlayers}/{game.maxPlayers} players</span>
              </div>
              
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Clock className="h-4 w-4" />
                <span>{game.timePerRound}s per round</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Progress Section */}
        <Card className="mb-8">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-semibold">Question Selection Progress</h2>
                <p className="text-sm text-gray-600">
                  <span data-testid="selected-count">{selectedQuestions.length + customQuestions.length}</span> of {game.roundsPerGame} questions selected
                </p>
              </div>
              
              <div className="flex items-center gap-2">
                {/* Polling Status */}
                <div className="flex items-center gap-2" data-testid="polling-status">
                  {isPolling ? (
                    <div className="flex items-center gap-1 text-sm text-blue-600">
                      <RefreshCw className="h-3 w-3 animate-spin" />
                      <span>Live</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1 text-sm text-gray-500">
                      <RefreshCw className="h-3 w-3" />
                      <span>Offline</span>
                    </div>
                  )}
                </div>

                {/* All Players Ready Status */}
                {diff.allPlayersHaveQuestions && (
                  <Badge className="flex items-center gap-1 bg-green-100 text-green-800 border-green-200" data-testid="all-ready-badge">
                    <CheckCircle2 className="h-3 w-3" />
                    All Ready
                  </Badge>
                )}

                {isLocked ? (
                  <Badge className="flex items-center gap-1">
                    <Lock className="h-3 w-3" />
                    Locked
                  </Badge>
                ) : (
                  <Badge className="flex items-center gap-1">
                    <Unlock className="h-3 w-3" />
                    Unlocked
                  </Badge>
                )}
              </div>
            </div>
            
            <Progress value={progressPercentage} className="mb-4" />
            
            <div className="flex items-center justify-between">
              <div className="flex gap-4 text-sm text-gray-600">
                <span>Selected: {selectedQuestions.length}</span>
                <span>Custom: {customQuestions.length}</span>
                {diff.newQuestions && diff.newQuestions > 0 && (
                  <span className="text-green-600">+{diff.newQuestions} new</span>
                )}
              </div>
              
              <div className="flex gap-2">
                {!isLocked ? (
                  <Button
                    onClick={handleLockQuestions}
                    disabled={selectedQuestions.length + customQuestions.length < game.roundsPerGame}
                    className="flex items-center gap-2"
                  >
                    <Lock className="h-4 w-4" />
                    Lock & Load
                  </Button>
                ) : (
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      onClick={unlockQuestions}
                      className="flex items-center gap-2"
                    >
                      <Unlock className="h-4 w-4" />
                      Unlock
                    </Button>
                    <Button
                      onClick={handleLoadQuestions}
                      className="flex items-center gap-2"
                    >
                      <Rocket className="h-4 w-4" />
                      Start Game
                    </Button>
                  </div>
                )}
              </div>
            </div>

            {/* Polling Error Display */}
            {pollingError && (
              <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md" data-testid="polling-error">
                <div className="flex items-center gap-2 text-red-800">
                  <AlertCircle className="h-4 w-4" />
                  <span className="text-sm font-medium">Connection Error</span>
                </div>
                <p className="text-sm text-red-600 mt-1">{pollingError}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Main Content */}
        <Tabs defaultValue="suggestions" className="space-y-6">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="suggestions" data-testid="suggestions-tab">💡 Suggestions</TabsTrigger>
            <TabsTrigger value="write" data-testid="write-tab">✍️ Write Custom</TabsTrigger>
          </TabsList>

          <TabsContent value="suggestions" className="space-y-6">
            {/* Filters */}
            <div className="flex flex-wrap gap-4 items-center">
              <div className="flex gap-2">
                <Button
                  variant={filterType === 'all' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setFilterType('all')}
                >
                  All
                </Button>
                <Button
                  variant={filterType === 'would_you_rather' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setFilterType('would_you_rather')}
                >
                  🤔 Would You Rather
                </Button>
                <Button
                  variant={filterType === 'trivia' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setFilterType('trivia')}
                >
                  🧠 Trivia
                </Button>
                <Button
                  variant={filterType === 'word_association' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setFilterType('word_association')}
                >
                  💭 Word Association
                </Button>
                <Button
                  variant={filterType === 'drawing' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setFilterType('drawing')}
                >
                  🎨 Drawing
                </Button>
              </div>
              
              <input
                type="text"
                placeholder="Search questions..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="px-3 py-2 border rounded-md text-sm"
              />
            </div>

            {/* Questions Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredQuestions.map((question) => (
                <QuestionCard
                  key={question.id}
                  question={question}
                  isSelected={selectedQuestions.includes(question.id)}
                  onSelect={() => handleSelectQuestion(question.id)}
                  onDeselect={() => handleDeselectQuestion(question.id)}
                  disabled={isLocked}
                />
              ))}
            </div>

            {filteredQuestions.length === 0 && (
              <div className="text-center py-12">
                <AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600">No questions found matching your criteria.</p>
              </div>
            )}
          </TabsContent>

          <TabsContent value="write" className="space-y-6">
            {showCustomForm ? (
              <CustomQuestionForm
                onSubmit={handleCreateCustomQuestion}
                onCancel={() => setShowCustomForm(false)}
              />
            ) : (
              <div className="text-center py-12">
                <div className="max-w-md mx-auto">
                  <div className="bg-blue-100 rounded-full p-4 w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                    <Plus className="h-8 w-8 text-blue-600" />
                  </div>
                  <h3 className="text-lg font-semibold mb-2">Create Your Own Question</h3>
                  <p className="text-gray-600 mb-6">
                    Write a custom question to add to the game. Be creative and make it fun!
                  </p>
                  <Button
                    onClick={() => setShowCustomForm(true)}
                    className="flex items-center gap-2"
                  >
                    <Plus className="h-4 w-4" />
                    Write Custom Question
                  </Button>
                </div>
              </div>
            )}

            {/* Custom Questions List */}
            {customQuestions.length > 0 && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Your Custom Questions</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {customQuestions.map((question) => (
                    <QuestionCard
                      key={question.id}
                      question={question}
                      isCustom={true}
                      isSelected={selectedQuestions.includes(question.id)}
                      onSelect={() => handleSelectQuestion(question.id)}
                      onDeselect={() => handleDeselectQuestion(question.id)}
                      onDelete={() => removeCustomQuestion(question.id)}
                      disabled={isLocked}
                      data-testid="custom-question"
                    />
                  ))}
                </div>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}; 
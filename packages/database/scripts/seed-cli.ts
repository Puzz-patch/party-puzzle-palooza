#!/usr/bin/env ts-node

import { Command } from 'commander';
import { AppDataSource } from '../src/config/data-source';
import { User, UserRole, UserStatus } from '../src/entities/user.entity';
import { Game, GameStatus, GameType } from '../src/entities/game.entity';
import { GamePlayer, PlayerStatus } from '../src/entities/game-player.entity';
import { GameRound, RoundStatus, RoundType } from '../src/entities/game-round.entity';
import { PlayerAnswer, AnswerStatus } from '../src/entities/player-answer.entity';
import { hash } from 'bcrypt';

interface DemoUser {
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  avatarUrl?: string;
  role: UserRole;
}

interface DemoQuestion {
  question: string;
  options: string[];
  correctAnswer?: string;
  type: RoundType;
}

class DatabaseSeeder {
  private userRepository = AppDataSource.getRepository(User);
  private gameRepository = AppDataSource.getRepository(Game);
  private gamePlayerRepository = AppDataSource.getRepository(GamePlayer);
  private gameRoundRepository = AppDataSource.getRepository(GameRound);
  private playerAnswerRepository = AppDataSource.getRepository(PlayerAnswer);

  async seed(options: { clear?: boolean; users?: number; questions?: number }) {
    try {
      console.log('🌱 Starting database seeding...');

      // Initialize database connection
      await AppDataSource.initialize();
      console.log('✅ Database connection established');

      // Clear existing data if requested
      if (options.clear) {
        await this.clearExistingData();
      }

      // Seed users
      const userCount = options.users || 4;
      const users = await this.seedUsers(userCount);
      console.log(`✅ Created ${users.length} users`);

      // Seed demo game
      const game = await this.seedDemoGame(users[0]); // First user as creator
      console.log('✅ Created demo game');

      // Add players to game
      await this.seedGamePlayers(game, users);
      console.log('✅ Added players to game');

      // Seed questions
      const questionCount = options.questions || 10;
      await this.seedQuestions(game, users[0], questionCount);
      console.log(`✅ Created ${questionCount} demo questions`);

      console.log('🎉 Database seeding completed successfully!');
      console.log('\n📋 Demo Data Summary:');
      console.log(`- Users: ${users.length} (${users.map(u => u.username).join(', ')})`);
      console.log(`- Game: ${game.name} (Code: ${game.code})`);
      console.log(`- Questions: ${questionCount} AI-authored questions`);
      console.log('\n🔗 Test the API:');
      console.log('curl http://localhost:3001/health');
      console.log('curl http://localhost:3001/api/games');

    } catch (error) {
      console.error('❌ Seeding failed:', error);
      process.exit(1);
    } finally {
      await AppDataSource.destroy();
    }
  }

  private async clearExistingData() {
    console.log('🧹 Clearing existing data...');
    
    // Delete in reverse order of dependencies
    await this.playerAnswerRepository.delete({});
    await this.gameRoundRepository.delete({});
    await this.gamePlayerRepository.delete({});
    await this.gameRepository.delete({});
    await this.userRepository.delete({});
    
    console.log('✅ Existing data cleared');
  }

  private async seedUsers(count: number): Promise<User[]> {
    const demoUsers: DemoUser[] = [
      {
        username: 'alice_gamer',
        email: 'alice@example.com',
        firstName: 'Alice',
        lastName: 'Johnson',
        avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=alice',
        role: UserRole.USER
      },
      {
        username: 'bob_quizmaster',
        email: 'bob@example.com',
        firstName: 'Bob',
        lastName: 'Smith',
        avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=bob',
        role: UserRole.USER
      },
      {
        username: 'charlie_puzzle',
        email: 'charlie@example.com',
        firstName: 'Charlie',
        lastName: 'Brown',
        avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=charlie',
        role: UserRole.USER
      },
      {
        username: 'diana_admin',
        email: 'diana@example.com',
        firstName: 'Diana',
        lastName: 'Wilson',
        avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=diana',
        role: UserRole.ADMIN
      },
      {
        username: 'emma_creative',
        email: 'emma@example.com',
        firstName: 'Emma',
        lastName: 'Davis',
        avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=emma',
        role: UserRole.USER
      },
      {
        username: 'frank_thinker',
        email: 'frank@example.com',
        firstName: 'Frank',
        lastName: 'Miller',
        avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=frank',
        role: UserRole.USER
      }
    ];

    const users: User[] = [];
    const usersToCreate = demoUsers.slice(0, count);
    
    for (const demoUser of usersToCreate) {
      const hashedPassword = await hash('password123', 10);
      
      const user = this.userRepository.create({
        ...demoUser,
        passwordHash: hashedPassword,
        status: UserStatus.ACTIVE,
        emailVerifiedAt: new Date(),
        lastLoginAt: new Date(),
        preferences: {
          theme: 'dark',
          notifications: true,
          soundEnabled: true
        }
      });

      const savedUser = await this.userRepository.save(user);
      users.push(savedUser);
    }

    return users;
  }

  private async seedDemoGame(creator: User): Promise<Game> {
    const game = this.gameRepository.create({
      name: 'Friday Night Trivia',
      code: 'DEMO123',
      description: 'A fun evening of trivia and brain teasers with friends!',
      status: GameStatus.WAITING,
      type: GameType.TRIVIA,
      maxPlayers: 8,
      currentPlayers: 4,
      roundsPerGame: 10,
      timePerRound: 30,
      isPrivate: false,
      createdById: creator.id,
      settings: {
        allowSpectators: true,
        showLeaderboard: true,
        randomizeQuestions: true,
        difficulty: 'medium'
      },
      metadata: {
        createdBy: 'seeder',
        version: '1.0.0'
      }
    });

    return await this.gameRepository.save(game);
  }

  private async seedGamePlayers(game: Game, users: User[]): Promise<void> {
    const gamePlayers = users.map((user, index) => {
      return this.gamePlayerRepository.create({
        gameId: game.id,
        userId: user.id,
        status: index === 0 ? PlayerStatus.READY : PlayerStatus.JOINED,
        score: Math.floor(Math.random() * 100),
        correctAnswers: Math.floor(Math.random() * 5),
        totalAnswers: Math.floor(Math.random() * 8) + 2,
        joinedAt: new Date(),
        isHost: index === 0, // First user is host
        isSpectator: false,
        gameStats: {
          averageResponseTime: Math.floor(Math.random() * 20) + 10,
          favoriteCategory: ['trivia', 'would_you_rather', 'word_association'][Math.floor(Math.random() * 3)]
        }
      });
    });

    await this.gamePlayerRepository.save(gamePlayers);
  }

  private async seedQuestions(game: Game, creator: User, count: number): Promise<void> {
    const allQuestions: DemoQuestion[] = [
      // Would You Rather Questions
      {
        question: "Would you rather have the ability to fly or be invisible?",
        options: ["Fly", "Be invisible"],
        type: RoundType.WOULD_YOU_RATHER
      },
      {
        question: "Would you rather travel to the past or the future?",
        options: ["Past", "Future"],
        type: RoundType.WOULD_YOU_RATHER
      },
      {
        question: "Would you rather be a famous actor or a successful entrepreneur?",
        options: ["Famous actor", "Successful entrepreneur"],
        type: RoundType.WOULD_YOU_RATHER
      },
      {
        question: "Would you rather live in a big city or a small town?",
        options: ["Big city", "Small town"],
        type: RoundType.WOULD_YOU_RATHER
      },
      {
        question: "Would you rather have unlimited money or unlimited time?",
        options: ["Unlimited money", "Unlimited time"],
        type: RoundType.WOULD_YOU_RATHER
      },
      
      // Trivia Questions
      {
        question: "What is the capital of Australia?",
        options: ["Sydney", "Melbourne", "Canberra", "Brisbane"],
        correctAnswer: "Canberra",
        type: RoundType.TRIVIA
      },
      {
        question: "Which planet is known as the Red Planet?",
        options: ["Venus", "Mars", "Jupiter", "Saturn"],
        correctAnswer: "Mars",
        type: RoundType.TRIVIA
      },
      {
        question: "What year did World War II end?",
        options: ["1943", "1944", "1945", "1946"],
        correctAnswer: "1945",
        type: RoundType.TRIVIA
      },
      {
        question: "Who painted the Mona Lisa?",
        options: ["Van Gogh", "Da Vinci", "Picasso", "Rembrandt"],
        correctAnswer: "Da Vinci",
        type: RoundType.TRIVIA
      },
      {
        question: "What is the largest ocean on Earth?",
        options: ["Atlantic", "Indian", "Arctic", "Pacific"],
        correctAnswer: "Pacific",
        type: RoundType.TRIVIA
      },
      
      // Word Association Questions
      {
        question: "What word comes to mind when you think of 'ocean'?",
        options: ["Blue", "Waves", "Fish", "Sand", "Freedom"],
        type: RoundType.WORD_ASSOCIATION
      },
      {
        question: "Complete the phrase: 'Time is...'",
        options: ["Money", "Precious", "Flying", "Running out", "Relative"],
        type: RoundType.WORD_ASSOCIATION
      },
      {
        question: "What do you associate with 'home'?",
        options: ["Comfort", "Family", "Safety", "Warmth", "Love"],
        type: RoundType.WORD_ASSOCIATION
      },
      {
        question: "What comes to mind when you hear 'success'?",
        options: ["Achievement", "Money", "Happiness", "Goals", "Recognition"],
        type: RoundType.WORD_ASSOCIATION
      },
      
      // Drawing Prompts (converted to word association for demo)
      {
        question: "Draw something that represents 'happiness'",
        options: ["Sun", "Smile", "Heart", "Rainbow", "Flowers"],
        type: RoundType.DRAWING
      },
      {
        question: "Sketch your ideal vacation destination",
        options: ["Beach", "Mountains", "City", "Forest", "Island"],
        type: RoundType.DRAWING
      },
      {
        question: "Draw your favorite animal",
        options: ["Dog", "Cat", "Elephant", "Lion", "Dolphin"],
        type: RoundType.DRAWING
      },
      {
        question: "Sketch a futuristic city",
        options: ["Flying cars", "Glass buildings", "Green spaces", "Technology", "Clean energy"],
        type: RoundType.DRAWING
      }
    ];

    const questionsToUse = allQuestions.slice(0, count);
    const gameRounds = questionsToUse.map((question, index) => {
      return this.gameRoundRepository.create({
        gameId: game.id,
        roundNumber: index + 1,
        type: question.type,
        status: RoundStatus.PENDING,
        question: question.question,
        options: question.options,
        correctAnswer: question.correctAnswer || null,
        timeLimit: 30,
        createdById: creator.id,
        roundData: {
          category: question.type,
          difficulty: 'medium',
          aiGenerated: true
        }
      });
    });

    await this.gameRoundRepository.save(gameRounds);
  }
}

// CLI Setup
const program = new Command();

program
  .name('db-seed')
  .description('Seed the database with demo data for Party Puzzle Palooza')
  .version('1.0.0');

program
  .command('seed')
  .description('Seed the database with demo data')
  .option('-c, --clear', 'Clear existing data before seeding')
  .option('-u, --users <number>', 'Number of users to create (default: 4)', '4')
  .option('-q, --questions <number>', 'Number of questions to create (default: 10)', '10')
  .action(async (options) => {
    const seeder = new DatabaseSeeder();
    await seeder.seed({
      clear: options.clear,
      users: parseInt(options.users),
      questions: parseInt(options.questions)
    });
  });

program
  .command('clear')
  .description('Clear all data from the database')
  .action(async () => {
    try {
      await AppDataSource.initialize();
      console.log('🧹 Clearing all data...');
      
      const playerAnswerRepository = AppDataSource.getRepository(PlayerAnswer);
      const gameRoundRepository = AppDataSource.getRepository(GameRound);
      const gamePlayerRepository = AppDataSource.getRepository(GamePlayer);
      const gameRepository = AppDataSource.getRepository(Game);
      const userRepository = AppDataSource.getRepository(User);
      
      await playerAnswerRepository.delete({});
      await gameRoundRepository.delete({});
      await gamePlayerRepository.delete({});
      await gameRepository.delete({});
      await userRepository.delete({});
      
      console.log('✅ All data cleared');
    } catch (error) {
      console.error('❌ Failed to clear data:', error);
      process.exit(1);
    } finally {
      await AppDataSource.destroy();
    }
  });

program.parse(); 
#!/usr/bin/env ts-node

import { AppDataSource } from '../config/data-source';
import { User, UserRole, UserStatus } from '../entities/user.entity';
import { Game, GameStatus, GameType } from '../entities/game.entity';
import { GamePlayer, PlayerStatus } from '../entities/game-player.entity';
import { GameRound, RoundStatus, RoundType } from '../entities/game-round.entity';
import { PlayerAnswer, AnswerStatus } from '../entities/player-answer.entity';
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

  async seed() {
    try {
      console.log('🌱 Starting database seeding...');

      // Initialize database connection
      await AppDataSource.initialize();
      console.log('✅ Database connection established');

      // Clear existing data (optional - comment out if you want to preserve data)
      await this.clearExistingData();

      // Seed users
      const users = await this.seedUsers();
      console.log(`✅ Created ${users.length} users`);

      // Seed demo game
      const game = await this.seedDemoGame(users[0]); // First user as creator
      console.log('✅ Created demo game');

      // Add players to game
      await this.seedGamePlayers(game, users);
      console.log('✅ Added players to game');

      // Seed questions
      await this.seedQuestions(game, users[0]);
      console.log('✅ Created demo questions');

      console.log('🎉 Database seeding completed successfully!');
      console.log('\n📋 Demo Data Summary:');
      console.log(`- Users: ${users.length} (${users.map(u => u.username).join(', ')})`);
      console.log(`- Game: ${game.name} (Code: ${game.code})`);
      console.log(`- Questions: 10 AI-authored questions`);
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

  private async seedUsers(): Promise<User[]> {
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
      }
    ];

    const users: User[] = [];
    
    for (const demoUser of demoUsers) {
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

  private async seedQuestions(game: Game, creator: User): Promise<void> {
    const questions: DemoQuestion[] = [
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
      }
    ];

    const gameRounds = questions.map((question, index) => {
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

// Run the seeder
const seeder = new DatabaseSeeder();
seeder.seed(); 
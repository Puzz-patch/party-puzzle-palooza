import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GameQueryService, GameManifest } from './game-query.service';
import { Game, GameRound } from '@party-puzzle-palooza/database';

describe('GameQueryService', () => {
  let service: GameQueryService;
  let gameRepository: Repository<Game>;
  let gameRoundRepository: Repository<GameRound>;

  const mockGame = {
    id: 'game-1',
    name: 'Test Game',
    code: 'TEST123',
    description: 'A test game',
    status: 'waiting',
    type: 'standard',
    maxPlayers: 10,
    currentPlayers: 3,
    roundsPerGame: 5,
    timePerRound: 60,
    chillMode: false,
    createdAt: new Date(),
    startedAt: null,
    finishedAt: null,
    gamePlayers: [
      {
        user: {
          id: 'user-1',
          username: 'player1',
          firstName: 'John',
          lastName: 'Doe',
          avatarUrl: null
        },
        score: 100,
        correctAnswers: 5,
        totalAnswers: 10,
        isHost: true,
        isSpectator: false,
        joinedAt: new Date(),
        createdAt: new Date()
      }
    ],
    gameRounds: [
      {
        id: 'round-1',
        question: 'What is 2+2?',
        type: 'multiple_choice',
        options: ['3', '4', '5', '6'],
        correctAnswer: '4',
        category: 'math',
        roundNumber: 1,
        flagCount: 0,
        flagged: false
      }
    ]
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GameQueryService,
        {
          provide: getRepositoryToken(Game),
          useValue: {
            findOne: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(GameRound),
          useValue: {
            findOne: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<GameQueryService>(GameQueryService);
    gameRepository = module.get<Repository<Game>>(getRepositoryToken(Game));
    gameRoundRepository = module.get<Repository<GameRound>>(getRepositoryToken(GameRound));
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getGameById', () => {
    it('should return a game when found', async () => {
      jest.spyOn(gameRepository, 'findOne').mockResolvedValue(mockGame as any);

      const result = await service.getGameById('game-1');

      expect(result).toEqual(mockGame);
      expect(gameRepository.findOne).toHaveBeenCalledWith({
        where: { id: 'game-1' },
        relations: ['gamePlayers', 'gamePlayers.user', 'gameRounds']
      });
    });

    it('should throw NotFoundException when game not found', async () => {
      jest.spyOn(gameRepository, 'findOne').mockResolvedValue(null);

      await expect(service.getGameById('nonexistent')).rejects.toThrow('Game not found');
    });
  });

  describe('getGameManifest', () => {
    it('should return game manifest with transformed data', async () => {
      jest.spyOn(gameRepository, 'findOne').mockResolvedValue(mockGame as any);

      const result = await service.getGameManifest('game-1');

      expect(result).toEqual({
        id: 'game-1',
        name: 'Test Game',
        code: 'TEST123',
        description: 'A test game',
        status: 'waiting',
        type: 'standard',
        maxPlayers: 10,
        currentPlayers: 3,
        roundsPerGame: 5,
        timePerRound: 60,
        players: [
          {
            id: 'user-1',
            username: 'player1',
            firstName: 'John',
            lastName: 'Doe',
            avatarUrl: null,
            score: 100,
            correctAnswers: 5,
            totalAnswers: 10,
            isHost: true,
            isSpectator: false,
            joinedAt: expect.any(Date)
          }
        ],
        queuedQuestions: [
          {
            id: 'round-1',
            question: 'What is 2+2?',
            type: 'multiple_choice',
            options: ['3', '4', '5', '6'],
            correctAnswer: '4',
            category: 'math',
            roundNumber: 1,
            flagCount: 0,
            isFlagged: false,
            isHidden: false
          }
        ],
        flags: {
          isPrivate: false,
          hasPassword: false,
          isStarted: false,
          isFinished: false,
          isFull: false,
          chillMode: false
        },
        createdAt: expect.any(Date),
        startedAt: null,
        finishedAt: null
      });
    });

    it('should filter questions in chill mode', async () => {
      const chillModeGame = {
        ...mockGame,
        chillMode: true,
        gameRounds: [
          {
            id: 'round-1',
            question: 'What is 2+2?',
            type: 'multiple_choice',
            options: ['3', '4', '5', '6'],
            correctAnswer: '4',
            category: 'math',
            roundNumber: 1,
            flagCount: 0,
            flagged: false
          },
          {
            id: 'round-2',
            question: 'What is 3+3?',
            type: 'multiple_choice',
            options: ['5', '6', '7', '8'],
            correctAnswer: '6',
            category: 'math',
            roundNumber: 2,
            flagCount: 2,
            flagged: true
          }
        ]
      };

      jest.spyOn(gameRepository, 'findOne').mockResolvedValue(chillModeGame as any);

      const result = await service.getGameManifest('game-1');

      expect(result.queuedQuestions).toHaveLength(1);
      expect(result.queuedQuestions[0].id).toBe('round-1');
      expect(result.flags.chillMode).toBe(true);
    });
  });

  describe('getGameWithRounds', () => {
    it('should return game with rounds relation', async () => {
      jest.spyOn(gameRepository, 'findOne').mockResolvedValue(mockGame as any);

      const result = await service.getGameWithRounds('game-1');

      expect(result).toEqual(mockGame);
      expect(gameRepository.findOne).toHaveBeenCalledWith({
        where: { id: 'game-1' },
        relations: ['gameRounds']
      });
    });
  });

  describe('getGameWithAllRelations', () => {
    it('should return game with all relations', async () => {
      jest.spyOn(gameRepository, 'findOne').mockResolvedValue(mockGame as any);

      const result = await service.getGameWithAllRelations('game-1');

      expect(result).toEqual(mockGame);
      expect(gameRepository.findOne).toHaveBeenCalledWith({
        where: { id: 'game-1' },
        relations: ['gamePlayers', 'gamePlayers.user', 'gameRounds']
      });
    });
  });
}); 
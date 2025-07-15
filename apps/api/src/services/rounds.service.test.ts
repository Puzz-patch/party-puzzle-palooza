import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RoundsService } from './rounds.service';
import { GameRound, RoundStatus } from '@party-puzzle-palooza/database';
import { Game, GamePlayer } from '@party-puzzle-palooza/database';
import { RedisService } from '../redis/redis.service';
import { NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';

describe('RoundsService', () => {
  let service: RoundsService;
  let gameRoundRepository: jest.Mocked<Repository<GameRound>>;
  let gameRepository: jest.Mocked<Repository<Game>>;
  let gamePlayerRepository: jest.Mocked<Repository<GamePlayer>>;
  let redisService: jest.Mocked<RedisService>;

  const mockGameRoundRepository = {
    findOne: jest.fn(),
    update: jest.fn(),
  };

  const mockGameRepository = {
    findOne: jest.fn(),
  };

  const mockGamePlayerRepository = {
    findOne: jest.fn(),
  };

  const mockRedisService = {
    publishToGameJson: jest.fn(),
  };

  const mockRound: Partial<GameRound> = {
    id: 'round-1',
    gameId: 'game-1',
    roundNumber: 1,
    type: 'would_you_rather' as any,
    status: RoundStatus.ACTIVE,
    question: 'Test question?',
    options: ['Option A', 'Option B'],
    correctAnswer: null,
    timeLimit: 30,
    createdById: 'asker-1',
    roundData: {},
  };

  const mockGame: Partial<Game> = {
    id: 'game-1',
    name: 'Test Game',
    code: 'TEST123',
    gamePlayers: [],
  };

  const mockTargetPlayer: Partial<GamePlayer> = {
    id: 'player-1',
    gameId: 'game-1',
    userId: 'target-1',
    isSpectator: false,
    user: {
      id: 'target-1',
      firstName: 'John',
      lastName: 'Doe',
      username: 'johndoe',
      email: 'john@example.com',
      passwordHash: 'hash',
      role: 'user' as any,
      status: 'active' as any,
    } as any,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RoundsService,
        {
          provide: getRepositoryToken(GameRound),
          useValue: mockGameRoundRepository,
        },
        {
          provide: getRepositoryToken(Game),
          useValue: mockGameRepository,
        },
        {
          provide: getRepositoryToken(GamePlayer),
          useValue: mockGamePlayerRepository,
        },
        {
          provide: RedisService,
          useValue: mockRedisService,
        },
      ],
    }).compile();

    service = module.get<RoundsService>(RoundsService);
    gameRoundRepository = module.get(getRepositoryToken(GameRound));
    gameRepository = module.get(getRepositoryToken(Game));
    gamePlayerRepository = module.get(getRepositoryToken(GamePlayer));
    redisService = module.get(RedisService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('setTarget', () => {
    const roundId = 'round-1';
    const askerId = 'asker-1';
    const targetPlayerId = 'target-1';
    const playerGameId = 'game-1';

    it('should successfully set target for a round', async () => {
      // Arrange
      const roundWithGame = {
        ...mockRound,
        game: mockGame,
        game: {
          ...mockGame,
          gamePlayers: [mockTargetPlayer],
        },
      };

      gameRoundRepository.findOne
        .mockResolvedValueOnce(roundWithGame as GameRound)
        .mockResolvedValueOnce(mockRound as GameRound);

      gamePlayerRepository.findOne.mockResolvedValue(mockTargetPlayer as GamePlayer);

      // Act
      const result = await service.setTarget(roundId, askerId, targetPlayerId, playerGameId);

      // Assert
      expect(gameRoundRepository.findOne).toHaveBeenCalledWith({
        where: { id: roundId },
        relations: ['game', 'game.gamePlayers', 'game.gamePlayers.user'],
      });

      expect(gamePlayerRepository.findOne).toHaveBeenCalledWith({
        where: {
          gameId: 'game-1',
          userId: targetPlayerId,
        },
        relations: ['user'],
      });

      expect(gameRoundRepository.update).toHaveBeenCalledWith(roundId, {
        roundData: {
          targetPlayerId,
          targetSetAt: expect.any(String),
          targetSetBy: askerId,
        },
      });

      expect(redisService.publishToGameJson).toHaveBeenCalledWith('game-1', {
        type: 'target_set',
        data: {
          roundId,
          askerId,
          targetPlayerId,
          targetPlayerName: 'John Doe',
          setAt: expect.any(String),
          isPrivate: true,
        },
      });

      expect(result).toEqual({
        roundId,
        askerId,
        targetPlayerId,
        targetPlayerName: 'John Doe',
        setAt: expect.any(String),
        message: 'Target set successfully: John Doe',
      });
    });

    it('should throw NotFoundException when round not found', async () => {
      // Arrange
      gameRoundRepository.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(
        service.setTarget(roundId, askerId, targetPlayerId, playerGameId)
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException when round does not belong to player game', async () => {
      // Arrange
      const roundWithDifferentGame = {
        ...mockRound,
        gameId: 'different-game',
        game: mockGame,
      };

      gameRoundRepository.findOne.mockResolvedValue(roundWithDifferentGame as GameRound);

      // Act & Assert
      await expect(
        service.setTarget(roundId, askerId, targetPlayerId, playerGameId)
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw BadRequestException when round is not active', async () => {
      // Arrange
      const inactiveRound = {
        ...mockRound,
        status: RoundStatus.FINISHED,
        game: mockGame,
      };

      gameRoundRepository.findOne.mockResolvedValue(inactiveRound as GameRound);

      // Act & Assert
      await expect(
        service.setTarget(roundId, askerId, targetPlayerId, playerGameId)
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw ForbiddenException when asker is not the round creator', async () => {
      // Arrange
      const roundWithDifferentCreator = {
        ...mockRound,
        createdById: 'different-asker',
        game: mockGame,
      };

      gameRoundRepository.findOne.mockResolvedValue(roundWithDifferentCreator as GameRound);

      // Act & Assert
      await expect(
        service.setTarget(roundId, askerId, targetPlayerId, playerGameId)
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw NotFoundException when target player not found', async () => {
      // Arrange
      const roundWithGame = {
        ...mockRound,
        game: mockGame,
      };

      gameRoundRepository.findOne.mockResolvedValue(roundWithGame as GameRound);
      gamePlayerRepository.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(
        service.setTarget(roundId, askerId, targetPlayerId, playerGameId)
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when target player is a spectator', async () => {
      // Arrange
      const roundWithGame = {
        ...mockRound,
        game: mockGame,
      };

      const spectatorPlayer = {
        ...mockTargetPlayer,
        isSpectator: true,
      };

      gameRoundRepository.findOne.mockResolvedValue(roundWithGame as GameRound);
      gamePlayerRepository.findOne.mockResolvedValue(spectatorPlayer as GamePlayer);

      // Act & Assert
      await expect(
        service.setTarget(roundId, askerId, targetPlayerId, playerGameId)
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when trying to target self', async () => {
      // Arrange
      const roundWithGame = {
        ...mockRound,
        game: mockGame,
      };

      gameRoundRepository.findOne.mockResolvedValue(roundWithGame as GameRound);
      gamePlayerRepository.findOne.mockResolvedValue(mockTargetPlayer as GamePlayer);

      // Act & Assert
      await expect(
        service.setTarget(roundId, askerId, askerId, playerGameId)
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when target is already set', async () => {
      // Arrange
      const roundWithTarget = {
        ...mockRound,
        roundData: {
          targetPlayerId: 'existing-target',
          targetSetAt: '2024-01-01T00:00:00.000Z',
        },
        game: mockGame,
      };

      gameRoundRepository.findOne.mockResolvedValue(roundWithTarget as GameRound);

      // Act & Assert
      await expect(
        service.setTarget(roundId, askerId, targetPlayerId, playerGameId)
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('getRoundTarget', () => {
    const roundId = 'round-1';
    const playerId = 'asker-1';

    it('should return target information for round asker', async () => {
      // Arrange
      const roundWithTarget = {
        ...mockRound,
        roundData: {
          targetPlayerId: 'target-1',
          targetSetAt: '2024-01-01T00:00:00.000Z',
        },
        game: {
          ...mockGame,
          gamePlayers: [mockTargetPlayer],
        },
      };

      gameRoundRepository.findOne.mockResolvedValue(roundWithTarget as GameRound);

      // Act
      const result = await service.getRoundTarget(roundId, playerId);

      // Assert
      expect(result).toEqual({
        targetSet: true,
        targetPlayerId: 'target-1',
        targetPlayerName: 'John Doe',
        setAt: '2024-01-01T00:00:00.000Z',
      });
    });

    it('should return targetSet false when no target is set', async () => {
      // Arrange
      const roundWithoutTarget = {
        ...mockRound,
        roundData: {},
        game: mockGame,
      };

      gameRoundRepository.findOne.mockResolvedValue(roundWithoutTarget as GameRound);

      // Act
      const result = await service.getRoundTarget(roundId, playerId);

      // Assert
      expect(result).toEqual({ targetSet: false });
    });

    it('should throw ForbiddenException when non-asker tries to view target', async () => {
      // Arrange
      const roundWithDifferentCreator = {
        ...mockRound,
        createdById: 'different-asker',
        game: mockGame,
      };

      gameRoundRepository.findOne.mockResolvedValue(roundWithDifferentCreator as GameRound);

      // Act & Assert
      await expect(
        service.getRoundTarget(roundId, playerId)
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw NotFoundException when round not found', async () => {
      // Arrange
      gameRoundRepository.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(
        service.getRoundTarget(roundId, playerId)
      ).rejects.toThrow(NotFoundException);
    });
  });
}); 
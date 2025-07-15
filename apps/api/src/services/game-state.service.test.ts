import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GameStateService, GameState, GameStateTransitionError } from './game-state.service';
import { Game, GameStatus, GameRound, RoundStatus } from '@party-puzzle-palooza/database';
import { RedisService } from '../redis/redis.service';

describe('GameStateService', () => {
  let service: GameStateService;
  let gameRepository: jest.Mocked<Repository<Game>>;
  let gameRoundRepository: jest.Mocked<Repository<GameRound>>;
  let redisService: jest.Mocked<RedisService>;

  const mockGameRepository = {
    save: jest.fn(),
    findOne: jest.fn(),
  };

  const mockGameRoundRepository = {
    save: jest.fn(),
    findOne: jest.fn(),
  };

  const mockRedisService = {
    publishToGameJson: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GameStateService,
        {
          provide: getRepositoryToken(Game),
          useValue: mockGameRepository,
        },
        {
          provide: getRepositoryToken(GameRound),
          useValue: mockGameRoundRepository,
        },
        {
          provide: RedisService,
          useValue: mockRedisService,
        },
      ],
    }).compile();

    service = module.get<GameStateService>(GameStateService);
    gameRepository = module.get(getRepositoryToken(Game));
    gameRoundRepository = module.get(getRepositoryToken(GameRound));
    redisService = module.get(RedisService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getCurrentState', () => {
    it('should return CANCELLED for cancelled games', () => {
      const game = { status: GameStatus.CANCELLED } as Game;
      expect(service.getCurrentState(game)).toBe(GameState.CANCELLED);
    });

    it('should return GAME_FINISHED for finished games', () => {
      const game = { status: GameStatus.FINISHED } as Game;
      expect(service.getCurrentState(game)).toBe(GameState.GAME_FINISHED);
    });

    it('should return LOBBY for waiting games', () => {
      const game = { status: GameStatus.WAITING } as Game;
      expect(service.getCurrentState(game)).toBe(GameState.LOBBY);
    });

    it('should return LOBBY for playing games without metadata', () => {
      const game = { status: GameStatus.PLAYING } as Game;
      expect(service.getCurrentState(game)).toBe(GameState.LOBBY);
    });

    it('should return state from metadata when available', () => {
      const game = {
        status: GameStatus.PLAYING,
        metadata: { currentState: GameState.ROUND_ACTIVE }
      } as Game;
      expect(service.getCurrentState(game)).toBe(GameState.ROUND_ACTIVE);
    });
  });

  describe('transitionTo', () => {
    const baseGame = {
      id: 'game-id',
      status: GameStatus.WAITING,
      currentPlayers: 3,
      roundsPerGame: 5,
      gameRounds: [],
      metadata: {},
    } as Game;

    const baseRound = {
      id: 'round-id',
      gameId: 'game-id',
      roundNumber: 1,
      status: RoundStatus.PENDING,
    } as GameRound;

    beforeEach(() => {
      gameRepository.save.mockImplementation((game) => Promise.resolve(game));
      gameRoundRepository.save.mockImplementation((round) => Promise.resolve(round));
      redisService.publishToGameJson.mockResolvedValue(1);
    });

    describe('LOBBY → QUESTION_BUILD', () => {
      it('should transition successfully when conditions are met', async () => {
        const game = {
          ...baseGame,
          currentPlayers: 3,
          gameRounds: [{ id: 'round-1' }],
        } as Game;

        const result = await service.transitionTo(game, GameState.QUESTION_BUILD);

        expect(result.game.status).toBe(GameStatus.PLAYING);
        expect(result.game.startedAt).toBeDefined();
        expect(result.game.metadata.currentState).toBe(GameState.QUESTION_BUILD);
        expect(gameRepository.save).toHaveBeenCalledWith(result.game);
        expect(redisService.publishToGameJson).toHaveBeenCalled();
      });

      it('should throw error when not enough players', async () => {
        const game = {
          ...baseGame,
          currentPlayers: 1,
          gameRounds: [{ id: 'round-1' }],
        } as Game;

        await expect(
          service.transitionTo(game, GameState.QUESTION_BUILD)
        ).rejects.toThrow(GameStateTransitionError);
      });

      it('should throw error when no questions available', async () => {
        const game = {
          ...baseGame,
          currentPlayers: 3,
          gameRounds: [],
        } as Game;

        await expect(
          service.transitionTo(game, GameState.QUESTION_BUILD)
        ).rejects.toThrow(GameStateTransitionError);
      });
    });

    describe('QUESTION_BUILD → ROUND_ACTIVE', () => {
      it('should transition successfully with valid round', async () => {
        const game = {
          ...baseGame,
          status: GameStatus.PLAYING,
          metadata: { currentState: GameState.QUESTION_BUILD },
        } as Game;

        const round = {
          ...baseRound,
          status: RoundStatus.PENDING,
        } as GameRound;

        const result = await service.transitionTo(game, GameState.ROUND_ACTIVE, round);

        expect(result.game.metadata.currentState).toBe(GameState.ROUND_ACTIVE);
        expect(result.game.metadata.currentRoundId).toBe(round.id);
        expect(gameRoundRepository.save).toHaveBeenCalledWith(round);
        expect(redisService.publishToGameJson).toHaveBeenCalled();
      });

      it('should throw error when round is not pending', async () => {
        const game = {
          ...baseGame,
          status: GameStatus.PLAYING,
          metadata: { currentState: GameState.QUESTION_BUILD },
        } as Game;

        const round = {
          ...baseRound,
          status: RoundStatus.ACTIVE,
        } as GameRound;

        await expect(
          service.transitionTo(game, GameState.ROUND_ACTIVE, round)
        ).rejects.toThrow(GameStateTransitionError);
      });
    });

    describe('ROUND_ACTIVE → ROUND_RESULTS', () => {
      it('should transition successfully', async () => {
        const game = {
          ...baseGame,
          status: GameStatus.PLAYING,
          metadata: { currentState: GameState.ROUND_ACTIVE },
        } as Game;

        const round = {
          ...baseRound,
          status: RoundStatus.ACTIVE,
        } as GameRound;

        const result = await service.transitionTo(game, GameState.ROUND_RESULTS, round);

        expect(result.game.metadata.currentState).toBe(GameState.ROUND_RESULTS);
        expect(gameRoundRepository.save).toHaveBeenCalledWith(round);
        expect(round.status).toBe(RoundStatus.FINISHED);
        expect(round.endedAt).toBeDefined();
      });
    });

    describe('ROUND_RESULTS → ROUND_ACTIVE (next round)', () => {
      it('should transition to next round successfully', async () => {
        const game = {
          ...baseGame,
          status: GameStatus.PLAYING,
          metadata: { currentState: GameState.ROUND_RESULTS },
        } as Game;

        const currentRound = {
          ...baseRound,
          roundNumber: 1,
          status: RoundStatus.FINISHED,
        } as GameRound;

        const nextRound = {
          ...baseRound,
          id: 'round-2',
          roundNumber: 2,
          status: RoundStatus.PENDING,
        } as GameRound;

        gameRoundRepository.findOne.mockResolvedValue(nextRound);

        const result = await service.transitionTo(game, GameState.ROUND_ACTIVE, currentRound);

        expect(result.game.metadata.currentState).toBe(GameState.ROUND_ACTIVE);
        expect(result.game.metadata.currentRoundNumber).toBe(2);
        expect(gameRoundRepository.save).toHaveBeenCalledWith(nextRound);
      });

      it('should throw error when no more rounds available', async () => {
        const game = {
          ...baseGame,
          status: GameStatus.PLAYING,
          metadata: { currentState: GameState.ROUND_RESULTS },
          roundsPerGame: 1,
        } as Game;

        const currentRound = {
          ...baseRound,
          roundNumber: 1,
          status: RoundStatus.FINISHED,
        } as GameRound;

        await expect(
          service.transitionTo(game, GameState.ROUND_ACTIVE, currentRound)
        ).rejects.toThrow(GameStateTransitionError);
      });
    });

    describe('ROUND_RESULTS → GAME_FINISHED', () => {
      it('should transition when all rounds are complete', async () => {
        const game = {
          ...baseGame,
          status: GameStatus.PLAYING,
          metadata: { currentState: GameState.ROUND_RESULTS },
          roundsPerGame: 2,
          gameRounds: [
            { status: RoundStatus.FINISHED },
            { status: RoundStatus.FINISHED },
          ],
        } as Game;

        const result = await service.transitionTo(game, GameState.GAME_FINISHED);

        expect(result.game.status).toBe(GameStatus.FINISHED);
        expect(result.game.metadata.currentState).toBe(GameState.GAME_FINISHED);
        expect(result.game.finishedAt).toBeDefined();
      });

      it('should throw error when not all rounds are complete', async () => {
        const game = {
          ...baseGame,
          status: GameStatus.PLAYING,
          metadata: { currentState: GameState.ROUND_RESULTS },
          roundsPerGame: 3,
          gameRounds: [
            { status: RoundStatus.FINISHED },
            { status: RoundStatus.PENDING },
          ],
        } as Game;

        await expect(
          service.transitionTo(game, GameState.GAME_FINISHED)
        ).rejects.toThrow(GameStateTransitionError);
      });
    });

    describe('LOBBY → CANCELLED', () => {
      it('should cancel game successfully', async () => {
        const game = {
          ...baseGame,
          status: GameStatus.WAITING,
        } as Game;

        const result = await service.transitionTo(game, GameState.CANCELLED);

        expect(result.game.status).toBe(GameStatus.CANCELLED);
        expect(result.game.metadata.currentState).toBe(GameState.CANCELLED);
        expect(result.game.finishedAt).toBeDefined();
      });

      it('should throw error when game is already finished', async () => {
        const game = {
          ...baseGame,
          status: GameStatus.FINISHED,
        } as Game;

        await expect(
          service.transitionTo(game, GameState.CANCELLED)
        ).rejects.toThrow(GameStateTransitionError);
      });
    });

    describe('Invalid transitions', () => {
      it('should throw error for invalid transition', async () => {
        const game = {
          ...baseGame,
          status: GameStatus.WAITING,
        } as Game;

        await expect(
          service.transitionTo(game, GameState.GAME_FINISHED)
        ).rejects.toThrow(GameStateTransitionError);
      });

      it('should include current and target state in error', async () => {
        const game = {
          ...baseGame,
          status: GameStatus.WAITING,
        } as Game;

        try {
          await service.transitionTo(game, GameState.GAME_FINISHED);
        } catch (error) {
          expect(error).toBeInstanceOf(GameStateTransitionError);
          expect(error.currentState).toBe(GameState.LOBBY);
          expect(error.targetState).toBe(GameState.GAME_FINISHED);
        }
      });
    });
  });

  describe('getAvailableTransitions', () => {
    it('should return available transitions for LOBBY state', () => {
      const game = { status: GameStatus.WAITING } as Game;
      const transitions = service.getAvailableTransitions(game);
      expect(transitions).toContain(GameState.QUESTION_BUILD);
      expect(transitions).toContain(GameState.CANCELLED);
    });

    it('should return available transitions for QUESTION_BUILD state', () => {
      const game = {
        status: GameStatus.PLAYING,
        metadata: { currentState: GameState.QUESTION_BUILD },
      } as Game;
      const transitions = service.getAvailableTransitions(game);
      expect(transitions).toContain(GameState.ROUND_ACTIVE);
      expect(transitions).toContain(GameState.CANCELLED);
    });
  });

  describe('canTransitionTo', () => {
    it('should return true for valid transition with met conditions', async () => {
      const game = {
        ...baseGame,
        currentPlayers: 3,
        gameRounds: [{ id: 'round-1' }],
      } as Game;

      const canTransition = await service.canTransitionTo(game, GameState.QUESTION_BUILD);
      expect(canTransition).toBe(true);
    });

    it('should return false for invalid transition', async () => {
      const game = {
        ...baseGame,
        status: GameStatus.WAITING,
      } as Game;

      const canTransition = await service.canTransitionTo(game, GameState.GAME_FINISHED);
      expect(canTransition).toBe(false);
    });

    it('should return false when conditions are not met', async () => {
      const game = {
        ...baseGame,
        currentPlayers: 1,
        gameRounds: [],
      } as Game;

      const canTransition = await service.canTransitionTo(game, GameState.QUESTION_BUILD);
      expect(canTransition).toBe(false);
    });
  });
}); 
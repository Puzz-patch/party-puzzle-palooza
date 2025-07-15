import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Game, GameRound, RoundStatus } from '@party-puzzle-palooza/database';

export interface GameManifest {
  id: string;
  name: string;
  code: string;
  description?: string | null;
  status: string;
  type: string;
  maxPlayers: number;
  currentPlayers: number;
  roundsPerGame: number;
  timePerRound: number;
  players: GamePlayer[];
  queuedQuestions: GameQuestion[];
  flags: GameFlags;
  createdAt: Date;
  startedAt?: Date | null;
  finishedAt?: Date | null;
}

export interface GamePlayer {
  id: string;
  username: string;
  firstName: string;
  lastName: string;
  avatarUrl?: string | null;
  score: number;
  correctAnswers: number;
  totalAnswers: number;
  isHost: boolean;
  isSpectator: boolean;
  joinedAt: Date;
}

export interface GameQuestion {
  id: string;
  question: string;
  type: string;
  options: string[];
  correctAnswer?: string | null;
  category: string;
  roundNumber: number;
  flagCount: number;
  isFlagged: boolean;
  isHidden: boolean;
}

export interface GameFlags {
  isPrivate: boolean;
  hasPassword: boolean;
  isStarted: boolean;
  isFinished: boolean;
  isFull: boolean;
  chillMode: boolean;
}

@Injectable()
export class GameQueryService {
  private readonly logger = new Logger(GameQueryService.name);

  constructor(
    @InjectRepository(Game)
    private gameRepository: Repository<Game>,
    @InjectRepository(GameRound)
    private gameRoundRepository: Repository<GameRound>
  ) {}

  async getGameById(gameId: string): Promise<Game> {
    const game = await this.gameRepository.findOne({
      where: { id: gameId },
      relations: ['gamePlayers', 'gamePlayers.user', 'gameRounds']
    });

    if (!game) {
      throw new NotFoundException('Game not found');
    }

    return game;
  }

  async getGameManifest(gameId: string): Promise<GameManifest> {
    const game = await this.getGameById(gameId);

    const players = this.transformPlayers(game.gamePlayers);
    const queuedQuestions = this.transformQuestions(game.gameRounds, game.chillMode);
    const flags = this.generateGameFlags(game);

    return {
      id: game.id,
      name: game.name,
      code: game.code,
      description: game.description,
      status: game.status,
      type: game.type,
      maxPlayers: game.maxPlayers,
      currentPlayers: game.currentPlayers,
      roundsPerGame: game.roundsPerGame,
      timePerRound: game.timePerRound,
      players,
      queuedQuestions,
      flags,
      createdAt: game.createdAt,
      startedAt: game.startedAt,
      finishedAt: game.finishedAt
    };
  }

  async getGameWithRounds(gameId: string): Promise<Game> {
    return await this.gameRepository.findOne({
      where: { id: gameId },
      relations: ['gameRounds']
    });
  }

  async getGameWithAllRelations(gameId: string): Promise<Game> {
    return await this.gameRepository.findOne({
      where: { id: gameId },
      relations: ['gamePlayers', 'gamePlayers.user', 'gameRounds']
    });
  }

  private transformPlayers(gamePlayers: any[]): GamePlayer[] {
    return gamePlayers.map(gp => ({
      id: gp.user.id,
      username: gp.user.username,
      firstName: gp.user.firstName,
      lastName: gp.user.lastName,
      avatarUrl: gp.user.avatarUrl,
      score: gp.score,
      correctAnswers: gp.correctAnswers,
      totalAnswers: gp.totalAnswers,
      isHost: gp.isHost,
      isSpectator: gp.isSpectator,
      joinedAt: gp.joinedAt || gp.createdAt
    }));
  }

  private transformQuestions(gameRounds: GameRound[], chillMode: boolean): GameQuestion[] {
    // Filter questions based on chill mode
    let queuedQuestions = gameRounds;
    
    if (chillMode) {
      // In chill mode, only show mild questions (not flagged, no flags)
      queuedQuestions = gameRounds.filter(round => 
        !round.flagged && round.flagCount === 0
      );
    }

    return queuedQuestions.map(round => ({
      id: round.id,
      question: round.question,
      type: round.type,
      options: round.options,
      correctAnswer: round.correctAnswer,
      category: round.category,
      roundNumber: round.roundNumber,
      flagCount: round.flagCount,
      isFlagged: round.flagged,
      isHidden: round.flagged && round.flagCount >= 3
    }));
  }

  private generateGameFlags(game: Game): GameFlags {
    return {
      isPrivate: game.isPrivate,
      hasPassword: !!game.password,
      isStarted: game.status === 'playing' || game.status === 'finished',
      isFinished: game.status === 'finished',
      isFull: game.currentPlayers >= game.maxPlayers,
      chillMode: game.chillMode
    };
  }
} 
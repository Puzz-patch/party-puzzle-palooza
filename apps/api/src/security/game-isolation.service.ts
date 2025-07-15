import { Injectable, UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Game } from '@party-puzzle-palooza/database';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class GameIsolationService {
  constructor(
    @InjectRepository(Game)
    private gameRepository: Repository<Game>,
    private jwtService: JwtService,
  ) {}

  /**
   * Verify that a player has access to a specific game
   */
  async verifyGameAccess(gameId: string, playerToken: string): Promise<{ gameId: string; playerId: string }> {
    try {
      // Decode player token
      const payload = this.jwtService.verify(playerToken);
      
      if (!payload.gameId || !payload.playerId) {
        throw new UnauthorizedException('Invalid player token');
      }

      // Verify the player belongs to the requested game
      if (payload.gameId !== gameId) {
        throw new ForbiddenException('Access denied: Player does not belong to this game');
      }

      // Verify the game exists and is active
      const game = await this.gameRepository.findOne({
        where: { id: gameId },
        relations: ['players']
      });

      if (!game) {
        throw new ForbiddenException('Game not found');
      }

      if (game.status === 'completed' || game.status === 'cancelled') {
        throw new ForbiddenException('Game is no longer active');
      }

      // Verify the player is actually in this game
      const playerInGame = game.players.find(player => player.id === payload.playerId);
      if (!playerInGame) {
        throw new ForbiddenException('Player not found in game');
      }

      return {
        gameId: payload.gameId,
        playerId: payload.playerId
      };
    } catch (error) {
      if (error instanceof UnauthorizedException || error instanceof ForbiddenException) {
        throw error;
      }
      throw new UnauthorizedException('Invalid player token');
    }
  }

  /**
   * Verify that a player can perform an action in a specific round
   */
  async verifyRoundAccess(roundId: string, gameId: string, playerToken: string): Promise<{ gameId: string; playerId: string; roundId: string }> {
    const gameAccess = await this.verifyGameAccess(gameId, playerToken);
    
    // Additional round-specific validation can be added here
    // For example, checking if the round belongs to the game
    // and if the player can perform actions in this round
    
    return {
      ...gameAccess,
      roundId
    };
  }

  /**
   * Sanitize game data to prevent information leakage
   */
  sanitizeGameData(game: any, requestingPlayerId: string): any {
    if (!game) return game;

    const sanitized = { ...game };

    // Only show players that the requesting player should see
    if (sanitized.players) {
      sanitized.players = sanitized.players.map(player => ({
        id: this.hashUUID(player.id),
        name: player.name,
        avatar: player.avatar,
        isCurrentPlayer: player.id === requestingPlayerId,
        // Don't expose other player's tokens or sensitive data
        tokens: player.id === requestingPlayerId ? player.tokens : undefined,
        score: player.score || 0
      }));
    }

    // Sanitize questions to prevent author identification
    if (sanitized.questions) {
      sanitized.questions = sanitized.questions.map(question => ({
        id: this.hashUUID(question.id),
        text: question.text,
        category: question.category,
        flagged: question.flagged,
        // Don't expose author information unless it's the requesting player
        authorId: question.authorId === requestingPlayerId ? question.authorId : this.hashUUID(question.authorId)
      }));
    }

    // Sanitize rounds
    if (sanitized.rounds) {
      sanitized.rounds = sanitized.rounds.map(round => ({
        id: this.hashUUID(round.id),
        questionId: this.hashUUID(round.questionId),
        targetPlayerId: this.hashUUID(round.targetPlayerId),
        askerId: this.hashUUID(round.askerId),
        status: round.status,
        createdAt: round.createdAt,
        // Only show round details to participants
        details: this.sanitizeRoundDetails(round, requestingPlayerId)
      }));
    }

    return sanitized;
  }

  /**
   * Sanitize round details based on player permissions
   */
  private sanitizeRoundDetails(round: any, requestingPlayerId: string): any {
    const details = { ...round.details };

    // Only show target information to the asker
    if (round.askerId !== requestingPlayerId) {
      delete details.targetPlayerId;
    }

    // Only show answers to the asker or after reveal
    if (round.status !== 'revealed' && round.askerId !== requestingPlayerId) {
      delete details.answers;
    }

    // Sanitize player actions
    if (details.actions) {
      details.actions = details.actions.map(action => ({
        playerId: this.hashUUID(action.playerId),
        action: action.action,
        success: action.success,
        timestamp: action.timestamp
      }));
    }

    return details;
  }

  /**
   * Hash UUID to prevent direct identification
   */
  private hashUUID(uuid: string): string {
    const crypto = require('crypto');
    return `uuid_${crypto.createHash('sha256').update(uuid).digest('hex').substring(0, 8)}`;
  }

  /**
   * Verify that a player can access archived prompts
   */
  async verifyArchivedPromptsAccess(gameId: string, playerToken: string): Promise<{ gameId: string; playerId: string }> {
    const gameAccess = await this.verifyGameAccess(gameId, playerToken);
    
    // Additional validation for archived prompts access
    const game = await this.gameRepository.findOne({
      where: { id: gameId },
      relations: ['players']
    });

    if (!game) {
      throw new ForbiddenException('Game not found');
    }

    // Only allow access if game is completed or player is in the game
    if (game.status !== 'completed') {
      const playerInGame = game.players.find(player => player.id === gameAccess.playerId);
      if (!playerInGame) {
        throw new ForbiddenException('Access denied: Player not in game');
      }
    }

    return gameAccess;
  }

  /**
   * Verify that a player can flag a question
   */
  async verifyQuestionFlagAccess(questionId: string, gameId: string, playerToken: string): Promise<{ gameId: string; playerId: string; questionId: string }> {
    const gameAccess = await this.verifyGameAccess(gameId, playerToken);
    
    // Additional validation for question flagging
    // This could include checking if the question belongs to the game
    // and if the player has permission to flag it
    
    return {
      ...gameAccess,
      questionId
    };
  }

  /**
   * Log security events for monitoring
   */
  logSecurityEvent(event: string, details: any): void {
    console.log(`[SECURITY] ${event}:`, {
      timestamp: new Date().toISOString(),
      event,
      details: this.sanitizeLogDetails(details)
    });
  }

  /**
   * Sanitize log details to prevent sensitive data leakage
   */
  private sanitizeLogDetails(details: any): any {
    const sanitized = { ...details };
    
    // Remove sensitive fields from logs
    const sensitiveFields = ['token', 'password', 'secret', 'key'];
    for (const field of sensitiveFields) {
      if (sanitized[field]) {
        sanitized[field] = '[REDACTED]';
      }
    }

    // Hash UUIDs in logs
    if (sanitized.gameId) {
      sanitized.gameId = this.hashUUID(sanitized.gameId);
    }
    if (sanitized.playerId) {
      sanitized.playerId = this.hashUUID(sanitized.playerId);
    }

    return sanitized;
  }
} 
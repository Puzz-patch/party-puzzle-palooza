import { Controller, Get, Post, Param, Body, UseGuards, Req, HttpStatus, HttpCode, ForbiddenException } from '@nestjs/common';
import { GamesService, DrawNextQuestionResult } from '../services/games.service';
import { JwtPlayerGuard } from '../auth/jwt-player.guard';
import { PlayerId, GameId } from '../auth/player.decorator';
import { CreateCustomQuestionDto, CustomQuestionResponseDto } from '../dto/custom-question.dto';
import { GameManifestResponseDto } from '../dto/game-manifest.dto';
import { ApiOperation, ApiParam, ApiResponse } from '@nestjs/swagger';

@Controller('games')
@UseGuards(JwtPlayerGuard)
export class GamesController {
  constructor(private readonly gamesService: GamesService) {}

  @Get(':gid/manifest')
  @HttpCode(HttpStatus.OK)
  async getGameManifest(
    @Param('gid') gameId: string,
    @GameId() playerGameId: string
  ): Promise<GameManifestResponseDto> {
    // Ensure player is requesting manifest for their own game
    if (gameId !== playerGameId) {
      throw new Error('Access denied: game ID mismatch');
    }

    return this.gamesService.getGameManifest(gameId);
  }

  @Post(':gid/questions/custom')
  @HttpCode(HttpStatus.CREATED)
  async createCustomQuestion(
    @Param('gid') gameId: string,
    @Body() createDto: CreateCustomQuestionDto,
    @PlayerId() playerId: string,
    @GameId() playerGameId: string,
    @Req() request: any
  ): Promise<CustomQuestionResponseDto> {
    // Ensure player is creating question for their own game
    if (gameId !== playerGameId) {
      throw new Error('Access denied: game ID mismatch');
    }

    const ip = request.ip || request.connection.remoteAddress || 'unknown';
    
    return this.gamesService.createCustomQuestion(
      gameId,
      playerId,
      createDto,
      ip
    );
  }

  @Post(':gid/rounds/draw-next')
  @HttpCode(HttpStatus.OK)
  async drawNextQuestion(
    @Param('gid') gameId: string,
    @GameId() playerGameId: string
  ): Promise<DrawNextQuestionResult> {
    // Ensure player is drawing question for their own game
    if (gameId !== playerGameId) {
      throw new Error('Access denied: game ID mismatch');
    }

    return this.gamesService.drawNextQuestion(gameId);
  }

  @Post(':gid/reset')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ 
    summary: 'Reset game to lobby state',
    description: 'Reset a completed game back to lobby state for a new round'
  })
  @ApiParam({ name: 'gid', description: 'Game ID' })
  @ApiResponse({ 
    status: 200, 
    description: 'Game reset successfully'
  })
  @ApiResponse({ 
    status: 400, 
    description: 'Game cannot be reset'
  })
  @ApiResponse({ 
    status: 404, 
    description: 'Game not found'
  })
  async resetGame(
    @Param('gid') gameId: string,
    @GameId() playerGameId: string
  ): Promise<{ success: boolean; message: string; data: any }> {
    // Verify the game belongs to the player
    if (gameId !== playerGameId) {
      throw new ForbiddenException('Access denied: game does not belong to your session');
    }

    const result = await this.gamesService.resetGame(gameId);

    return {
      success: true,
      message: 'Game reset successfully to lobby state',
      data: result
    };
  }
} 
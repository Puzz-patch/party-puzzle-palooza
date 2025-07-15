import { Controller, Post, Param, UseGuards, HttpCode, HttpStatus, ForbiddenException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { FinaleService } from '../services/finale.service';
import { JwtPlayerGuard } from '../auth/jwt-player.guard';
import { GameId } from '../auth/player.decorator';
import { FinaleResponseDto } from '../dto/finale.dto';

@ApiTags('Game Finale')
@Controller('games')
@UseGuards(JwtPlayerGuard)
export class FinaleController {
  constructor(private readonly finaleService: FinaleService) {}

  @Post(':gid/finale')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ 
    summary: 'Finalize a game',
    description: 'End a game, compute final scores, check deck usage (≥50%), and grant unused prompt tokens'
  })
  @ApiParam({ name: 'gid', description: 'Game ID' })
  @ApiResponse({ 
    status: 200, 
    description: 'Game finalized successfully',
    type: FinaleResponseDto
  })
  @ApiResponse({ 
    status: 400, 
    description: 'Deck usage requirement not met or game already finalized'
  })
  @ApiResponse({ 
    status: 404, 
    description: 'Game not found'
  })
  @ApiResponse({ 
    status: 403, 
    description: 'Access denied'
  })
  async finalizeGame(
    @Param('gid') gameId: string,
    @GameId() playerGameId: string
  ): Promise<FinaleResponseDto> {
    // Verify the game belongs to the player
    if (gameId !== playerGameId) {
      throw new ForbiddenException('Access denied: game does not belong to your session');
    }

    const finaleResult = await this.finaleService.finalizeGame(gameId);

    return {
      success: true,
      message: `Game "${finaleResult.gameName}" finalized successfully! Winner: ${finaleResult.winner?.username} with ${finaleResult.winner?.finalScore} points.`,
      data: finaleResult
    };
  }
} 
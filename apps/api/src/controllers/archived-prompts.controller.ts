import { Controller, Get, Param, UseGuards, HttpCode, HttpStatus, ForbiddenException } from '@nestjs/common';
import { ArchivedPromptsService } from '../services/archived-prompts.service';
import { JwtPlayerGuard } from '../auth/jwt-player.guard';
import { GameId } from '../auth/player.decorator';

@Controller('games')
@UseGuards(JwtPlayerGuard)
export class ArchivedPromptsController {
  constructor(private readonly archivedPromptsService: ArchivedPromptsService) {}

  @Get(':gid/archived-prompts')
  @HttpCode(HttpStatus.OK)
  async getArchivedPrompts(@Param('gid') gameId: string, @GameId() playerGameId: string) {
    // Verify the game belongs to the player
    if (gameId !== playerGameId) {
      throw new ForbiddenException('Access denied: game does not belong to your session');
    }

    return this.archivedPromptsService.getArchivedPrompts(gameId);
  }
} 
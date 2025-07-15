import { Controller, Post, Get, Param, Body, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { PlayerActionService } from '../services/player-action.service';
import { JwtPlayerGuard } from '../auth/jwt-player.guard';
import { PlayerId, GameId } from '../auth/player.decorator';
import { PlayerActionDto, PlayerActionResponseDto } from '../dto/player-action.dto';

@Controller('rounds')
@UseGuards(JwtPlayerGuard)
export class PlayerActionController {
  constructor(private readonly playerActionService: PlayerActionService) {}

  @Post(':rid/action')
  @HttpCode(HttpStatus.OK)
  async performAction(
    @Param('rid') roundId: string,
    @Body() actionDto: PlayerActionDto,
    @PlayerId() playerId: string,
    @GameId() playerGameId: string
  ): Promise<PlayerActionResponseDto> {
    return this.playerActionService.performAction(roundId, playerId, playerGameId, actionDto);
  }

  @Get(':rid/actions')
  @HttpCode(HttpStatus.OK)
  async getRoundActions(
    @Param('rid') roundId: string,
    @GameId() playerGameId: string
  ) {
    return this.playerActionService.getRoundActions(roundId, playerGameId);
  }
} 
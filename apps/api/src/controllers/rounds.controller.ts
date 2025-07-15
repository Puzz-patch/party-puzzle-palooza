import { Controller, Get, Post, Param, Body, UseGuards, HttpCode, HttpStatus, BadRequestException } from '@nestjs/common';
import { RoundsService } from '../services/rounds.service';
import { JwtPlayerGuard } from '../auth/jwt-player.guard';
import { PlayerId, GameId } from '../auth/player.decorator';
import { SetTargetDto, SetTargetResponseDto } from '../dto/set-target.dto';

@Controller('rounds')
@UseGuards(JwtPlayerGuard)
export class RoundsController {
  constructor(private readonly roundsService: RoundsService) {}

  @Post(':rid/target')
  @HttpCode(HttpStatus.OK)
  async setTarget(
    @Param('rid') roundId: string,
    @Body() setTargetDto: SetTargetDto,
    @PlayerId() playerId: string,
    @GameId() playerGameId: string
  ): Promise<SetTargetResponseDto> {
    return this.roundsService.setTarget(roundId, playerId, setTargetDto.targetPlayerId, playerGameId);
  }

  @Get(':rid/phase')
  @HttpCode(HttpStatus.OK)
  async getRoundPhase(
    @Param('rid') roundId: string,
    @GameId() playerGameId: string
  ) {
    return this.roundsService.getRoundPhase(roundId);
  }
} 
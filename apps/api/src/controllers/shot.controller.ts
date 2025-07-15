import { Controller, Post, Get, Param, Body, UseGuards, HttpCode, HttpStatus, Query } from '@nestjs/common';
import { ShotService } from '../services/shot.service';
import { JwtPlayerGuard } from '../auth/jwt-player.guard';
import { PlayerId, GameId } from '../auth/player.decorator';
import { TakeShotDto, TakeShotResponseDto } from '../dto/take-shot.dto';

@Controller('rounds')
@UseGuards(JwtPlayerGuard)
export class ShotController {
  constructor(private readonly shotService: ShotService) {}

  @Post(':rid/shot')
  @HttpCode(HttpStatus.OK)
  async takeShot(
    @Param('rid') roundId: string,
    @Body() takeShotDto: TakeShotDto,
    @PlayerId() playerId: string,
    @GameId() playerGameId: string
  ): Promise<TakeShotResponseDto> {
    return this.shotService.takeShot(roundId, playerId, playerGameId, takeShotDto);
  }

  @Get('balance')
  @HttpCode(HttpStatus.OK)
  async getPlayerBalance(@PlayerId() playerId: string) {
    return this.shotService.getPlayerBalance(playerId);
  }

  @Get('transactions')
  @HttpCode(HttpStatus.OK)
  async getTransactionHistory(
    @PlayerId() playerId: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string
  ) {
    const limitNum = limit ? parseInt(limit, 10) : 20;
    const offsetNum = offset ? parseInt(offset, 10) : 0;
    
    return this.shotService.getTransactionHistory(playerId, limitNum, offsetNum);
  }
} 
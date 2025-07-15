import { IsString, IsOptional, IsNumber, Min, Max, IsBoolean } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class TakeShotDto {
  @ApiProperty({
    description: 'The answer option chosen by the player',
    example: 'Fly',
  })
  @IsString()
  answer: string;

  @ApiPropertyOptional({
    description: 'Amount of tokens to bet (optional, defaults to 1)',
    example: 5,
    minimum: 1,
    maximum: 100,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  betAmount?: number;

  @ApiPropertyOptional({
    description: 'Additional metadata for the shot',
    example: { confidence: 0.8, timeSpent: 15 },
  })
  @IsOptional()
  metadata?: Record<string, any>;
}

export class TakeShotResponseDto {
  @ApiProperty({
    description: 'The round ID',
    example: 'uuid',
  })
  roundId: string;

  @ApiProperty({
    description: 'The player ID who took the shot',
    example: 'uuid',
  })
  playerId: string;

  @ApiProperty({
    description: 'The answer provided',
    example: 'Fly',
  })
  answer: string;

  @ApiProperty({
    description: 'Amount of tokens bet',
    example: 5,
  })
  betAmount: number;

  @ApiProperty({
    description: 'Player balance before the shot',
    example: 1000,
  })
  balanceBefore: number;

  @ApiProperty({
    description: 'Player balance after the shot',
    example: 995,
  })
  balanceAfter: number;

  @ApiProperty({
    description: 'Transaction ID for the shot',
    example: 'uuid',
  })
  transactionId: string;

  @ApiProperty({
    description: 'Whether the game is in chill mode',
    example: false,
  })
  isChillMode: boolean;

  @ApiProperty({
    description: 'Success message',
    example: 'Shot taken successfully! 5 tokens deducted.',
  })
  message: string;
} 
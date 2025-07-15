import { IsString, IsEnum, IsOptional, IsNumber, Min, Max } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum PlayerActionType {
  ROLL = 'roll',
  FORCE = 'force',
  SHIELD = 'shield',
}

export class PlayerActionDto {
  @ApiProperty({
    description: 'The type of action to perform',
    enum: PlayerActionType,
    example: PlayerActionType.ROLL,
  })
  @IsEnum(PlayerActionType)
  actionType: PlayerActionType;

  @ApiPropertyOptional({
    description: 'Target player ID (required for force action)',
    example: 'player-uuid',
  })
  @IsOptional()
  @IsString()
  targetPlayerId?: string;

  @ApiPropertyOptional({
    description: 'Additional metadata for the action',
    example: { confidence: 0.8, reason: 'gut feeling' },
  })
  @IsOptional()
  metadata?: Record<string, any>;
}

export class PlayerActionResponseDto {
  @ApiProperty({
    description: 'The round ID',
    example: 'round-uuid',
  })
  roundId: string;

  @ApiProperty({
    description: 'The player ID who performed the action',
    example: 'player-uuid',
  })
  playerId: string;

  @ApiProperty({
    description: 'The type of action performed',
    enum: PlayerActionType,
    example: PlayerActionType.ROLL,
  })
  actionType: PlayerActionType;

  @ApiProperty({
    description: 'Whether the action was successful',
    example: true,
  })
  success: boolean;

  @ApiPropertyOptional({
    description: 'Target player ID (for force action)',
    example: 'target-player-uuid',
  })
  targetPlayerId?: string;

  @ApiProperty({
    description: 'Result of the action',
    example: 'heads',
  })
  result: string;

  @ApiProperty({
    description: 'Success message',
    example: 'Roll successful! Got heads.',
  })
  message: string;

  @ApiProperty({
    description: 'Updated round state patch',
    example: { phase: 'reveal_gamble', actions: { 'player-1': 'roll' } },
  })
  roundStatePatch: Record<string, any>;
}

export class ActionConstants {
  static readonly ROLL_SUCCESS_RATE = 0.5; // 50% chance
  static readonly FORCE_SUCCESS_RATE = 0.5; // 50% chance
  static readonly SHIELD_SUCCESS_RATE = 0.5; // 50% chance
  static readonly MAX_ACTIONS_PER_ROUND = 1;
  static readonly ACTION_COOLDOWN_MS = 5000; // 5 seconds
} 
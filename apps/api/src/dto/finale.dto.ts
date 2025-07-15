import { IsUUID, IsOptional, IsNumber, IsString, IsArray, IsObject } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class FinaleRequestDto {
  @ApiProperty({ description: 'Game ID to finalize' })
  @IsUUID()
  gameId!: string;
}

export class PlayerFinalScoreDto {
  @ApiProperty({ description: 'Player ID' })
  @IsUUID()
  playerId!: string;

  @ApiProperty({ description: 'Player username' })
  @IsString()
  username!: string;

  @ApiProperty({ description: 'Player first name' })
  @IsString()
  firstName!: string;

  @ApiProperty({ description: 'Player last name' })
  @IsString()
  lastName!: string;

  @ApiProperty({ description: 'Final score' })
  @IsNumber()
  finalScore!: number;

  @ApiProperty({ description: 'Correct answers count' })
  @IsNumber()
  correctAnswers!: number;

  @ApiProperty({ description: 'Total answers count' })
  @IsNumber()
  totalAnswers!: number;

  @ApiProperty({ description: 'Unused prompt tokens granted' })
  @IsNumber()
  unusedPromptTokens!: number;

  @ApiProperty({ description: 'Final rank' })
  @IsNumber()
  rank!: number;

  @ApiProperty({ description: 'Player statistics' })
  @IsObject()
  stats!: Record<string, any>;
}

export class GameFinaleResultDto {
  @ApiProperty({ description: 'Game ID' })
  @IsUUID()
  gameId!: string;

  @ApiProperty({ description: 'Game name' })
  @IsString()
  gameName!: string;

  @ApiProperty({ description: 'Game code' })
  @IsString()
  gameCode!: string;

  @ApiProperty({ description: 'Total rounds played' })
  @IsNumber()
  totalRounds!: number;

  @ApiProperty({ description: 'Deck usage percentage' })
  @IsNumber()
  deckUsagePercentage!: number;

  @ApiProperty({ description: 'Whether deck usage requirement was met' })
  deckUsageRequirementMet!: boolean;

  @ApiProperty({ description: 'Game winner' })
  @IsOptional()
  @IsObject()
  winner?: PlayerFinalScoreDto;

  @ApiProperty({ description: 'All player final scores' })
  @IsArray()
  playerScores!: PlayerFinalScoreDto[];

  @ApiProperty({ description: 'Total unused prompt tokens distributed' })
  @IsNumber()
  totalUnusedPromptTokens!: number;

  @ApiProperty({ description: 'Game completion timestamp' })
  @IsString()
  completedAt!: string;

  @ApiProperty({ description: 'Game statistics' })
  @IsObject()
  gameStats!: Record<string, any>;
}

export class FinaleResponseDto {
  @ApiProperty({ description: 'Success status' })
  success!: boolean;

  @ApiProperty({ description: 'Response message' })
  message!: string;

  @ApiProperty({ description: 'Finale results' })
  data!: GameFinaleResultDto;
} 
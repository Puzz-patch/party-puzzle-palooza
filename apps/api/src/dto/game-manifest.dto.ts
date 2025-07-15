import { IsUUID, IsString, IsEnum, IsNumber, IsBoolean, IsDate, IsOptional, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { GameStatus, GameType } from '@party-puzzle-palooza/database';

export class PlayerDto {
  @IsUUID()
  id!: string;

  @IsString()
  username!: string;

  @IsString()
  firstName!: string;

  @IsString()
  lastName!: string;

  @IsOptional()
  @IsString()
  avatarUrl?: string | null;

  @IsNumber()
  score!: number;

  @IsNumber()
  correctAnswers!: number;

  @IsNumber()
  totalAnswers!: number;

  @IsBoolean()
  isHost!: boolean;

  @IsBoolean()
  isSpectator!: boolean;

  @IsDate()
  joinedAt!: Date;
}

export class QueuedQuestionDto {
  @IsUUID()
  id!: string;

  @IsString()
  question!: string;

  @IsEnum(GameType)
  type!: GameType;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  options?: string[];

  @IsOptional()
  @IsString()
  correctAnswer?: string | null;

  @IsString()
  category!: string;

  @IsNumber()
  roundNumber!: number;
}

export class GameFlagsDto {
  @IsBoolean()
  isPrivate!: boolean;

  @IsBoolean()
  hasPassword!: boolean;

  @IsBoolean()
  isStarted!: boolean;

  @IsBoolean()
  isFinished!: boolean;

  @IsBoolean()
  isFull!: boolean;
}

export class GameManifestResponseDto {
  @IsUUID()
  id!: string;

  @IsString()
  name!: string;

  @IsString()
  code!: string;

  @IsOptional()
  @IsString()
  description?: string | null;

  @IsEnum(GameStatus)
  status!: GameStatus;

  @IsEnum(GameType)
  type!: GameType;

  @IsNumber()
  maxPlayers!: number;

  @IsNumber()
  currentPlayers!: number;

  @IsNumber()
  roundsPerGame!: number;

  @IsNumber()
  timePerRound!: number;

  @ValidateNested({ each: true })
  @Type(() => PlayerDto)
  @IsArray()
  players!: PlayerDto[];

  @ValidateNested({ each: true })
  @Type(() => QueuedQuestionDto)
  @IsArray()
  queuedQuestions!: QueuedQuestionDto[];

  @ValidateNested()
  @Type(() => GameFlagsDto)
  flags!: GameFlagsDto;

  @IsDate()
  createdAt!: Date;

  @IsOptional()
  @IsDate()
  startedAt?: Date | null;

  @IsOptional()
  @IsDate()
  finishedAt?: Date | null;
} 
import { IsString, IsEnum, IsOptional, IsArray, IsUUID, MinLength, MaxLength } from 'class-validator';
import { GameType } from '@party-puzzle-palooza/database';

export class CreateCustomQuestionDto {
  @IsString()
  @MinLength(10)
  @MaxLength(500)
  question!: string;

  @IsEnum(GameType)
  type!: GameType;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  options?: string[];

  @IsOptional()
  @IsString()
  correctAnswer?: string;

  @IsOptional()
  @IsString()
  category?: string;
}

export class CustomQuestionResponseDto {
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
  correctAnswer?: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsUUID()
  gameId!: string;

  @IsUUID()
  createdBy!: string;

  @IsString()
  status!: string;
} 
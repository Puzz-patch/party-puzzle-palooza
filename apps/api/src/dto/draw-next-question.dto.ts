import { IsString, IsNumber, IsArray, IsOptional, IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { RoundType } from '@party-puzzle-palooza/database';

export class DrawNextQuestionResponseDto {
  @ApiProperty({
    description: 'Unique identifier for the drawn round',
    example: '123e4567-e89b-12d3-a456-426614174000'
  })
  @IsString()
  roundId: string;

  @ApiProperty({
    description: 'Round number in the game sequence',
    example: 1
  })
  @IsNumber()
  roundNumber: number;

  @ApiProperty({
    description: 'The question text to be displayed',
    example: 'Would you rather have the ability to fly or be invisible?'
  })
  @IsString()
  question: string;

  @ApiProperty({
    description: 'Type of question',
    enum: RoundType,
    example: RoundType.WOULD_YOU_RATHER
  })
  @IsEnum(RoundType)
  type: RoundType;

  @ApiProperty({
    description: 'Available options for the question',
    example: ['Fly', 'Be invisible'],
    type: [String]
  })
  @IsArray()
  @IsString({ each: true })
  options: string[];

  @ApiProperty({
    description: 'Correct answer (for trivia questions)',
    example: 'Paris',
    required: false
  })
  @IsOptional()
  @IsString()
  correctAnswer?: string;

  @ApiProperty({
    description: 'Time limit for answering in seconds',
    example: 30
  })
  @IsNumber()
  timeLimit: number;

  @ApiProperty({
    description: 'Masked author ID for anonymity',
    example: 'author_a1b2c3d4'
  })
  @IsString()
  maskedAuthorId: string;

  @ApiProperty({
    description: 'Total number of rounds in the game',
    example: 5
  })
  @IsNumber()
  totalRounds: number;

  @ApiProperty({
    description: 'Current round number',
    example: 1
  })
  @IsNumber()
  currentRound: number;
}

export class DrawNextQuestionErrorDto {
  @ApiProperty({
    description: 'Error code',
    example: 'NO_QUESTIONS_AVAILABLE'
  })
  @IsString()
  error: string;

  @ApiProperty({
    description: 'Human-readable error message',
    example: 'No more questions available for this game'
  })
  @IsString()
  message: string;

  @ApiProperty({
    description: 'Game ID where the error occurred',
    example: '123e4567-e89b-12d3-a456-426614174000'
  })
  @IsString()
  gameId: string;
} 
import { IsUUID, IsString, IsEnum, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export enum FlagReason {
  INAPPROPRIATE = 'inappropriate',
  OFFENSIVE = 'offensive',
  SPAM = 'spam',
  DUPLICATE = 'duplicate',
  MISLEADING = 'misleading',
  OTHER = 'other'
}

export class FlagQuestionDto {
  @ApiProperty({ description: 'Question ID to flag' })
  @IsUUID()
  questionId!: string;

  @ApiProperty({ 
    description: 'Reason for flagging',
    enum: FlagReason
  })
  @IsEnum(FlagReason)
  reason!: FlagReason;

  @ApiProperty({ 
    description: 'Additional details about the flag',
    required: false
  })
  @IsOptional()
  @IsString()
  details?: string;
}

export class FlagQuestionResponseDto {
  @ApiProperty({ description: 'Success status' })
  success!: boolean;

  @ApiProperty({ description: 'Response message' })
  message!: string;

  @ApiProperty({ description: 'Flag count for this question' })
  flagCount!: number;

  @ApiProperty({ description: 'Whether question is now flagged' })
  isFlagged!: boolean;

  @ApiProperty({ description: 'Whether question is now hidden' })
  isHidden!: boolean;
}

export interface QuestionFlag {
  id: string;
  questionId: string;
  flaggedBy: string;
  reason: FlagReason;
  details?: string;
  createdAt: Date;
  isResolved: boolean;
  resolvedBy?: string;
  resolvedAt?: Date;
  resolution?: string;
} 
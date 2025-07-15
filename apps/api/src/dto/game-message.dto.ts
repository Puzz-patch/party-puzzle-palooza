import { IsString, IsUUID, IsEnum, IsOptional, IsObject, ValidateNested, IsArray, IsNumber, MaxLength } from 'class-validator';
import { Type } from 'class-transformer';

export enum GameMessageType {
  SUBSCRIBE = 'subscribe',
  UNSUBSCRIBE = 'unsubscribe',
  GAME_UPDATE = 'game_update',
  PLAYER_JOIN = 'player_join',
  PLAYER_LEAVE = 'player_leave',
  ROUND_START = 'round_start',
  ROUND_END = 'round_end',
  ANSWER_SUBMIT = 'answer_submit',
  CHAT_MESSAGE = 'chat_message',
  ERROR = 'error'
}

export class JsonPatch {
  @IsString()
  op: 'add' | 'remove' | 'replace' | 'move' | 'copy' | 'test';

  @IsString()
  path: string;

  @IsOptional()
  value?: any;

  @IsOptional()
  @IsString()
  from?: string;
}

export class GameMessageDto {
  @IsEnum(GameMessageType)
  type: GameMessageType;

  @IsUUID()
  gameId: string;

  @IsOptional()
  @IsUUID()
  userId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000) // 2KB limit for JSON patches
  data?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => JsonPatch)
  patches?: JsonPatch[];

  @IsOptional()
  @IsNumber()
  timestamp?: number;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}

export class SubscribeMessageDto {
  @IsUUID()
  gameId: string;

  @IsUUID()
  userId: string;

  @IsOptional()
  @IsString()
  username?: string;
}

export class GameUpdateDto {
  @IsUUID()
  gameId: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => JsonPatch)
  patches: JsonPatch[];

  @IsOptional()
  @IsNumber()
  timestamp?: number;
}

export class PlayerActionDto {
  @IsUUID()
  gameId: string;

  @IsUUID()
  userId: string;

  @IsString()
  action: string;

  @IsOptional()
  @IsObject()
  data?: Record<string, any>;
}

export class ChatMessageDto {
  @IsUUID()
  gameId: string;

  @IsUUID()
  userId: string;

  @IsString()
  @MaxLength(500)
  message: string;

  @IsOptional()
  @IsString()
  username?: string;
} 
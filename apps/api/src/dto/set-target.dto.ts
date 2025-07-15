import { IsString, IsUUID, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SetTargetDto {
  @ApiProperty({
    description: 'ID of the player to target',
    example: '123e4567-e89b-12d3-a456-426614174000'
  })
  @IsString()
  @IsUUID()
  @IsNotEmpty()
  targetPlayerId: string;
}

export class SetTargetResponseDto {
  @ApiProperty({
    description: 'Round ID where target was set',
    example: '123e4567-e89b-12d3-a456-426614174000'
  })
  roundId: string;

  @ApiProperty({
    description: 'ID of the player who set the target',
    example: '123e4567-e89b-12d3-a456-426614174000'
  })
  askerId: string;

  @ApiProperty({
    description: 'ID of the targeted player',
    example: '456e7890-e89b-12d3-a456-426614174000'
  })
  targetPlayerId: string;

  @ApiProperty({
    description: 'Display name of the targeted player',
    example: 'John Doe'
  })
  targetPlayerName: string;

  @ApiProperty({
    description: 'Timestamp when target was set',
    example: '2024-01-01T00:00:00.000Z'
  })
  setAt: string;

  @ApiProperty({
    description: 'Success message',
    example: 'Target set successfully'
  })
  message: string;
} 
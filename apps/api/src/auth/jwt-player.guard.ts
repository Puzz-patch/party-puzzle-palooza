import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';

export interface PlayerJwtPayload {
  playerId: string;
  gameId: string;
  iat?: number;
  exp?: number;
}

@Injectable()
export class JwtPlayerGuard implements CanActivate {
  constructor(private readonly jwtService: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request>();
    const token = req.cookies?.player_token;
    if (!token) {
      throw new UnauthorizedException('Missing player_token cookie');
    }
    try {
      const payload = await this.jwtService.verifyAsync<PlayerJwtPayload>(token);
      if (!payload?.playerId || !payload?.gameId) {
        throw new UnauthorizedException('Invalid player_token payload');
      }
      // Attach to request context
      (req as any).playerId = payload.playerId;
      (req as any).gameId = payload.gameId;
      return true;
    } catch (err) {
      throw new UnauthorizedException('Invalid or expired player_token');
    }
  }
} 
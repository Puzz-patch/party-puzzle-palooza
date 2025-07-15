import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const PlayerId = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const req = ctx.switchToHttp().getRequest();
    return req.playerId;
  },
);

export const GameId = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const req = ctx.switchToHttp().getRequest();
    return req.gameId;
  },
); 
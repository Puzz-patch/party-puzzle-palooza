import { Module, MiddlewareConsumer, RequestMethod } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { APP_INTERCEPTOR, APP_GUARD } from '@nestjs/core';

import { AppController } from './app.controller';
import { AppService } from './app.service';
import { GameGateway } from './game/game.gateway';
import { GamesController } from './games/games.controller';
import { GamesService } from './games/games.service';
import { RoundsController } from './rounds/rounds.controller';
import { RoundsService } from './rounds/rounds.service';
import { ShotsController } from './shots/shots.controller';
import { ShotsService } from './shots/shots.service';
import { PlayerActionsController } from './player-actions/player-actions.controller';
import { PlayerActionsService } from './player-actions/player-actions.service';
import { ArchivedPromptsController } from './archived-prompts/archived-prompts.controller';
import { ArchivedPromptsService } from './archived-prompts/archived-prompts.service';
import { FinaleController } from './finale/finale.controller';
import { FinaleService } from './finale/finale.service';
import { QuestionsController } from './questions/questions.controller';
import { QuestionsService } from './questions/questions.service';
import { RedisService } from './redis/redis.service';
import { OpenAIService } from './openai/openai.service';
import { RateLimitingService } from './rate-limiting/rate-limiting.service';
import { GameStateService } from './game-state/game-state.service';
import { TelemetryService } from './telemetry/telemetry';

// Security imports
import { SecurityMiddleware } from './security/security.middleware';
import { RateLimitMiddleware } from './security/rate-limit.middleware';
import { SecurityResponseInterceptor } from './security/response.interceptor';
import { GameIsolationService } from './security/game-isolation.service';
import { JwtPlayerGuard } from './auth/jwt-player.guard';

// Database entities
import { Game, GamePlayer, GameRound, PlayerAnswer, Question, User, UserBalance, TransactionLedger } from '@party-puzzle-palooza/database';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    TypeOrmModule.forRoot({
      type: 'postgres',
      url: process.env.DATABASE_URL,
      entities: [Game, GamePlayer, GameRound, PlayerAnswer, Question, User, UserBalance, TransactionLedger],
      synchronize: false,
      logging: process.env.NODE_ENV === 'development',
    }),
    TypeOrmModule.forFeature([Game, GamePlayer, GameRound, PlayerAnswer, Question, User, UserBalance, TransactionLedger]),
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'fallback-secret',
      signOptions: { expiresIn: '24h' },
    }),
  ],
  controllers: [
    AppController,
    GamesController,
    RoundsController,
    ShotsController,
    PlayerActionsController,
    ArchivedPromptsController,
    FinaleController,
    QuestionsController,
  ],
  providers: [
    AppService,
    GameGateway,
    GamesService,
    RoundsService,
    ShotsService,
    PlayerActionsService,
    ArchivedPromptsService,
    FinaleService,
    QuestionsService,
    RedisService,
    OpenAIService,
    RateLimitingService,
    GameStateService,
    TelemetryService,
    GameIsolationService,
    JwtPlayerGuard,
    {
      provide: APP_INTERCEPTOR,
      useClass: SecurityResponseInterceptor,
    },
  ],
})
export class AppModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(SecurityMiddleware, RateLimitMiddleware)
      .forRoutes({ path: '*', method: RequestMethod.ALL });
  }
} 
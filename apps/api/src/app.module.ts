import { Module, MiddlewareConsumer, RequestMethod } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { APP_INTERCEPTOR, APP_GUARD } from '@nestjs/core';

import { AppController } from './app.controller';
import { AppService } from './app.service';
import { GameGateway } from './gateway/game.gateway';
import { GamesController } from './controllers/games.controller';
import { GamesService } from './services/games.service';
import { RoundsController } from './controllers/rounds.controller';
import { RoundsService } from './services/rounds.service';
import { ShotController } from './controllers/shot.controller';
import { ShotService } from './services/shot.service';
import { PlayerActionController } from './controllers/player-action.controller';
import { PlayerActionService } from './services/player-action.service';
import { ArchivedPromptsController } from './controllers/archived-prompts.controller';
import { ArchivedPromptsService } from './services/archived-prompts.service';
import { FinaleController } from './controllers/finale.controller';
import { FinaleService } from './services/finale.service';
import { QuestionFlagController } from './controllers/question-flag.controller';
import { QuestionFlagService } from './services/question-flag.service';
import { RedisService } from './redis/redis.service';
import { ModerationService } from './services/moderation.service';
import { RateLimitService } from './services/rate-limit.service';
import { GameStateService } from './services/game-state.service';
import { TelemetryService } from './telemetry/telemetry';

// New smaller services
import { GameQueryService } from './services/game-query.service';
import { QuestionDrawingService } from './services/question-drawing.service';
import { CustomQuestionService } from './services/custom-question.service';
import { GameResetService } from './services/game-reset.service';
import { ActionValidationService } from './services/action-validation.service';
import { ActionProcessingService } from './services/action-processing.service';
import { StateTransitionService } from './services/state-transition.service';

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
    ShotController,
    PlayerActionController,
    ArchivedPromptsController,
    FinaleController,
    QuestionFlagController,
  ],
  providers: [
    AppService,
    GameGateway,
    
    // Main services (now orchestrators)
    GamesService,
    RoundsService,
    ShotService,
    PlayerActionService,
    ArchivedPromptsService,
    FinaleService,
    QuestionFlagService,
    GameStateService,
    
    // New smaller services
    GameQueryService,
    QuestionDrawingService,
    CustomQuestionService,
    GameResetService,
    ActionValidationService,
    ActionProcessingService,
    StateTransitionService,
    
    // Utility services
    RedisService,
    ModerationService,
    RateLimitService,
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
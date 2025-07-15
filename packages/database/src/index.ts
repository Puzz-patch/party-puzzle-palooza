// Database configuration
export { AppDataSource, initializeDatabase, closeDatabase } from './config/data-source';

// Base entity
export { BaseEntity } from './entities/base.entity';

// Entities
export { User, UserRole, UserStatus } from './entities/user.entity';
export { Game, GameStatus, GameType } from './entities/game.entity';
export { GamePlayer, PlayerStatus } from './entities/game-player.entity';
export { GameRound, RoundStatus, RoundType } from './entities/game-round.entity';
export { PlayerAnswer, AnswerStatus } from './entities/player-answer.entity';

// Repository types
export type { Repository } from 'typeorm'; 
# Database Documentation

This document describes the PostgreSQL database setup for Party Puzzle Palooza using TypeORM and RDS.

## 🏗️ Database Architecture

The database is built using PostgreSQL 15 with the following key features:

- **UUIDv4 Primary Keys**: Using pgcrypto extension for secure UUID generation
- **TypeORM**: Object-Relational Mapping with TypeScript support
- **Migrations**: Version-controlled database schema changes
- **RDS**: Managed PostgreSQL database on AWS

## 📊 Database Schema

### Core Tables

#### 1. Users Table
```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username VARCHAR(50) UNIQUE NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  passwordHash VARCHAR(255) NOT NULL,
  firstName VARCHAR(100) NOT NULL,
  lastName VARCHAR(100) NOT NULL,
  avatarUrl VARCHAR(255),
  role user_role_enum DEFAULT 'user',
  status user_status_enum DEFAULT 'active',
  lastLoginAt TIMESTAMP WITH TIME ZONE,
  emailVerifiedAt TIMESTAMP WITH TIME ZONE,
  emailVerificationToken VARCHAR(255),
  passwordResetToken VARCHAR(255),
  passwordResetExpiresAt TIMESTAMP WITH TIME ZONE,
  preferences JSONB,
  createdAt TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updatedAt TIMESTAMP WITH TIME ZONE DEFAULT now()
);
```

#### 2. Games Table
```sql
CREATE TABLE games (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  code VARCHAR(10) UNIQUE NOT NULL,
  description TEXT,
  status game_status_enum DEFAULT 'waiting',
  type game_type_enum DEFAULT 'would_you_rather',
  maxPlayers INTEGER DEFAULT 10,
  currentPlayers INTEGER DEFAULT 0,
  roundsPerGame INTEGER DEFAULT 5,
  timePerRound INTEGER DEFAULT 30,
  isPrivate BOOLEAN DEFAULT false,
  password VARCHAR(255),
  startedAt TIMESTAMP WITH TIME ZONE,
  finishedAt TIMESTAMP WITH TIME ZONE,
  settings JSONB,
  metadata JSONB,
  createdById UUID NOT NULL REFERENCES users(id),
  winnerId UUID REFERENCES users(id),
  createdAt TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updatedAt TIMESTAMP WITH TIME ZONE DEFAULT now()
);
```

#### 3. Game Players Table
```sql
CREATE TABLE game_players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gameId UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  userId UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status player_status_enum DEFAULT 'joined',
  score INTEGER DEFAULT 0,
  correctAnswers INTEGER DEFAULT 0,
  totalAnswers INTEGER DEFAULT 0,
  joinedAt TIMESTAMP WITH TIME ZONE,
  leftAt TIMESTAMP WITH TIME ZONE,
  isHost BOOLEAN DEFAULT false,
  isSpectator BOOLEAN DEFAULT false,
  gameStats JSONB,
  createdAt TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updatedAt TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(gameId, userId)
);
```

#### 4. Game Rounds Table
```sql
CREATE TABLE game_rounds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gameId UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  roundNumber INTEGER NOT NULL,
  type round_type_enum DEFAULT 'would_you_rather',
  status round_status_enum DEFAULT 'pending',
  question VARCHAR(255) NOT NULL,
  options JSONB NOT NULL,
  correctAnswer VARCHAR(255),
  timeLimit INTEGER DEFAULT 30,
  startedAt TIMESTAMP WITH TIME ZONE,
  endedAt TIMESTAMP WITH TIME ZONE,
  roundData JSONB,
  results JSONB,
  createdById UUID NOT NULL REFERENCES users(id),
  createdAt TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updatedAt TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(gameId, roundNumber)
);
```

#### 5. Player Answers Table
```sql
CREATE TABLE player_answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gameRoundId UUID NOT NULL REFERENCES game_rounds(id) ON DELETE CASCADE,
  userId UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  answer VARCHAR(255) NOT NULL,
  status answer_status_enum DEFAULT 'submitted',
  pointsEarned INTEGER DEFAULT 0,
  timeToAnswer INTEGER DEFAULT 0,
  isCorrect BOOLEAN DEFAULT false,
  submittedAt TIMESTAMP WITH TIME ZONE,
  answerData JSONB,
  createdAt TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updatedAt TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(gameRoundId, userId)
);
```

### Enums

```sql
-- User roles and status
CREATE TYPE user_role_enum AS ENUM ('admin', 'user');
CREATE TYPE user_status_enum AS ENUM ('active', 'inactive', 'suspended');

-- Game types and status
CREATE TYPE game_status_enum AS ENUM ('waiting', 'playing', 'finished', 'cancelled');
CREATE TYPE game_type_enum AS ENUM ('would_you_rather', 'trivia', 'word_association', 'drawing');

-- Player status
CREATE TYPE player_status_enum AS ENUM ('joined', 'ready', 'playing', 'left', 'disconnected');

-- Round types and status
CREATE TYPE round_status_enum AS ENUM ('pending', 'active', 'finished', 'cancelled');
CREATE TYPE round_type_enum AS ENUM ('would_you_rather', 'trivia', 'word_association', 'drawing');

-- Answer status
CREATE TYPE answer_status_enum AS ENUM ('submitted', 'correct', 'incorrect', 'timeout');
```

## 🔧 TypeORM Entities

### Base Entity
All entities extend the `BaseEntity` class which provides:
- UUID primary key with automatic generation
- Created and updated timestamps
- Automatic UUID generation on insert

### Entity Relationships

```typescript
// User -> Game (One-to-Many)
@OneToMany(() => Game, (game) => game.createdBy)
createdGames: Game[];

// Game -> GamePlayer (One-to-Many)
@OneToMany(() => GamePlayer, (gamePlayer) => gamePlayer.game)
gamePlayers: GamePlayer[];

// Game -> GameRound (One-to-Many)
@OneToMany(() => GameRound, (gameRound) => gameRound.game)
gameRounds: GameRound[];

// GameRound -> PlayerAnswer (One-to-Many)
@OneToMany(() => PlayerAnswer, (playerAnswer) => playerAnswer.gameRound)
playerAnswers: PlayerAnswer[];
```

## 🚀 Setup Instructions

### 1. Prerequisites

- Node.js 18+
- pnpm 8.15.0+
- PostgreSQL 15+ (for local development)
- AWS account (for RDS)

### 2. Environment Configuration

Create a `.env` file in the root directory:

```bash
# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=your_password
DB_NAME=partypuzzlepalooza

# Environment
NODE_ENV=development

# AWS Configuration (for production)
AWS_REGION=us-west-2
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
```

### 3. Database Setup

#### Local Development
```bash
# Install dependencies
pnpm install

# Set up database
./scripts/setup-database.sh
```

#### Production (RDS)
```bash
# Deploy infrastructure
cd terraform/environments/staging
terraform apply

# Get database connection details
terraform output db_connection_string

# Update environment variables with RDS details
# Run migrations
pnpm db:migrate
```

### 4. Migration Commands

```bash
# Generate a new migration
pnpm db:generate -- -n MigrationName

# Run pending migrations
pnpm db:migrate

# Revert last migration
pnpm db:revert

# Show migration status
cd packages/database
pnpm migration:show
```

## 🔍 Database Operations

### Connection Management

```typescript
import { initializeDatabase, closeDatabase } from '@party-puzzle-palooza/database';

// Initialize connection
const dataSource = await initializeDatabase();

// Close connection
await closeDatabase();
```

### Repository Usage

```typescript
import { User, Game } from '@party-puzzle-palooza/database';
import { AppDataSource } from '@party-puzzle-palooza/database';

// Get repository
const userRepository = AppDataSource.getRepository(User);
const gameRepository = AppDataSource.getRepository(Game);

// Create user
const user = userRepository.create({
  username: 'john_doe',
  email: 'john@example.com',
  passwordHash: 'hashed_password',
  firstName: 'John',
  lastName: 'Doe'
});
await userRepository.save(user);

// Find games with players
const games = await gameRepository.find({
  relations: ['gamePlayers', 'gamePlayers.user'],
  where: { status: 'waiting' }
});
```

### Query Examples

```typescript
// Find active games
const activeGames = await gameRepository.find({
  where: { status: GameStatus.WAITING },
  relations: ['createdBy', 'gamePlayers']
});

// Find user's game history
const userGames = await gameRepository.find({
  where: { createdById: userId },
  order: { createdAt: 'DESC' }
});

// Get game statistics
const gameStats = await gameRepository
  .createQueryBuilder('game')
  .leftJoin('game.gamePlayers', 'player')
  .select([
    'game.id',
    'game.name',
    'COUNT(player.id) as playerCount',
    'AVG(player.score) as averageScore'
  ])
  .groupBy('game.id')
  .getRawMany();
```

## 🔒 Security Features

### UUID Primary Keys
- All tables use UUIDv4 primary keys generated by pgcrypto
- Prevents sequential ID enumeration attacks
- Provides better distribution for sharding

### SSL/TLS Encryption
- RDS instances enforce SSL connections
- Parameter group configured for SSL-only connections
- Application uses SSL in production

### Access Control
- Database users have minimal required permissions
- RDS security groups restrict access to ECS tasks only
- No public access to database instances

## 📈 Performance Optimization

### Indexes
- Primary keys are automatically indexed
- Foreign key columns are indexed
- Frequently queried columns have indexes
- Composite indexes for common query patterns

### Connection Pooling
- TypeORM manages connection pooling
- Configured for optimal performance
- Automatic connection cleanup

### Query Optimization
- Use relations to avoid N+1 queries
- Implement pagination for large datasets
- Use query builders for complex queries

## 🔄 Backup and Recovery

### Automated Backups
- RDS automated backups enabled
- 7-day retention for staging
- Point-in-time recovery available

### Manual Backups
```bash
# Create backup
pg_dump $DATABASE_URL > backup.sql

# Restore backup
psql $DATABASE_URL < backup.sql
```

## 🚨 Monitoring and Logging

### CloudWatch Integration
- RDS logs sent to CloudWatch
- Performance Insights enabled
- Enhanced monitoring configured

### Application Logging
```typescript
// Enable query logging in development
const AppDataSource = new DataSource({
  // ... other config
  logging: process.env.NODE_ENV === 'development',
});
```

## 🛠️ Troubleshooting

### Common Issues

1. **Connection Timeout**
   - Check security group rules
   - Verify database endpoint
   - Check network connectivity

2. **Migration Failures**
   - Ensure database is accessible
   - Check migration file syntax
   - Verify enum types exist

3. **Performance Issues**
   - Check query execution plans
   - Review index usage
   - Monitor connection pool usage

### Useful Commands

```bash
# Check database connection
psql $DATABASE_URL -c "SELECT version();"

# List all tables
psql $DATABASE_URL -c "\dt"

# Check table structure
psql $DATABASE_URL -c "\d users"

# Monitor active connections
psql $DATABASE_URL -c "SELECT * FROM pg_stat_activity;"
```

## 📚 Additional Resources

- [TypeORM Documentation](https://typeorm.io/)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [AWS RDS Documentation](https://docs.aws.amazon.com/rds/)
- [pgcrypto Extension](https://www.postgresql.org/docs/current/pgcrypto.html) 
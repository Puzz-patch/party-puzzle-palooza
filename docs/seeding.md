# Database Seeding Documentation

This document describes how to seed the Party Puzzle Palooza database with demo data for development and testing.

## 🌱 Overview

The seeding system provides a comprehensive way to populate the database with realistic demo data, including:

- **Demo Users**: 4-6 users with different roles and profiles
- **Game Lobby**: A ready-to-play game session
- **AI-Authored Questions**: 10+ questions across different game types
- **Player Data**: Realistic game statistics and preferences

## 🚀 Quick Start

### Simple Seeding
```bash
# Seed with default settings (4 users, 10 questions)
./scripts/seed-demo.sh

# Or use the npm script
pnpm db:seed:demo
```

### CLI Seeding (Advanced)
```bash
# Show help
pnpm db:seed:cli --help

# Seed with custom options
pnpm db:seed:cli seed --users 6 --questions 15 --clear

# Clear all data
pnpm db:seed:cli clear
```

## 📊 Demo Data Structure

### Users Created
| Username | Email | Role | Avatar |
|----------|-------|------|--------|
| alice_gamer | alice@example.com | User | DiceBear Avatar |
| bob_quizmaster | bob@example.com | User | DiceBear Avatar |
| charlie_puzzle | charlie@example.com | User | DiceBear Avatar |
| diana_admin | diana@example.com | Admin | DiceBear Avatar |
| emma_creative | emma@example.com | User | DiceBear Avatar |
| frank_thinker | frank@example.com | User | DiceBear Avatar |

**Default Password**: `password123` for all users

### Game Lobby
- **Name**: Friday Night Trivia
- **Code**: DEMO123
- **Type**: Trivia
- **Status**: Waiting
- **Max Players**: 8
- **Current Players**: 4
- **Rounds**: 10
- **Time per Round**: 30 seconds

### Question Types
1. **Would You Rather** (3 questions)
   - Fly vs Invisible
   - Past vs Future
   - Actor vs Entrepreneur

2. **Trivia** (5 questions)
   - Geography (Australia capital)
   - Science (Red Planet)
   - History (WWII end)
   - Art (Mona Lisa)
   - Geography (Largest ocean)

3. **Word Association** (4 questions)
   - Ocean associations
   - Time phrases
   - Home concepts
   - Success ideas

4. **Drawing** (4 prompts)
   - Happiness representation
   - Vacation destination
   - Favorite animal
   - Futuristic city

## 🔧 CLI Options

### Seed Command
```bash
pnpm db:seed:cli seed [options]
```

**Options:**
- `-c, --clear`: Clear existing data before seeding
- `-u, --users <number>`: Number of users to create (default: 4)
- `-q, --questions <number>`: Number of questions to create (default: 10)

**Examples:**
```bash
# Basic seeding
pnpm db:seed:cli seed

# Clear and seed with 6 users, 15 questions
pnpm db:seed:cli seed --clear --users 6 --questions 15

# Just add 5 questions to existing data
pnpm db:seed:cli seed --questions 5
```

### Clear Command
```bash
pnpm db:seed:cli clear
```

Removes all data from the database:
- Player answers
- Game rounds
- Game players
- Games
- Users

## 🎯 Use Cases

### Development
```bash
# Quick setup for development
./scripts/seed-demo.sh
```

### Testing
```bash
# Clear data and create fresh test data
pnpm db:seed:cli seed --clear --users 10 --questions 20
```

### Demo Presentations
```bash
# Create a full demo with many users
pnpm db:seed:cli seed --clear --users 8 --questions 25
```

### API Testing
```bash
# Minimal data for API testing
pnpm db:seed:cli seed --users 2 --questions 5
```

## 🔍 Data Verification

After seeding, you can verify the data:

### Check Database Tables
```bash
# Connect to database
psql $DATABASE_URL

# List tables
\dt

# Check users
SELECT username, email, role FROM users;

# Check games
SELECT name, code, status, current_players FROM games;

# Check questions
SELECT round_number, question, type FROM game_rounds;
```

### API Endpoints
```bash
# Health check
curl http://localhost:3001/health

# List games (when API is implemented)
curl http://localhost:3001/api/games

# Get specific game
curl http://localhost:3001/api/games/DEMO123
```

## 🛠️ Customization

### Adding New Users
Edit `packages/database/src/scripts/seed.ts`:

```typescript
const demoUsers: DemoUser[] = [
  // ... existing users
  {
    username: 'new_user',
    email: 'new@example.com',
    firstName: 'New',
    lastName: 'User',
    avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=new',
    role: UserRole.USER
  }
];
```

### Adding New Questions
```typescript
const questions: DemoQuestion[] = [
  // ... existing questions
  {
    question: "Your new question here?",
    options: ["Option 1", "Option 2", "Option 3"],
    correctAnswer: "Option 1", // for trivia questions
    type: RoundType.TRIVIA
  }
];
```

### Custom Game Settings
```typescript
const game = this.gameRepository.create({
  name: 'Custom Game Name',
  code: 'CUSTOM',
  type: GameType.WOULD_YOU_RATHER,
  settings: {
    allowSpectators: false,
    showLeaderboard: false,
    difficulty: 'hard'
  }
});
```

## 🔒 Security Notes

### Demo Credentials
- All demo users have the same password: `password123`
- Passwords are properly hashed using bcrypt
- Users are marked as email verified
- Admin user (diana_admin) has elevated privileges

### Production Considerations
- Never run seeding scripts in production
- Use environment-specific data sources
- Implement proper authentication for admin operations
- Consider data privacy and GDPR compliance

## 🚨 Troubleshooting

### Common Issues

1. **Database Connection Failed**
   ```bash
   # Check .env file
   cat .env
   
   # Test connection
   psql $DATABASE_URL -c "SELECT 1;"
   ```

2. **Migration Errors**
   ```bash
   # Run migrations first
   pnpm db:migrate
   
   # Then seed
   pnpm db:seed
   ```

3. **Permission Denied**
   ```bash
   # Make script executable
   chmod +x scripts/seed-demo.sh
   ```

4. **Dependencies Missing**
   ```bash
   # Install dependencies
   pnpm install
   
   # Build database package
   cd packages/database && pnpm build
   ```

### Debug Mode
```bash
# Run with verbose logging
DEBUG=* pnpm db:seed:cli seed
```

## 📚 Related Documentation

- [Database Setup](./database.md)
- [API Documentation](./api.md)
- [Development Guide](./development.md)

## 🤝 Contributing

When adding new demo data:

1. Follow the existing patterns
2. Use realistic but safe data
3. Include proper TypeScript types
4. Add documentation for new features
5. Test with different configurations 
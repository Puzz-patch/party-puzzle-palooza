-- Add chill_mode column to games table
ALTER TABLE games 
ADD COLUMN chill_mode BOOLEAN DEFAULT FALSE;

-- Create index for chill mode queries
CREATE INDEX idx_games_chill_mode ON games(chill_mode);

-- Add comment to the column
COMMENT ON COLUMN games.chill_mode IS 'When true, only mild questions (not flagged) are used in the game';

-- Update existing games to have chill_mode = false by default
UPDATE games SET chill_mode = FALSE WHERE chill_mode IS NULL; 
-- Add archived and revealed fields to game_rounds table
ALTER TABLE game_rounds 
ADD COLUMN revealed BOOLEAN NOT NULL DEFAULT FALSE,
ADD COLUMN revealed_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN archived BOOLEAN NOT NULL DEFAULT FALSE,
ADD COLUMN archived_at TIMESTAMP WITH TIME ZONE;

-- Create indexes for better query performance
CREATE INDEX idx_game_rounds_revealed ON game_rounds(revealed);
CREATE INDEX idx_game_rounds_archived ON game_rounds(archived);
CREATE INDEX idx_game_rounds_game_revealed ON game_rounds(game_id, revealed);
CREATE INDEX idx_game_rounds_game_archived ON game_rounds(game_id, archived); 
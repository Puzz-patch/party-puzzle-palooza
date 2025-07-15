-- Enable pgcrypto for UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create enum for flag reasons
CREATE TYPE flag_reason AS ENUM (
  'inappropriate',
  'offensive', 
  'spam',
  'duplicate',
  'misleading',
  'other'
);

-- Add flag-related columns to game_rounds table
ALTER TABLE game_rounds 
ADD COLUMN flagged BOOLEAN DEFAULT FALSE,
ADD COLUMN flagged_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN flag_count INTEGER DEFAULT 0;

-- Create question_flags table
CREATE TABLE question_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id UUID NOT NULL REFERENCES game_rounds(id) ON DELETE CASCADE,
  flagged_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reason flag_reason NOT NULL,
  details TEXT,
  is_resolved BOOLEAN DEFAULT FALSE,
  resolved_by UUID REFERENCES users(id) ON DELETE SET NULL,
  resolved_at TIMESTAMP WITH TIME ZONE,
  resolution TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Ensure one flag per user per question
  UNIQUE(question_id, flagged_by)
);

-- Create indexes for performance
CREATE INDEX idx_question_flags_question_id ON question_flags(question_id);
CREATE INDEX idx_question_flags_flagged_by ON question_flags(flagged_by);
CREATE INDEX idx_question_flags_is_resolved ON question_flags(is_resolved);
CREATE INDEX idx_game_rounds_flagged ON game_rounds(flagged);
CREATE INDEX idx_game_rounds_flag_count ON game_rounds(flag_count);

-- Create function to update flag count
CREATE OR REPLACE FUNCTION update_question_flag_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE game_rounds 
    SET flag_count = (
      SELECT COUNT(*) 
      FROM question_flags 
      WHERE question_id = NEW.question_id AND is_resolved = FALSE
    )
    WHERE id = NEW.question_id;
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    UPDATE game_rounds 
    SET flag_count = (
      SELECT COUNT(*) 
      FROM question_flags 
      WHERE question_id = NEW.question_id AND is_resolved = FALSE
    )
    WHERE id = NEW.question_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE game_rounds 
    SET flag_count = (
      SELECT COUNT(*) 
      FROM question_flags 
      WHERE question_id = OLD.question_id AND is_resolved = FALSE
    )
    WHERE id = OLD.question_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update flag count
CREATE TRIGGER trigger_update_flag_count
  AFTER INSERT OR UPDATE OR DELETE ON question_flags
  FOR EACH ROW
  EXECUTE FUNCTION update_question_flag_count();

-- Create function to auto-flag questions after 3 flags
CREATE OR REPLACE FUNCTION auto_flag_question()
RETURNS TRIGGER AS $$
BEGIN
  -- Check if question has reached 3 flags
  IF (
    SELECT COUNT(*) 
    FROM question_flags 
    WHERE question_id = NEW.question_id AND is_resolved = FALSE
  ) >= 3 THEN
    
    UPDATE game_rounds 
    SET flagged = TRUE, flagged_at = NOW()
    WHERE id = NEW.question_id AND flagged = FALSE;
    
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-flag questions
CREATE TRIGGER trigger_auto_flag_question
  AFTER INSERT ON question_flags
  FOR EACH ROW
  EXECUTE FUNCTION auto_flag_question();

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updated_at
CREATE TRIGGER trigger_update_question_flags_updated_at
  BEFORE UPDATE ON question_flags
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column(); 
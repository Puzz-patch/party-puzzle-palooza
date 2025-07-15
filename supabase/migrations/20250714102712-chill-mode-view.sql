-- Create a view for mild questions when chill mode is enabled
CREATE OR REPLACE VIEW mild_questions AS
SELECT 
  gr.id,
  gr.game_id,
  gr.round_number,
  gr.type,
  gr.status,
  gr.question,
  gr.options,
  gr.correct_answer,
  gr.time_limit,
  gr.started_at,
  gr.ended_at,
  gr.round_data,
  gr.results,
  gr.revealed,
  gr.revealed_at,
  gr.archived,
  gr.archived_at,
  gr.flagged,
  gr.flagged_at,
  gr.flag_count,
  gr.created_by_id,
  gr.created_at,
  gr.updated_at,
  g.chill_mode,
  g.name as game_name,
  u.username as created_by_username
FROM game_rounds gr
JOIN games g ON gr.game_id = g.id
JOIN users u ON gr.created_by_id = u.id
WHERE g.chill_mode = true
  AND gr.flagged = false
  AND gr.flag_count = 0
  AND gr.status = 'pending';

-- Create an index to optimize the view performance
CREATE INDEX IF NOT EXISTS idx_game_rounds_chill_mode 
ON game_rounds(game_id, flagged, flag_count, status) 
WHERE flagged = false AND flag_count = 0 AND status = 'pending';

-- Create a function to get mild questions for a specific game
CREATE OR REPLACE FUNCTION get_mild_questions_for_game(game_uuid UUID)
RETURNS TABLE (
  id UUID,
  game_id UUID,
  round_number INTEGER,
  type TEXT,
  status TEXT,
  question TEXT,
  options JSONB,
  correct_answer TEXT,
  time_limit INTEGER,
  started_at TIMESTAMP WITH TIME ZONE,
  ended_at TIMESTAMP WITH TIME ZONE,
  round_data JSONB,
  results JSONB,
  revealed BOOLEAN,
  revealed_at TIMESTAMP WITH TIME ZONE,
  archived BOOLEAN,
  archived_at TIMESTAMP WITH TIME ZONE,
  flagged BOOLEAN,
  flagged_at TIMESTAMP WITH TIME ZONE,
  flag_count INTEGER,
  created_by_id UUID,
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE,
  chill_mode BOOLEAN,
  game_name TEXT,
  created_by_username TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    gr.id,
    gr.game_id,
    gr.round_number,
    gr.type,
    gr.status,
    gr.question,
    gr.options,
    gr.correct_answer,
    gr.time_limit,
    gr.started_at,
    gr.ended_at,
    gr.round_data,
    gr.results,
    gr.revealed,
    gr.revealed_at,
    gr.archived,
    gr.archived_at,
    gr.flagged,
    gr.flagged_at,
    gr.flag_count,
    gr.created_by_id,
    gr.created_at,
    gr.updated_at,
    g.chill_mode,
    g.name as game_name,
    u.username as created_by_username
  FROM game_rounds gr
  JOIN games g ON gr.game_id = g.id
  JOIN users u ON gr.created_by_id = u.id
  WHERE g.id = game_uuid
    AND g.chill_mode = true
    AND gr.flagged = false
    AND gr.flag_count = 0
    AND gr.status = 'pending'
  ORDER BY gr.round_number ASC;
END;
$$ LANGUAGE plpgsql;

-- Create a function to check if a game is in chill mode
CREATE OR REPLACE FUNCTION is_game_chill_mode(game_uuid UUID)
RETURNS BOOLEAN AS $$
DECLARE
  chill_mode BOOLEAN;
BEGIN
  SELECT g.chill_mode INTO chill_mode
  FROM games g
  WHERE g.id = game_uuid;
  
  RETURN COALESCE(chill_mode, false);
END;
$$ LANGUAGE plpgsql;

-- Add comment to the view
COMMENT ON VIEW mild_questions IS 'View for mild questions when chill mode is enabled - excludes flagged questions and only shows pending rounds';
COMMENT ON FUNCTION get_mild_questions_for_game(UUID) IS 'Get mild questions for a specific game in chill mode';
COMMENT ON FUNCTION is_game_chill_mode(UUID) IS 'Check if a game is in chill mode'; 
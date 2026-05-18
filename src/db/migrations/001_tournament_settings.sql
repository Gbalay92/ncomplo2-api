CREATE TABLE IF NOT EXISTS tournament_settings (
  id               BOOLEAN PRIMARY KEY DEFAULT true CHECK (id),
  group_stage_locked BOOLEAN NOT NULL DEFAULT false
);

INSERT INTO tournament_settings DEFAULT VALUES ON CONFLICT DO NOTHING;

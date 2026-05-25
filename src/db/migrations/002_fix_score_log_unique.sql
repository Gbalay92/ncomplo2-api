-- Migration 002: fix score_log unique constraint to include stage
--
-- The original constraint UNIQUE(user_id, event_type, event_ref) prevents the
-- same team from having classification entries across multiple knockout stages
-- (e.g. a team advancing to R16, QF, SF and Final would fail on the second round).
-- Adding stage makes each (user, classification, team, stage) combination unique.

ALTER TABLE score_log
  DROP CONSTRAINT IF EXISTS score_log_user_id_event_type_event_ref_key,
  ADD CONSTRAINT score_log_user_id_event_type_event_ref_stage_key
    UNIQUE (user_id, event_type, event_ref, stage);

-- Migration 002: Fix knockout bracket winner propagation
--
-- Problem: auto_fill_real_bracket trigger used plain UPDATE to propagate winners
-- to the next stage. But real_bracket only had rows for round_of_32 after
-- lockGroupStage, so updates to R16-Final slots silently did nothing.
--
-- Fix:
--   1. Update the trigger function to use INSERT ... ON CONFLICT DO UPDATE (upsert)
--      so it creates downstream rows if they don't exist.
--   2. Pre-insert empty real_bracket rows for all non-R32 stages so existing
--      locked tournaments are also covered.

-- Step 1: pre-insert empty rows for R16-Final slots (idempotent)
INSERT INTO real_bracket (slot_id)
SELECT id FROM knockout_slots WHERE stage <> 'round_of_32'
ON CONFLICT (slot_id) DO NOTHING;

-- Step 2: replace the trigger function with the upsert version
CREATE OR REPLACE FUNCTION auto_fill_real_bracket()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
    v_slot_label    TEXT;
    v_winner_id     UUID;
    v_old_winner_id UUID;
BEGIN
    IF NEW.real_winner_id IS NOT NULL THEN
        v_winner_id := NEW.real_winner_id;
    ELSIF NEW.real_home_goals IS NOT NULL AND NEW.real_away_goals IS NOT NULL THEN
        IF NEW.real_home_goals > NEW.real_away_goals THEN
            v_winner_id := NEW.home_team_id;
        ELSIF NEW.real_away_goals > NEW.real_home_goals THEN
            v_winner_id := NEW.away_team_id;
        ELSE
            RETURN NEW;
        END IF;
        NEW.real_winner_id := v_winner_id;
    ELSE
        RETURN NEW;
    END IF;

    SELECT slot_label INTO v_slot_label FROM knockout_slots WHERE id = NEW.slot_id;

    v_old_winner_id := OLD.real_winner_id;

    IF v_old_winner_id IS NOT NULL AND v_old_winner_id <> v_winner_id THEN
        PERFORM invalidate_bracket_cascade(v_slot_label, 'home');
        PERFORM invalidate_bracket_cascade(v_slot_label, 'away');
    END IF;

    -- Upsert: create the next-stage row if it doesn't exist yet, or update it if it does.
    INSERT INTO real_bracket (slot_id, home_team_id)
    SELECT ks.id, v_winner_id
    FROM knockout_slots ks
    WHERE ks.home_source = v_slot_label
    ON CONFLICT (slot_id) DO UPDATE
        SET home_team_id = v_winner_id, updated_at = now();

    INSERT INTO real_bracket (slot_id, away_team_id)
    SELECT ks.id, v_winner_id
    FROM knockout_slots ks
    WHERE ks.away_source = v_slot_label
    ON CONFLICT (slot_id) DO UPDATE
        SET away_team_id = v_winner_id, updated_at = now();

    RETURN NEW;
END;
$$;

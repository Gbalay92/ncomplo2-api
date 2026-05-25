-- ============================================================
--  World Cup 2026 Predictions App — PostgreSQL Schema
-- ============================================================
--
--  FLOW
--  1. User predicts scores for all 96 group-stage matches.
--  2. Backend derives the 32 qualified teams (top 2 per group +
--     8 best third-placed teams).
--  3. User picks winners round by round → predicted_bracket.
--  4. Admin enters real results → trigger auto-fills real_bracket
--     and invalidates downstream slots on correction.
--  5. Scoring via score_log (immutable events):
--       Group:        1pt sign / 3pt exact
--       Round of 32:  3pt per correct team (of 32)
--       Round of 16:  5pt per correct team (of 16)
--       Quarter-final: 10pt per correct team (of 8)
--       Semi-final:   17pt per correct team (of 4)
--       Final:        25pt per correct team (of 2)
--       Champion:     50pt
--
--  RESPONSIBILITIES
--  DB      → integrity, constraints, FKs, triggers, views
--  Node.js → all business logic (scoring, bracket derivation)
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── ENUMs ────────────────────────────────────────────────────
CREATE TYPE match_stage AS ENUM (
    'group',
    'round_of_32',
    'round_of_16',
    'quarter_final',
    'semi_final',
    'final'
);

CREATE TYPE group_letter AS ENUM (
    'A','B','C','D','E','F','G','H','I','J','K','L'
);

-- ============================================================
--  1. EMAIL WHITELIST
-- ============================================================
CREATE TABLE email_whitelist (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    email       TEXT        NOT NULL UNIQUE,
    invited_by  TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
--  2. USERS
-- ============================================================
CREATE TABLE users (
    id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    email         TEXT        NOT NULL UNIQUE,
    first_name    TEXT        NOT NULL,
    last_name     TEXT        NOT NULL,
    display_name  TEXT        NOT NULL,
    password_hash TEXT        NOT NULL,
    is_admin      BOOLEAN     NOT NULL DEFAULT false,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT fk_whitelist FOREIGN KEY (email)
        REFERENCES email_whitelist(email)
        ON UPDATE CASCADE ON DELETE RESTRICT
);

-- ============================================================
--  3. REFRESH TOKENS
-- ============================================================
CREATE TABLE refresh_tokens (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash  TEXT        NOT NULL UNIQUE,
    expires_at  TIMESTAMPTZ NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_refresh_tokens_user ON refresh_tokens(user_id);

-- ============================================================
--  4. TEAMS
-- ============================================================
CREATE TABLE teams (
    id       UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
    name     TEXT    NOT NULL UNIQUE,
    code     CHAR(3) NOT NULL UNIQUE,
    flag_url TEXT
);

-- ============================================================
--  5. GROUP MATCHES
-- ============================================================
CREATE TABLE group_matches (
    id           UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    match_number INT          NOT NULL UNIQUE,
    group_name   group_letter NOT NULL,
    match_date   TIMESTAMPTZ,
    home_team_id UUID         NOT NULL REFERENCES teams(id),
    away_team_id UUID         NOT NULL REFERENCES teams(id),

    real_home_goals INT CHECK (real_home_goals >= 0),
    real_away_goals INT CHECK (real_away_goals >= 0),

    is_locked    BOOLEAN     NOT NULL DEFAULT false,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT chk_different_teams CHECK (home_team_id <> away_team_id)
);

-- ============================================================
--  6. PREDICTIONS
-- ============================================================
CREATE TABLE predictions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id)         ON DELETE CASCADE,
    match_id        UUID NOT NULL REFERENCES group_matches(id) ON DELETE CASCADE,

    pred_home_goals INT NOT NULL CHECK (pred_home_goals >= 0),
    pred_away_goals INT NOT NULL CHECK (pred_away_goals >= 0),

    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),

    UNIQUE (user_id, match_id)
);

-- ============================================================
--  7. PREDICTED GROUP STANDINGS
-- ============================================================
CREATE TABLE predicted_group_standings (
    id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id       UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    team_id       UUID         NOT NULL REFERENCES teams(id),
    group_name    group_letter NOT NULL,
    position      INT          NOT NULL CHECK (position BETWEEN 1 AND 4),

    pred_points   INT NOT NULL DEFAULT 0,
    pred_gd       INT NOT NULL DEFAULT 0,
    pred_gf       INT NOT NULL DEFAULT 0,

    is_classified BOOLEAN NOT NULL DEFAULT false,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    UNIQUE (user_id, group_name, position)
);

-- ============================================================
--  8. KNOCKOUT SLOT DEFINITIONS
-- ============================================================
CREATE TABLE knockout_slots (
    id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    slot_label   TEXT        NOT NULL UNIQUE,
    stage        match_stage NOT NULL CHECK (stage <> 'group'),
    match_number INT         UNIQUE,
    match_date   TIMESTAMPTZ,
    home_source  TEXT        NOT NULL,
    away_source  TEXT        NOT NULL
);

-- ============================================================
--  9. PREDICTED BRACKET
-- ============================================================
CREATE TABLE predicted_bracket (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id        UUID NOT NULL REFERENCES users(id)          ON DELETE CASCADE,
    slot_id        UUID NOT NULL REFERENCES knockout_slots(id) ON DELETE CASCADE,

    home_team_id   UUID REFERENCES teams(id),
    away_team_id   UUID REFERENCES teams(id),
    pred_winner_id UUID REFERENCES teams(id),

    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),

    UNIQUE (user_id, slot_id)
);

-- ============================================================
--  10. REAL BRACKET
-- ============================================================
CREATE TABLE real_bracket (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slot_id         UUID NOT NULL UNIQUE REFERENCES knockout_slots(id) ON DELETE CASCADE,

    home_team_id    UUID REFERENCES teams(id),
    away_team_id    UUID REFERENCES teams(id),

    real_home_goals INT CHECK (real_home_goals >= 0),
    real_away_goals INT CHECK (real_away_goals >= 0),

    real_winner_id  UUID REFERENCES teams(id),

    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
--  11. SCORING RULES
-- ============================================================
CREATE TABLE scoring_rules (
    stage              match_stage PRIMARY KEY,
    points_sign        INT NOT NULL DEFAULT 0,
    points_exact       INT NOT NULL DEFAULT 0,
    points_classify    INT NOT NULL DEFAULT 0,
    points_champion    INT NOT NULL DEFAULT 0
);

INSERT INTO scoring_rules (stage, points_sign, points_exact, points_classify, points_champion) VALUES
    ('group',           2,  3,  0,  0),
    ('round_of_32',     0,  0,  5,  0),
    ('round_of_16',     0,  0, 10,  0),
    ('quarter_final',   0,  0, 15,  0),
    ('semi_final',      0,  0, 25,  0),
    ('final',           0,  0, 35, 50);

-- ============================================================
--  12. SCORE LOG
-- ============================================================
CREATE TABLE score_log (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    event_type  TEXT        NOT NULL CHECK (event_type IN ('group_match', 'classification', 'champion')),
    event_ref   TEXT        NOT NULL,
    stage       match_stage NOT NULL,
    points      INT         NOT NULL CHECK (points >= 0),
    scored_at   TIMESTAMPTZ NOT NULL DEFAULT now(),

    UNIQUE (user_id, event_type, event_ref, stage)
);

-- ============================================================
--  13. VIEWS
-- ============================================================
CREATE VIEW user_scores AS
SELECT
    u.id                                              AS user_id,
    u.display_name,
    COALESCE(SUM(sl.points), 0)                       AS total_points,
    COALESCE(SUM(sl.points) FILTER (WHERE sl.stage = 'group'), 0)
                                                      AS group_points,
    COALESCE(SUM(sl.points) FILTER (WHERE sl.stage <> 'group'), 0)
                                                      AS knockout_points
FROM users u
LEFT JOIN score_log sl ON sl.user_id = u.id
GROUP BY u.id, u.display_name;

CREATE VIEW leaderboard AS
SELECT
    us.user_id,
    us.display_name,
    us.total_points,
    us.group_points,
    us.knockout_points,
    RANK() OVER (ORDER BY us.total_points DESC) AS rank
FROM user_scores us
ORDER BY rank;

CREATE VIEW user_prediction_status AS
SELECT
    u.id AS user_id,
    u.display_name,
    COUNT(m.id)               AS total_group_matches,
    COUNT(p.id)               AS predictions_done,
    COUNT(m.id) = COUNT(p.id) AS all_predictions_complete
FROM users u
CROSS JOIN group_matches m
LEFT JOIN predictions p ON p.user_id = u.id AND p.match_id = m.id
GROUP BY u.id, u.display_name;

CREATE VIEW user_bracket_status AS
SELECT
    u.id AS user_id,
    u.display_name,
    COUNT(ks.id)                AS total_knockout_slots,
    COUNT(pb.id)                AS bracket_slots_filled,
    COUNT(ks.id) = COUNT(pb.id) AS bracket_complete
FROM users u
CROSS JOIN knockout_slots ks
LEFT JOIN predicted_bracket pb ON pb.user_id = u.id AND pb.slot_id = ks.id
GROUP BY u.id, u.display_name;

CREATE VIEW real_bracket_progress AS
SELECT
    ks.stage,
    ks.slot_label,
    ks.match_number,
    ks.match_date,
    ht.name AS home_team,
    at.name AS away_team,
    rb.real_home_goals,
    rb.real_away_goals,
    wt.name AS real_winner,
    rb.real_winner_id IS NOT NULL AS result_confirmed
FROM knockout_slots ks
JOIN  real_bracket rb ON rb.slot_id = ks.id
LEFT JOIN teams ht    ON ht.id = rb.home_team_id
LEFT JOIN teams at    ON at.id = rb.away_team_id
LEFT JOIN teams wt    ON wt.id = rb.real_winner_id
ORDER BY ks.stage, ks.slot_label;

-- ============================================================
--  14. INDEXES
-- ============================================================
CREATE INDEX idx_group_matches_group  ON group_matches(group_name);
CREATE INDEX idx_predictions_user     ON predictions(user_id);
CREATE INDEX idx_predictions_match    ON predictions(match_id);
CREATE INDEX idx_standings_user       ON predicted_group_standings(user_id);
CREATE INDEX idx_standings_group      ON predicted_group_standings(group_name);
CREATE INDEX idx_pred_bracket_user    ON predicted_bracket(user_id);
CREATE INDEX idx_pred_bracket_slot    ON predicted_bracket(slot_id);
CREATE INDEX idx_real_bracket_slot    ON real_bracket(slot_id);
CREATE INDEX idx_knockout_slots_stage ON knockout_slots(stage);
CREATE INDEX idx_score_log_user       ON score_log(user_id);
CREATE INDEX idx_score_log_event      ON score_log(event_type, event_ref);

-- ============================================================
--  15. TRIGGER updated_at
-- ============================================================
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER trg_group_matches_updated
    BEFORE UPDATE ON group_matches
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_predictions_updated
    BEFORE UPDATE ON predictions
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_pred_bracket_updated
    BEFORE UPDATE ON predicted_bracket
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_real_bracket_updated
    BEFORE UPDATE ON real_bracket
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
--  16. TRIGGER — AUTO-FILL REAL BRACKET (with cascade invalidation)
-- ============================================================
CREATE OR REPLACE FUNCTION invalidate_bracket_cascade(p_slot_label TEXT, p_side TEXT)
RETURNS VOID LANGUAGE plpgsql AS $$
DECLARE
    v_next_slot_id    UUID;
    v_next_slot_label TEXT;
    v_next_stage      match_stage;
BEGIN
    IF p_side = 'home' THEN
        SELECT ks.id, ks.slot_label, ks.stage
        INTO v_next_slot_id, v_next_slot_label, v_next_stage
        FROM knockout_slots ks
        WHERE ks.home_source = p_slot_label
        LIMIT 1;
    ELSE
        SELECT ks.id, ks.slot_label, ks.stage
        INTO v_next_slot_id, v_next_slot_label, v_next_stage
        FROM knockout_slots ks
        WHERE ks.away_source = p_slot_label
        LIMIT 1;
    END IF;

    IF v_next_slot_id IS NULL THEN RETURN; END IF;

    IF p_side = 'home' THEN
        UPDATE real_bracket
        SET home_team_id = NULL, real_home_goals = NULL, real_away_goals = NULL,
            real_winner_id = NULL, updated_at = now()
        WHERE slot_id = v_next_slot_id;
    ELSE
        UPDATE real_bracket
        SET away_team_id = NULL, real_home_goals = NULL, real_away_goals = NULL,
            real_winner_id = NULL, updated_at = now()
        WHERE slot_id = v_next_slot_id;
    END IF;

    DELETE FROM score_log
    WHERE event_type IN ('classification', 'champion')
      AND event_ref = v_next_stage::text;

    PERFORM invalidate_bracket_cascade(v_next_slot_label, 'home');
    PERFORM invalidate_bracket_cascade(v_next_slot_label, 'away');
END;
$$;

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

    UPDATE real_bracket rb
    SET home_team_id = v_winner_id, updated_at = now()
    FROM knockout_slots ks
    WHERE rb.slot_id = ks.id AND ks.home_source = v_slot_label;

    UPDATE real_bracket rb
    SET away_team_id = v_winner_id, updated_at = now()
    FROM knockout_slots ks
    WHERE rb.slot_id = ks.id AND ks.away_source = v_slot_label;

    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_auto_fill_real_bracket
    BEFORE INSERT OR UPDATE OF real_home_goals, real_away_goals, real_winner_id
    ON real_bracket
    FOR EACH ROW EXECUTE FUNCTION auto_fill_real_bracket();

-- ============================================================
--  17. SEED DATA
-- ============================================================
INSERT INTO email_whitelist (email, invited_by) VALUES
    ('admin@example.com', 'system');

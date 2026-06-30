import pool from '../db/pool.js'
import { getUserQualifiers } from '../services/tournament.service.js'

async function assertLocked(res) {
  const { rows } = await pool.query('SELECT predictions_locked FROM tournament_settings WHERE id = true')
  if (!rows[0]?.predictions_locked) {
    res.status(403).json({ error: 'Predictions are not locked yet' })
    return false
  }
  return true
}

const matchFields = `
  m.id, m.match_number, m.group_name, m.match_date,
  m.real_home_goals, m.real_away_goals,
  ht.name AS home_team, ht.flag_url AS home_flag,
  at.name AS away_team, at.flag_url AS away_flag,
  p.pred_home_goals, p.pred_away_goals
`
const matchJoins = `
  FROM group_matches m
  JOIN teams ht ON ht.id = m.home_team_id
  JOIN teams at ON at.id = m.away_team_id
  LEFT JOIN predictions p ON p.match_id = m.id AND p.user_id = $1
`

// Union of group-stage match predictions (score-based) and knockout predictions
// (winner-based) into a single shape so "today / next match" works post-group-stage.
const allMatchesQuery = `
  SELECT
    m.id, m.match_number, m.group_name::TEXT AS group_name, m.match_date,
    m.real_home_goals, m.real_away_goals,
    ht.name AS home_team, ht.flag_url AS home_flag,
    at.name AS away_team, at.flag_url AS away_flag,
    p.pred_home_goals, p.pred_away_goals,
    NULL::uuid AS pred_winner_id, NULL::TEXT AS pred_winner_name, NULL::TEXT AS pred_winner_flag,
    FALSE AS is_knockout
  FROM group_matches m
  JOIN teams ht ON ht.id = m.home_team_id
  JOIN teams at ON at.id = m.away_team_id
  LEFT JOIN predictions p ON p.match_id = m.id AND p.user_id = $1
  UNION ALL
  SELECT
    ks.id, ks.match_number, ks.stage::TEXT AS group_name, ks.match_date,
    rb.real_home_goals, rb.real_away_goals,
    ht.name AS home_team, ht.flag_url AS home_flag,
    at.name AS away_team, at.flag_url AS away_flag,
    NULL::INTEGER AS pred_home_goals, NULL::INTEGER AS pred_away_goals,
    pb.pred_winner_id, wt.name AS pred_winner_name, wt.flag_url AS pred_winner_flag,
    TRUE AS is_knockout
  FROM knockout_slots ks
  LEFT JOIN real_bracket rb ON rb.slot_id = ks.id
  LEFT JOIN teams ht ON ht.id = rb.home_team_id
  LEFT JOIN teams at ON at.id = rb.away_team_id
  LEFT JOIN predicted_bracket pb ON pb.slot_id = ks.id AND pb.user_id = $1
  LEFT JOIN teams wt ON wt.id = pb.pred_winner_id
`

export async function getUserTodayPredictions(req, res) {
  if (!await assertLocked(res)) return
  const { userId } = req.params

  const { from, to } = req.query
  const todayQuery = from && to
    ? `SELECT * FROM (${allMatchesQuery}) matches WHERE match_date >= $2 AND match_date < $3 ORDER BY match_date`
    : `SELECT * FROM (${allMatchesQuery}) matches WHERE DATE(match_date AT TIME ZONE 'UTC') = CURRENT_DATE ORDER BY match_date`
  const { rows: today } = await pool.query(todayQuery, from && to ? [userId, from, to] : [userId])

  if (today.length) return res.json(today)

  const { rows: next } = await pool.query(`
    SELECT * FROM (${allMatchesQuery}) matches
    WHERE match_date > now()
    ORDER BY match_date
    LIMIT 1
  `, [userId])

  res.json(next)
}

export async function getUserPredictions(req, res) {
  if (!await assertLocked(res)) return
  const { userId } = req.params

  const { rows } = await pool.query(`
    SELECT ${matchFields} ${matchJoins}
    ORDER BY m.group_name, m.match_number
  `, [userId])
  res.json(rows)
}

export async function getUserQualifiersHandler(req, res) {
  if (!await assertLocked(res)) return
  const { userId } = req.params
  const qualifiers = await getUserQualifiers(userId)
  res.json(qualifiers)
}

export async function getUserBracket(req, res) {
  if (!await assertLocked(res)) return
  const { userId } = req.params

  const { rows } = await pool.query(`
    SELECT ks.id AS slot_id, ks.slot_label, ks.stage, ks.match_number,
           ks.home_source, ks.away_source,
           pb.pred_winner_id,
           t.name AS pred_winner_name, t.flag_url AS pred_winner_flag
    FROM knockout_slots ks
    LEFT JOIN predicted_bracket pb ON pb.slot_id = ks.id AND pb.user_id = $1
    LEFT JOIN teams t ON t.id = pb.pred_winner_id
    ORDER BY ks.stage, ks.match_number
  `, [userId])
  res.json(rows)
}


export async function getUserProfile(req, res) {
  const { userId } = req.params
  const { rows } = await pool.query(
    'SELECT display_name, first_name, last_name FROM users WHERE id = $1',
    [userId]
  )
  if (!rows[0]) return res.status(404).json({ error: 'User not found' })
  res.json(rows[0])
}

import pool from '../db/pool.js'

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

export async function getUserTodayPredictions(req, res) {
  if (!await assertLocked(res)) return
  const { userId } = req.params

  const { from, to } = req.query
  const todayQuery = from && to
    ? `SELECT ${matchFields} ${matchJoins} WHERE m.match_date >= $2 AND m.match_date < $3 ORDER BY m.match_date`
    : `SELECT ${matchFields} ${matchJoins} WHERE DATE(m.match_date AT TIME ZONE 'UTC') = CURRENT_DATE ORDER BY m.match_date`
  const { rows: today } = await pool.query(todayQuery, from && to ? [userId, from, to] : [userId])

  if (today.length) return res.json(today)

  const { rows: next } = await pool.query(`
    SELECT ${matchFields} ${matchJoins}
    WHERE m.match_date > now()
    ORDER BY m.match_date
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

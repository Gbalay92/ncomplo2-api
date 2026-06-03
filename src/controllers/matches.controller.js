import pool from '../db/pool.js'

export async function getMatches(req, res) {
  const { group, phase = 'group' } = req.query

  if (phase === 'group') {
    let query = `
      SELECT
        m.id, m.match_number, m.group_name, m.match_date,
        m.real_home_goals, m.real_away_goals, m.is_locked,
        ht.id AS home_team_id, ht.name AS home_team, ht.code AS home_code, ht.flag_url AS home_flag,
        at.id AS away_team_id, at.name AS away_team, at.code AS away_code, at.flag_url AS away_flag
      FROM group_matches m
      JOIN teams ht ON ht.id = m.home_team_id
      JOIN teams at ON at.id = m.away_team_id
    `
    const params = []
    if (group) {
      params.push(group.toUpperCase())
      query += ` WHERE m.group_name = $1`
    }
    query += ` ORDER BY m.group_name, m.match_number`

    const { rows } = await pool.query(query, params)
    return res.json(rows)
  }

  const { rows } = await pool.query(`
    SELECT
      ks.id AS slot_id, ks.slot_label, ks.stage,
      ks.match_number, ks.match_date,
      rb.real_home_goals, rb.real_away_goals,
      ht.name AS home_team, ht.flag_url AS home_flag,
      at.name AS away_team, at.flag_url AS away_flag,
      wt.name AS winner
    FROM knockout_slots ks
    LEFT JOIN real_bracket rb ON rb.slot_id = ks.id
    LEFT JOIN teams ht ON ht.id = rb.home_team_id
    LEFT JOIN teams at ON at.id = rb.away_team_id
    LEFT JOIN teams wt ON wt.id = rb.real_winner_id
    ORDER BY ks.stage, ks.slot_label
  `)
  res.json(rows)
}

export async function getTodayMatches(req, res) {
  const allMatchesQuery = `
    SELECT
      m.id, m.match_number, m.group_name, m.match_date,
      m.real_home_goals, m.real_away_goals,
      ht.name AS home_team, ht.flag_url AS home_flag,
      at.name AS away_team, at.flag_url AS away_flag
    FROM group_matches m
    JOIN teams ht ON ht.id = m.home_team_id
    JOIN teams at ON at.id = m.away_team_id
    UNION ALL
    SELECT
      ks.id, ks.match_number, ks.stage AS group_name, ks.match_date,
      rb.real_home_goals, rb.real_away_goals,
      ht.name AS home_team, ht.flag_url AS home_flag,
      at.name AS away_team, at.flag_url AS away_flag
    FROM knockout_slots ks
    LEFT JOIN real_bracket rb ON rb.slot_id = ks.id
    LEFT JOIN teams ht ON ht.id = rb.home_team_id
    LEFT JOIN teams at ON at.id = rb.away_team_id
  `

  const { rows: today } = await pool.query(`
    SELECT * FROM (${allMatchesQuery}) matches
    WHERE DATE(match_date AT TIME ZONE 'UTC') = CURRENT_DATE
    ORDER BY match_date
  `)

  if (today.length) return res.json({ matches: today, isToday: true })

  const { rows: next } = await pool.query(`
    SELECT * FROM (${allMatchesQuery}) matches
    WHERE match_date > now() AND real_home_goals IS NULL
    ORDER BY match_date
    LIMIT 1
  `)

  res.json({ matches: next, isToday: false })
}

export async function getNextMatch(req, res) {
  const { rows } = await pool.query(`
    SELECT
      m.id, m.match_number, m.group_name, m.match_date,
      ht.name AS home_team, ht.flag_url AS home_flag,
      at.name AS away_team, at.flag_url AS away_flag
    FROM group_matches m
    JOIN teams ht ON ht.id = m.home_team_id
    JOIN teams at ON at.id = m.away_team_id
    WHERE m.match_date > now() AND m.real_home_goals IS NULL
    ORDER BY m.match_date
    LIMIT 1
  `)
  res.json(rows[0] ?? null)
}

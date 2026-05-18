import pool from '../db/pool.js'
import { deriveUserGroupOnly, deriveUserStandings } from '../services/tournament.service.js'

export async function getMyPredictions(req, res) {
  const { rows } = await pool.query(`
    SELECT
      p.id, p.match_id, p.pred_home_goals, p.pred_away_goals,
      m.group_name, m.match_number, m.match_date,
      ht.name AS home_team, at.name AS away_team
    FROM predictions p
    JOIN group_matches m ON m.id = p.match_id
    JOIN teams ht ON ht.id = m.home_team_id
    JOIN teams at ON at.id = m.away_team_id
    WHERE p.user_id = $1
    ORDER BY m.group_name, m.match_number
  `, [req.user.sub])
  res.json(rows)
}

export async function upsertPrediction(req, res) {
  const { match_id, pred_home_goals, pred_away_goals } = req.body
  if (match_id == null || pred_home_goals == null || pred_away_goals == null) {
    return res.status(400).json({ error: 'match_id, pred_home_goals, and pred_away_goals are required' })
  }

  const { rows: match } = await pool.query(
    'SELECT is_locked FROM group_matches WHERE id = $1', [match_id]
  )
  if (!match.length) return res.status(404).json({ error: 'Match not found' })
  if (match[0].is_locked) return res.status(409).json({ error: 'Match is locked for predictions' })

  const { rows: matchInfo } = await pool.query(
    'SELECT group_name FROM group_matches WHERE id = $1', [match_id]
  )

  const { rows } = await pool.query(`
    INSERT INTO predictions (user_id, match_id, pred_home_goals, pred_away_goals)
    VALUES ($1, $2, $3, $4)
    ON CONFLICT (user_id, match_id)
    DO UPDATE SET pred_home_goals = $3, pred_away_goals = $4, updated_at = now()
    RETURNING *
  `, [req.user.sub, match_id, pred_home_goals, pred_away_goals])

  // Recalculate predicted standings for just this group
  await deriveUserGroupOnly(req.user.sub, matchInfo[0].group_name)

  res.json(rows[0])
}

export async function upsertManyPredictions(req, res) {
  const { predictions } = req.body
  if (!Array.isArray(predictions) || !predictions.length) {
    return res.status(400).json({ error: 'predictions must be a non-empty array' })
  }

  const { rows: settings } = await pool.query('SELECT predictions_locked FROM tournament_settings WHERE id = true')
  if (settings[0]?.predictions_locked) {
    return res.status(409).json({ error: 'Predictions are locked' })
  }

  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const results = []

    for (const { match_id, pred_home_goals, pred_away_goals } of predictions) {
      const { rows: match } = await client.query(
        'SELECT is_locked FROM group_matches WHERE id = $1', [match_id]
      )
      if (!match.length || match[0].is_locked) continue

      const { rows } = await client.query(`
        INSERT INTO predictions (user_id, match_id, pred_home_goals, pred_away_goals)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (user_id, match_id)
        DO UPDATE SET pred_home_goals = $3, pred_away_goals = $4, updated_at = now()
        RETURNING id, match_id, pred_home_goals, pred_away_goals
      `, [req.user.sub, match_id, pred_home_goals, pred_away_goals])
      results.push(rows[0])
    }

    await client.query('COMMIT')

    // Recalculate predicted standings after saving bulk predictions
    await deriveUserStandings(req.user.sub)

    res.json(results)
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
}

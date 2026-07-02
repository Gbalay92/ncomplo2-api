import pool from '../db/pool.js'
import { getUserQualifiers } from '../services/tournament.service.js'

export async function getMyQualifiers(req, res) {
  const qualifiers = await getUserQualifiers(req.user.sub)
  res.json(qualifiers)
}

export async function getMyKnockoutScore(req, res) {
  const { rows } = await pool.query(`
    SELECT stage, COALESCE(SUM(points), 0) AS points
    FROM score_log
    WHERE user_id = $1 AND event_type IN ('classification', 'champion')
    GROUP BY stage
  `, [req.user.sub])

  const result = {}
  for (const row of rows) result[row.stage] = Number(row.points)
  res.json(result)
}

// Returns ALL knockout slots with the user's picks (null pred_winner_id if not picked)
export async function getMyBracket(req, res) {
  const { rows } = await pool.query(`
    SELECT ks.id AS slot_id, ks.slot_label, ks.stage, ks.match_number,
           ks.home_source, ks.away_source,
           pb.pred_winner_id,
           t.name AS pred_winner_name, t.code AS pred_winner_code, t.flag_url AS pred_winner_flag
    FROM knockout_slots ks
    LEFT JOIN predicted_bracket pb ON pb.slot_id = ks.id AND pb.user_id = $1
    LEFT JOIN teams t ON t.id = pb.pred_winner_id
    ORDER BY ks.stage, ks.match_number
  `, [req.user.sub])
  res.json(rows)
}

// Full replacement: deletes all user picks then inserts the new ones in a transaction
export async function saveMyBracket(req, res) {
  const { picks } = req.body
  if (!Array.isArray(picks)) {
    return res.status(400).json({ error: 'picks must be an array of { slot_id, pred_winner_id }' })
  }

  const { rows: settings } = await pool.query('SELECT predictions_locked FROM tournament_settings WHERE id = true')
  if (settings[0]?.predictions_locked) {
    return res.status(409).json({ error: 'Predictions are locked' })
  }

  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    await client.query('DELETE FROM predicted_bracket WHERE user_id = $1', [req.user.sub])

    // Deduplicate picks by slot_id (last write wins) to avoid duplicate key on repeated slots
    const uniquePicks = Object.values(
      picks.reduce((acc, p) => { if (p.slot_id && p.pred_winner_id) acc[p.slot_id] = p; return acc; }, {})
    )

    const results = []
    for (const { slot_id, pred_winner_id } of uniquePicks) {
      const { rows } = await client.query(`
        INSERT INTO predicted_bracket (user_id, slot_id, pred_winner_id)
        VALUES ($1, $2, $3)
        ON CONFLICT (user_id, slot_id) DO UPDATE SET pred_winner_id = EXCLUDED.pred_winner_id, updated_at = now()
        RETURNING slot_id, pred_winner_id
      `, [req.user.sub, slot_id, pred_winner_id])
      results.push(rows[0])
    }

    await client.query('COMMIT')
    res.json(results)
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
}

import pool from '../db/pool.js'
import { getUserQualifiers } from '../services/tournament.service.js'

// Returns the user's 32 predicted qualifiers (must have submitted group predictions first)
export async function getMyQualifiers(req, res) {
  const qualifiers = await getUserQualifiers(req.user.sub)
  res.json(qualifiers)
}

// Returns the user's full predicted bracket
export async function getMyBracket(req, res) {
  const { rows } = await pool.query(`
    SELECT pb.slot_id, pb.pred_winner_id,
           ks.slot_label, ks.stage, ks.match_number,
           ks.home_source, ks.away_source,
           t.name AS pred_winner_name, t.code AS pred_winner_code, t.flag_url AS pred_winner_flag
    FROM predicted_bracket pb
    JOIN knockout_slots ks ON ks.id = pb.slot_id
    LEFT JOIN teams t ON t.id = pb.pred_winner_id
    WHERE pb.user_id = $1
    ORDER BY ks.stage, ks.match_number
  `, [req.user.sub])
  res.json(rows)
}

// Saves/updates the user's full predicted bracket (array of slot picks)
export async function saveMyBracket(req, res) {
  const { picks } = req.body
  if (!Array.isArray(picks) || !picks.length) {
    return res.status(400).json({ error: 'picks must be a non-empty array of { slot_id, pred_winner_id }' })
  }

  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const results = []

    for (const { slot_id, pred_winner_id } of picks) {
      if (!slot_id || !pred_winner_id) continue

      const { rows } = await client.query(`
        INSERT INTO predicted_bracket (user_id, slot_id, pred_winner_id)
        VALUES ($1, $2, $3)
        ON CONFLICT (user_id, slot_id)
        DO UPDATE SET pred_winner_id = $3, updated_at = now()
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

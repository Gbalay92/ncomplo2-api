import pool from '../db/pool.js'
import { getUserQualifiers } from '../services/tournament.service.js'

export async function getMyQualifiers(req, res) {
  const qualifiers = await getUserQualifiers(req.user.sub)
  res.json(qualifiers)
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

  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    await client.query('DELETE FROM predicted_bracket WHERE user_id = $1', [req.user.sub])

    const results = []
    for (const { slot_id, pred_winner_id } of picks) {
      if (!slot_id || !pred_winner_id) continue
      const { rows } = await client.query(`
        INSERT INTO predicted_bracket (user_id, slot_id, pred_winner_id)
        VALUES ($1, $2, $3)
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

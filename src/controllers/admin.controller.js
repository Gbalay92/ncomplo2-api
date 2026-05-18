import pool from '../db/pool.js'
import { scoreGroupMatch, scoreKnockoutRound, scoreChampion, isStageComplete } from '../services/scoring.service.js'
import { getRealQualifiersMap } from '../services/tournament.service.js'

export async function setGroupMatchResult(req, res) {
  const { id } = req.params
  const { home_goals, away_goals } = req.body

  if (home_goals == null || away_goals == null || home_goals < 0 || away_goals < 0) {
    return res.status(400).json({ error: 'home_goals and away_goals must be non-negative integers' })
  }

  const { rows } = await pool.query(
    `UPDATE group_matches
     SET real_home_goals = $1, real_away_goals = $2, is_locked = true, updated_at = now()
     WHERE id = $3
     RETURNING *`,
    [home_goals, away_goals, id]
  )
  if (!rows.length) return res.status(404).json({ error: 'Match not found' })

  // Recalculate scores for all users on this match
  await scoreGroupMatch(id)

  res.json(rows[0])
}

export async function setKnockoutResult(req, res) {
  const { slot_id } = req.params
  const { home_goals, away_goals, winner_id = null } = req.body

  if (home_goals == null || away_goals == null || home_goals < 0 || away_goals < 0) {
    return res.status(400).json({ error: 'home_goals and away_goals must be non-negative integers' })
  }

  // winner_id is required when it's a draw (penalties)
  if (home_goals === away_goals && !winner_id) {
    return res.status(400).json({ error: 'winner_id is required when the match ends in a draw (penalties)' })
  }

  const { rows } = await pool.query(
    `UPDATE real_bracket
     SET real_home_goals = $1, real_away_goals = $2, real_winner_id = $3, updated_at = now()
     WHERE slot_id = $4
     RETURNING *, (SELECT stage FROM knockout_slots WHERE id = slot_id) AS stage`,
    [home_goals, away_goals, winner_id, slot_id]
  )
  if (!rows.length) return res.status(404).json({ error: 'Bracket slot not found' })

  const { stage } = rows[0]

  // If all matches in this stage are done, score the round
  if (await isStageComplete(stage)) {
    await scoreKnockoutRound(stage)
    if (stage === 'final') {
      await scoreChampion()
    }
  }

  res.json(rows[0])
}

// Locks the group stage: derives real standings, seeds round-of-32 matchups
export async function lockGroupStage(req, res) {
  // Verify all 96 group matches have results
  const { rows: pending } = await pool.query(`
    SELECT COUNT(*) AS count FROM group_matches
    WHERE real_home_goals IS NULL OR real_away_goals IS NULL
  `)
  if (parseInt(pending[0].count) > 0) {
    return res.status(409).json({
      error: `${pending[0].count} group match(es) still missing results`
    })
  }

  // Build position-label → team_id map  (e.g. '1A' → uuid, '3rd_1' → uuid)
  const qualifiers = await getRealQualifiersMap()

  // Seed real_bracket for round_of_32 slots based on knockout_slots wiring
  const { rows: r32Slots } = await pool.query(
    "SELECT id, slot_label, home_source, away_source FROM knockout_slots WHERE stage = 'round_of_32'"
  )

  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    for (const slot of r32Slots) {
      const homeId = qualifiers[slot.home_source] ?? null
      const awayId = qualifiers[slot.away_source] ?? null

      await client.query(`
        INSERT INTO real_bracket (slot_id, home_team_id, away_team_id)
        VALUES ($1, $2, $3)
        ON CONFLICT (slot_id)
        DO UPDATE SET home_team_id = $2, away_team_id = $3, updated_at = now()
      `, [slot.id, homeId, awayId])
    }

    await client.query('COMMIT')
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }

  await pool.query(`UPDATE tournament_settings SET group_stage_locked = true WHERE id = true`)

  res.json({ message: 'Group stage locked. Round of 32 matchups seeded.', qualifiers })
}

// Whitelist management
export async function addToWhitelist(req, res) {
  const { email } = req.body
  if (!email) return res.status(400).json({ error: 'email is required' })

  const { rows } = await pool.query(
    `INSERT INTO email_whitelist (email, invited_by)
     VALUES ($1, $2)
     ON CONFLICT (email) DO NOTHING
     RETURNING *`,
    [email, req.user.display_name]
  )

  if (!rows.length) return res.status(409).json({ error: 'Email already whitelisted' })
  res.status(201).json(rows[0])
}

export async function removeFromWhitelist(req, res) {
  const { email } = req.params

  const { rows: users } = await pool.query('SELECT 1 FROM users WHERE email = $1', [email])
  if (users.length) {
    return res.status(409).json({ error: 'Cannot remove: user already registered with this email' })
  }

  await pool.query('DELETE FROM email_whitelist WHERE email = $1', [email])
  res.json({ message: 'Removed from whitelist' })
}

export async function getWhitelist(req, res) {
  const { rows } = await pool.query(
    'SELECT id, email, invited_by, created_at FROM email_whitelist ORDER BY created_at DESC'
  )
  res.json(rows)
}

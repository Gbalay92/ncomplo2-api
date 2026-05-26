import pool from '../db/pool.js'
import { scoreGroupMatch, scoreGroupQualification, scoreKnockoutAdvancement, scoreChampion } from '../services/scoring.service.js'
import { getRealQualifiersMap } from '../services/tournament.service.js'
import { NEXT_STAGE } from '../services/scoring.utils.js'

/**
 * Factory that returns admin controller handlers bound to the given db pool and
 * scoring functions. Useful for dependency injection in tests.
 *
 * In production code the module-level exports (bottom of file) use the real pool
 * and scoring service, so routes don't need to change.
 */
export function makeAdminController(
  db = pool,
  scoring = { scoreGroupMatch, scoreGroupQualification, scoreKnockoutAdvancement, scoreChampion },
  tournament = { getRealQualifiersMap }
) {
  return {

    async setGroupMatchResult(req, res) {
      const { id } = req.params
      const { home_goals, away_goals, current_updated_at } = req.body

      if (home_goals == null || away_goals == null || home_goals < 0 || away_goals < 0) {
        return res.status(400).json({ error: 'home_goals and away_goals must be non-negative integers' })
      }

      // Optimistic locking: if the client sends current_updated_at, only apply the
      // update when the row hasn't changed since the client last read it.
      const useLock = current_updated_at != null
      const { rows } = await db.query(
        useLock
          ? `UPDATE group_matches
             SET real_home_goals = $1, real_away_goals = $2, is_locked = true, updated_at = now()
             WHERE id = $3 AND updated_at = $4
             RETURNING *`
          : `UPDATE group_matches
             SET real_home_goals = $1, real_away_goals = $2, is_locked = true, updated_at = now()
             WHERE id = $3
             RETURNING *`,
        useLock ? [home_goals, away_goals, id, current_updated_at] : [home_goals, away_goals, id]
      )

      if (!rows.length) {
        if (useLock) {
          // Row exists but timestamp didn't match → concurrent modification
          const { rows: exists } = await db.query(
            'SELECT id FROM group_matches WHERE id = $1', [id]
          )
          if (exists.length) {
            return res.status(409).json({
              error: 'Match was modified by another admin. Please reload and try again.',
            })
          }
        }
        return res.status(404).json({ error: 'Match not found' })
      }

      await scoring.scoreGroupMatch(id)

      res.json(rows[0])
    },

    async setKnockoutResult(req, res) {
      const { slot_id } = req.params
      const { home_goals, away_goals, winner_id = null, current_updated_at } = req.body

      if (home_goals == null || away_goals == null || home_goals < 0 || away_goals < 0) {
        return res.status(400).json({ error: 'home_goals and away_goals must be non-negative integers' })
      }

      // No draw validation: 1-1 without winner_id is allowed for live in-progress scores.
      // Scoring only triggers once winner_id is provided (final result or penalty winner).

      const useLock = current_updated_at != null
      const { rows } = await db.query(
        useLock
          ? `WITH prev AS (SELECT real_winner_id FROM real_bracket WHERE slot_id = $4)
             UPDATE real_bracket
             SET real_home_goals = $1, real_away_goals = $2, real_winner_id = $3, updated_at = now()
             WHERE slot_id = $4 AND updated_at = $5
             RETURNING *,
               (SELECT real_winner_id FROM prev) AS prev_winner_id,
               (SELECT stage FROM knockout_slots WHERE id = slot_id) AS stage`
          : `WITH prev AS (SELECT real_winner_id FROM real_bracket WHERE slot_id = $4)
             UPDATE real_bracket
             SET real_home_goals = $1, real_away_goals = $2, real_winner_id = $3, updated_at = now()
             WHERE slot_id = $4
             RETURNING *,
               (SELECT real_winner_id FROM prev) AS prev_winner_id,
               (SELECT stage FROM knockout_slots WHERE id = slot_id) AS stage`,
        useLock
          ? [home_goals, away_goals, winner_id, slot_id, current_updated_at]
          : [home_goals, away_goals, winner_id, slot_id]
      )

      if (!rows.length) {
        if (useLock) {
          const { rows: exists } = await db.query(
            'SELECT slot_id FROM real_bracket WHERE slot_id = $1', [slot_id]
          )
          if (exists.length) {
            return res.status(409).json({
              error: 'Bracket slot was modified by another admin. Please reload and try again.',
            })
          }
        }
        return res.status(404).json({ error: 'Bracket slot not found' })
      }

      // Use the DB-stored real_winner_id: for non-draws the trigger derives it from goals,
      // so winner_id from req.body is null but real_winner_id is already set in the row.
      const { stage, prev_winner_id, real_winner_id: effectiveWinnerId } = rows[0]
      const nextStage = NEXT_STAGE[stage]

      // Score advancement — handles all live-update cases:
      //   winner unchanged  → idempotent (delete + re-insert same team)
      //   winner changed    → deletes prev team entries, inserts new team
      //   winner now null   → deletes prev team entries, nothing inserted
      if (nextStage && (effectiveWinnerId || prev_winner_id)) {
        await scoring.scoreKnockoutAdvancement(effectiveWinnerId, nextStage, prev_winner_id)
      }

      // After the final: also score champion
      if (stage === 'final' && effectiveWinnerId) {
        await scoring.scoreChampion()
      }

      res.json(rows[0])
    },

    async getAdminBracket(req, res) {
      const { rows } = await db.query(`
        SELECT
          ks.id           AS slot_id,
          ks.slot_label,
          ks.stage,
          ks.match_number,
          ks.match_date,
          rb.id           AS real_bracket_id,
          ht.id           AS home_team_id,
          ht.name         AS home_team_name,
          ht.flag_url     AS home_team_flag,
          at.id           AS away_team_id,
          at.name         AS away_team_name,
          at.flag_url     AS away_team_flag,
          rb.real_home_goals,
          rb.real_away_goals,
          rb.real_winner_id,
          wt.name         AS real_winner_name
        FROM knockout_slots ks
        LEFT JOIN real_bracket rb ON rb.slot_id = ks.id
        LEFT JOIN teams ht ON ht.id = rb.home_team_id
        LEFT JOIN teams at ON at.id = rb.away_team_id
        LEFT JOIN teams wt ON wt.id = rb.real_winner_id
        ORDER BY ks.stage, ks.match_number
      `)
      res.json(rows)
    },

    async lockPredictions(req, res) {
      await db.query(`UPDATE tournament_settings SET predictions_locked = true WHERE id = true`)
      res.json({ message: 'Predictions locked.' })
    },

    // Locks the group stage: derives real standings, seeds round-of-32 matchups
    async lockGroupStage(req, res) {
      const { rows: pending } = await db.query(`
        SELECT COUNT(*) AS count FROM group_matches
        WHERE real_home_goals IS NULL OR real_away_goals IS NULL
      `)
      if (parseInt(pending[0].count) > 0) {
        return res.status(409).json({
          error: `${pending[0].count} group match(es) still missing results`
        })
      }

      const qualifiers = await tournament.getRealQualifiersMap()

      const { rows: r32Slots } = await db.query(
        "SELECT id, slot_label, home_source, away_source FROM knockout_slots WHERE stage = 'round_of_32'"
      )
      const { rows: laterSlots } = await db.query(
        "SELECT id FROM knockout_slots WHERE stage <> 'round_of_32'"
      )

      const client = await db.connect()
      try {
        await client.query('BEGIN')

        // Seed R32 with the actual qualified teams
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

        // Pre-insert empty rows for R16-Final so the trigger can UPDATE them when propagating winners
        for (const slot of laterSlots) {
          await client.query(`
            INSERT INTO real_bracket (slot_id) VALUES ($1)
            ON CONFLICT (slot_id) DO NOTHING
          `, [slot.id])
        }

        await client.query('COMMIT')
      } catch (err) {
        await client.query('ROLLBACK')
        throw err
      } finally {
        client.release()
      }

      await db.query(`UPDATE tournament_settings SET group_stage_locked = true WHERE id = true`)

      // Score R32 classification: compare each user's predicted 32 qualifiers
      // (from predicted_group_standings) against the actual 32 just seeded.
      // 5 pts per correct team → max 32 × 5 = 160 pts.
      await scoring.scoreGroupQualification()

      res.json({ message: 'Group stage locked. Round of 32 matchups seeded.', qualifiers })
    },

    // Whitelist management
    async addToWhitelist(req, res) {
      const { email } = req.body
      if (!email) return res.status(400).json({ error: 'email is required' })

      const { rows } = await db.query(
        `INSERT INTO email_whitelist (email, invited_by)
         VALUES ($1, $2)
         ON CONFLICT (email) DO NOTHING
         RETURNING *`,
        [email, req.user.display_name]
      )

      if (!rows.length) return res.status(409).json({ error: 'Email already whitelisted' })
      res.status(201).json(rows[0])
    },

    async removeFromWhitelist(req, res) {
      const { email } = req.params

      const { rows: users } = await db.query('SELECT 1 FROM users WHERE email = $1', [email])
      if (users.length) {
        return res.status(409).json({ error: 'Cannot remove: user already registered with this email' })
      }

      await db.query('DELETE FROM email_whitelist WHERE email = $1', [email])
      res.json({ message: 'Removed from whitelist' })
    },

    async getWhitelist(req, res) {
      const { rows } = await db.query(
        'SELECT id, email, invited_by, created_at FROM email_whitelist ORDER BY created_at DESC'
      )
      res.json(rows)
    },
  }
}

// ─── Default exports for routes (use the real pool + scoring) ─────────────────

const _default = makeAdminController()

export const {
  setGroupMatchResult,
  setKnockoutResult,
  getAdminBracket,
  lockPredictions,
  lockGroupStage,
  addToWhitelist,
  removeFromWhitelist,
  getWhitelist,
} = _default

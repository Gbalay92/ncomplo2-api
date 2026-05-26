/**
 * autoKickoff job
 *
 * Instead of polling every minute, we schedule a precise setTimeout for each
 * upcoming match. On server start we also process any matches that should have
 * already kicked off (server restart / downtime recovery).
 *
 * Call scheduleKickoffs() once at startup, and again after lockGroupStage
 * seeds the R32 slots so those get scheduled too.
 */

import pool from '../db/pool.js'
import { scoreGroupMatch, scoreKnockoutAdvancement } from '../services/scoring.service.js'

async function kickoffGroupMatch(id) {
  const { rowCount } = await pool.query(`
    UPDATE group_matches
    SET real_home_goals = 0,
        real_away_goals = 0,
        is_locked       = true,
        updated_at      = now()
    WHERE id = $1
      AND real_home_goals IS NULL
  `, [id])

  if (rowCount > 0) {
    await scoreGroupMatch(id)
    console.log(`[autoKickoff] Group match ${id} set to 0-0`)
  }
}

async function kickoffKnockoutSlot(slotId) {
  const { rowCount } = await pool.query(`
    UPDATE real_bracket
    SET real_home_goals = 0,
        real_away_goals = 0,
        updated_at      = now()
    WHERE slot_id = $1
      AND real_home_goals IS NULL
      AND home_team_id   IS NOT NULL
  `, [slotId])

  if (rowCount > 0) {
    // 0-0 draw has no winner yet — scoreKnockoutAdvancement won't fire
    // until the admin sets a winner. Nothing to score here.
    console.log(`[autoKickoff] Knockout slot ${slotId} set to 0-0`)
  }
}

function scheduleAt(date, fn) {
  const delay = date.getTime() - Date.now()
  if (delay <= 0) {
    // Already passed — run immediately (handles server restarts / downtime)
    fn().catch(err => console.error('[autoKickoff]', err.message))
  } else {
    setTimeout(() => {
      fn().catch(err => console.error('[autoKickoff]', err.message))
    }, delay)
  }
}

export async function scheduleKickoffs() {
  // Group matches with no result yet
  const { rows: groupMatches } = await pool.query(`
    SELECT id, match_date FROM group_matches
    WHERE match_date IS NOT NULL
      AND real_home_goals IS NULL
  `)

  for (const { id, match_date } of groupMatches) {
    scheduleAt(new Date(match_date), () => kickoffGroupMatch(id))
  }

  // Knockout slots with no result yet
  const { rows: knockoutSlots } = await pool.query(`
    SELECT rb.slot_id, ks.match_date
    FROM real_bracket rb
    JOIN knockout_slots ks ON ks.id = rb.slot_id
    WHERE ks.match_date IS NOT NULL
      AND rb.real_home_goals IS NULL
  `)

  for (const { slot_id, match_date } of knockoutSlots) {
    scheduleAt(new Date(match_date), () => kickoffKnockoutSlot(slot_id))
  }

  const total = groupMatches.length + knockoutSlots.length
  console.log(`[autoKickoff] ${total} match(es) scheduled`)
}

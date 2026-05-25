/**
 * Perfect-score integration test — real PostgreSQL
 *
 * Requires a running PostgreSQL instance:
 *   host: localhost  port: 5432  db: postgres  user: vdp  password: vdp
 *
 * Verifies that a user who predicts EVERYTHING correctly accumulates exactly
 * 1,020 points:
 *
 *   Groups:   72 matches × 5 pts (exact result)  =  360
 *   R32:      32 qualifiers × 5 pts              =  160
 *   R16:      16 qualifiers × 10 pts             =  160
 *   QF:        8 qualifiers × 15 pts             =  120
 *   SF:        4 qualifiers × 25 pts             =  100
 *   Final:     2 finalists  × 35 pts             =   70
 *   Champion:  1 winner     × 50 pts             =   50
 *                                        TOTAL = 1,020
 */

import { test, describe, before, after } from 'node:test'
import assert from 'node:assert/strict'
import pg from 'pg'
import { scoreGroupMatch, scoreGroupQualification, scoreKnockoutAdvancement, scoreChampion } from '../../services/scoring.service.js'
import { getRealQualifiersMap } from '../../services/tournament.service.js'

const { Pool } = pg

// ─── DB connection ─────────────────────────────────────────────────────────────

const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'postgres',
  user: 'vdp',
  password: 'vdp',
})

const TEST_USER_ID = '00000000-0000-0000-0000-000000000001'
const TEST_EMAIL   = 'perfect@test.com'

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function q(sql, params = []) {
  return pool.query(sql, params)
}

async function cleanTestData() {
  await q('DELETE FROM score_log          WHERE user_id = $1', [TEST_USER_ID])
  await q('DELETE FROM predicted_bracket  WHERE user_id = $1', [TEST_USER_ID])
  await q('DELETE FROM predicted_group_standings WHERE user_id = $1', [TEST_USER_ID])
  await q('DELETE FROM predictions        WHERE user_id = $1', [TEST_USER_ID])
  await q('DELETE FROM real_bracket')
  await q('UPDATE group_matches SET real_home_goals = NULL, real_away_goals = NULL, is_locked = false')
  await q('DELETE FROM users WHERE id = $1', [TEST_USER_ID])
  await q('DELETE FROM email_whitelist WHERE email = $1', [TEST_EMAIL])
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('puntuación perfecta — integración real PostgreSQL', () => {

  before(async () => {
    // Clean any leftover state and create test user
    await cleanTestData()
    // Whitelist the test email first (foreign key constraint)
    await q(
      `INSERT INTO email_whitelist (email, invited_by) VALUES ($1, 'test') ON CONFLICT (email) DO NOTHING`,
      [TEST_EMAIL]
    )
    await q(
      `INSERT INTO users (id, email, first_name, last_name, display_name, password_hash, is_admin)
       VALUES ($1, $2, 'Perfect', 'User', 'PerfectUser', 'test-hash', false)
       ON CONFLICT (id) DO NOTHING`,
      [TEST_USER_ID, TEST_EMAIL]
    )
  })

  after(async () => {
    await cleanTestData()
    await pool.end()
  })

  test('suma total = 1,020 pts', async () => {
    let total = 0

    // ── 1. Group match predictions + results → 360 pts ────────────────────────

    const { rows: groupMatches } = await q(
      'SELECT id, home_team_id, away_team_id FROM group_matches ORDER BY match_number'
    )
    assert.equal(groupMatches.length, 72, 'debe haber 72 partidos de grupos')

    // Insert predictions (all exact: 1-0 home win)
    for (const m of groupMatches) {
      await q(
        `INSERT INTO predictions (user_id, match_id, pred_home_goals, pred_away_goals)
         VALUES ($1, $2, 1, 0)`,
        [TEST_USER_ID, m.id]
      )
    }

    // Set real results (1-0 home win → exact match)
    await q('UPDATE group_matches SET real_home_goals = 1, real_away_goals = 0, is_locked = true')

    // Score all group matches
    for (const m of groupMatches) {
      await scoreGroupMatch(m.id, pool)
    }

    const { rows: r1 } = await q(
      'SELECT COALESCE(SUM(points),0)::int AS pts FROM score_log WHERE user_id = $1',
      [TEST_USER_ID]
    )
    total = r1[0].pts
    assert.equal(total, 360, `grupos: esperado 360, obtenido ${total}`)

    // ── 2. Group qualification → 160 pts ──────────────────────────────────────

    // Derive the 32 real qualifiers from the actual results
    const qualifiersMap = await getRealQualifiersMap(pool)

    // Source labels that appear in R32 slots
    const { rows: r32Slots } = await q(
      `SELECT id, slot_label, home_source, away_source
       FROM knockout_slots WHERE stage = 'round_of_32'
       ORDER BY slot_label`
    )

    // Insert real_bracket for R32 (the 32 qualifiers in correct slots)
    for (const slot of r32Slots) {
      const homeTeamId = qualifiersMap[slot.home_source] ?? null
      const awayTeamId = qualifiersMap[slot.away_source] ?? null
      await q(
        `INSERT INTO real_bracket (slot_id, home_team_id, away_team_id)
         VALUES ($1, $2, $3)
         ON CONFLICT (slot_id) DO UPDATE SET home_team_id=$2, away_team_id=$3`,
        [slot.id, homeTeamId, awayTeamId]
      )
    }

    // Insert predicted_group_standings for user — exactly matching real qualifiers
    // Top 2 per group
    const groups = ['A','B','C','D','E','F','G','H','I','J','K','L']
    for (const g of groups) {
      const pos1 = qualifiersMap[`1${g}`]
      const pos2 = qualifiersMap[`2${g}`]
      if (pos1) await q(
        `INSERT INTO predicted_group_standings (user_id, team_id, group_name, position, pred_points, pred_gd, pred_gf, is_classified)
         VALUES ($1, $2, $3, 1, 9, 3, 3, true)`,
        [TEST_USER_ID, pos1, g]
      )
      if (pos2) await q(
        `INSERT INTO predicted_group_standings (user_id, team_id, group_name, position, pred_points, pred_gd, pred_gf, is_classified)
         VALUES ($1, $2, $3, 2, 6, 1, 2, true)`,
        [TEST_USER_ID, pos2, g]
      )
    }
    // 8 best third-placed teams
    for (let i = 1; i <= 8; i++) {
      const teamId = qualifiersMap[`3rd_${i}`]
      if (teamId) {
        // Pick an unused group letter to avoid duplicate (group_name + user_id combo must be unique per position)
        const groupLetter = groups[i - 1]  // reuse group letters A-H for 3rd slots
        await q(
          `INSERT INTO predicted_group_standings (user_id, team_id, group_name, position, pred_points, pred_gd, pred_gf, is_classified)
           VALUES ($1, $2, $3, 3, 3, -1, 1, true)
           ON CONFLICT DO NOTHING`,
          [TEST_USER_ID, teamId, groupLetter]
        )
      }
    }

    await scoreGroupQualification(pool)

    const { rows: r2 } = await q(
      'SELECT COALESCE(SUM(points),0)::int AS pts FROM score_log WHERE user_id = $1',
      [TEST_USER_ID]
    )
    total = r2[0].pts
    assert.equal(total, 520, `grupos + R32 qualif.: esperado 520, obtenido ${total}`)

    // ── 3. Knockout rounds ─────────────────────────────────────────────────────
    // Strategy: in each match, the "home" team always wins.
    // We insert predicted_bracket correctly BEFORE scoring each round.

    const stagesChain = [
      { sourceStage: 'round_of_32', targetStage: 'round_of_16', expectedTotal: 680,  pts: 10 },
      { sourceStage: 'round_of_16', targetStage: 'quarter_final', expectedTotal: 800, pts: 15 },
      { sourceStage: 'quarter_final', targetStage: 'semi_final', expectedTotal: 900,  pts: 25 },
      { sourceStage: 'semi_final', targetStage: 'final', expectedTotal: 970,           pts: 35 },
    ]

    // Build slot → teams mapping (maintained across rounds)
    // Start with R32 teams already in real_bracket
    const { rows: initialR32 } = await q(
      `SELECT rb.slot_id, ks.slot_label, rb.home_team_id, rb.away_team_id
       FROM real_bracket rb
       JOIN knockout_slots ks ON ks.id = rb.slot_id
       WHERE ks.stage = 'round_of_32'`
    )

    // Map: slot_label → { slot_id, home_team_id, away_team_id }
    const slotMap = {}
    for (const row of initialR32) {
      slotMap[row.slot_label] = {
        slot_id:      row.slot_id,
        home_team_id: row.home_team_id,
        away_team_id: row.away_team_id,
      }
    }

    // Process each knockout round
    for (const { sourceStage, targetStage, expectedTotal } of stagesChain) {
      const { rows: sourceSlots } = await q(
        `SELECT id, slot_label, home_source, away_source
         FROM knockout_slots WHERE stage = $1 ORDER BY slot_label`,
        [sourceStage]
      )
      const { rows: targetSlots } = await q(
        `SELECT id, slot_label, home_source, away_source
         FROM knockout_slots WHERE stage = $1 ORDER BY slot_label`,
        [targetStage]
      )

      // Determine winner for each source slot (home team always wins)
      const winners = {}  // slot_label → winner_team_id
      for (const slot of sourceSlots) {
        const slotData = slotMap[slot.slot_label]
        assert.ok(slotData?.home_team_id, `home_team_id missing for ${slot.slot_label}`)
        winners[slot.slot_label] = slotData.home_team_id
      }

      // Insert predicted_bracket for source stage (user predicts home team wins each slot)
      for (const slot of sourceSlots) {
        const slotData = slotMap[slot.slot_label]
        await q(
          `INSERT INTO predicted_bracket (user_id, slot_id, pred_winner_id)
           VALUES ($1, $2, $3)
           ON CONFLICT (user_id, slot_id) DO UPDATE SET pred_winner_id = $3`,
          [TEST_USER_ID, slotData.slot_id, winners[slot.slot_label]]
        )
      }

      // Insert real_bracket for target stage with the correct matchups (home source winner vs away source winner)
      const targetSlotMap = {}
      for (const tSlot of targetSlots) {
        const homeWinner = winners[tSlot.home_source]
        const awayWinner = winners[tSlot.away_source]
        assert.ok(homeWinner, `no winner found for ${tSlot.home_source}`)
        assert.ok(awayWinner, `no winner found for ${tSlot.away_source}`)
        await q(
          `INSERT INTO real_bracket (slot_id, home_team_id, away_team_id)
           VALUES ($1, $2, $3)
           ON CONFLICT (slot_id) DO UPDATE SET home_team_id=$2, away_team_id=$3`,
          [tSlot.id, homeWinner, awayWinner]
        )
        targetSlotMap[tSlot.slot_label] = {
          slot_id:      tSlot.id,
          home_team_id: homeWinner,
          away_team_id: awayWinner,
        }
        slotMap[tSlot.slot_label] = targetSlotMap[tSlot.slot_label]
      }

      // Score advancement for each winner
      for (const slot of sourceSlots) {
        await scoreKnockoutAdvancement(winners[slot.slot_label], targetStage, null, pool)
      }

      const { rows: rk } = await q(
        'SELECT COALESCE(SUM(points),0)::int AS pts FROM score_log WHERE user_id = $1',
        [TEST_USER_ID]
      )
      total = rk[0].pts
      assert.equal(total, expectedTotal, `hasta ${targetStage}: esperado ${expectedTotal}, obtenido ${total}`)
    }

    // ── 4. Champion → 50 pts ──────────────────────────────────────────────────

    // The final slot was inserted in the last iteration (target = 'final')
    const { rows: finalSlots } = await q(
      `SELECT rb.slot_id, rb.home_team_id, rb.away_team_id
       FROM real_bracket rb
       JOIN knockout_slots ks ON ks.id = rb.slot_id
       WHERE ks.stage = 'final'`
    )
    assert.equal(finalSlots.length, 1, 'debe haber 1 slot final')
    const champion = finalSlots[0].home_team_id  // home team wins

    // Insert predicted_bracket for final (user predicts the champion)
    const { rows: finalSlotMeta } = await q(
      `SELECT id FROM knockout_slots WHERE stage = 'final'`
    )
    await q(
      `INSERT INTO predicted_bracket (user_id, slot_id, pred_winner_id)
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id, slot_id) DO UPDATE SET pred_winner_id = $3`,
      [TEST_USER_ID, finalSlotMeta[0].id, champion]
    )

    // Set the real_winner_id in the final real_bracket row
    await q(
      `UPDATE real_bracket SET real_winner_id = $1 WHERE slot_id = $2`,
      [champion, finalSlots[0].slot_id]
    )

    await scoreChampion(pool)

    const { rows: rFinal } = await q(
      'SELECT COALESCE(SUM(points),0)::int AS pts FROM score_log WHERE user_id = $1',
      [TEST_USER_ID]
    )
    total = rFinal[0].pts

    assert.equal(total, 1020, `TOTAL FINAL: esperado 1020, obtenido ${total}`)
    console.log('✅  Puntuación perfecta verificada: 1,020 pts')
  })
})

/**
 * Leaderboard integration test — real PostgreSQL
 *
 * 10 users with different prediction accuracy levels.
 * Verifies that after scoring all phases the leaderboard view returns
 * the correct total_points, group_points, knockout_points and rank for each user.
 *
 * User profiles (all predict the same 32 qualifiers and knockout bracket,
 * but differ in how many group match scores they get right):
 *
 *  u01  — acierta TODO  (exact all group matches + all knockout)   → 1020 pts  rank 1
 *  u02  — exact 36, sign 36 (half exact / half sign) + all knockout → 846 pts  rank 2
 *  u03  — solo sign (never exact) + all knockout                    → 774 pts  rank 3  (72×2 + 414)
 *  u04  — exact all groups + no knockout predictions                → 360 pts  rank 4
 *  u05  — half exact groups + no knockout                           → 252 pts  rank 5  (36×5 + 36×2)
 *  u06  — only sign groups + no knockout                            → 144 pts  rank 6  (72×2)
 *  u07  — all wrong (0 pts groups) + no knockout                    →   0 pts  rank 7 (tied)
 *  u08  — all wrong + no knockout                                   →   0 pts  rank 7 (tied)
 *  u09  — no predictions at all                                     →   0 pts  rank 7 (tied)
 *  u10  — exact all groups + all knockout EXCEPT champion           → 970 pts  rank 2 (wait, recalc below)
 *
 * Final expected ranking:
 *  1 → u01: 1020
 *  2 → u10:  970   (360 group + 160+120+100+70+70... wait let me recalc)
 *
 * Let me define this precisely.
 *
 * Group scoring rules: sign=2, exact=3 extra (total exact=5, sign=2)
 * Real results: all home wins 1-0.
 *
 * u01: 72 exact (1-0) → 72×5 = 360 + all knockout = 360+660 = 1020
 * u02: 36 exact (1-0) + 36 sign (1-0 sign = any home win, e.g. 2-0) → 36×5 + 36×2 = 252 + all knockout = 252+660 = 912
 *   Wait — sign means predicting correct winner but wrong score.
 *   u02 predicts 36 matches exactly (1-0) and 36 with sign only (e.g. 2-0 → still home win, 2pts)
 *   → group = 36×5 + 36×2 = 180+72 = 252. + knockout 660 = 912
 * u03: 72 sign (e.g. all 2-0 → home win but wrong score) → 72×2=144 + knockout 660 = 804
 * u04: exact all 72 + no knockout → 360
 * u05: 36 exact + 36 sign + no knockout → 252
 * u06: 72 sign + no knockout → 144
 * u07: 72 wrong (all predict away wins 0-1) + no knockout → 0
 * u08: same as u07 → 0
 * u09: no predictions → 0
 * u10: exact all 72 + all knockout EXCEPT champion pick (predicts wrong team as champion) → 360 + 610 = 970
 *   knockout without champion = 160+160+120+100+70 = 610
 *
 * Ranking:
 *  1 → u01: 1020
 *  2 → u10:  970
 *  3 → u02:  912
 *  4 → u03:  804
 *  5 → u04:  360
 *  6 → u05:  252
 *  7 → u06:  144
 *  8 → u07:    0  (rank 8, tied with u08 and u09)
 *  8 → u08:    0
 *  8 → u09:    0
 */

import { test, describe, before, after } from 'node:test'
import assert from 'node:assert/strict'
import pg from 'pg'
import { scoreGroupMatch, scoreGroupQualification, scoreKnockoutAdvancement, scoreChampion } from '../../services/scoring.service.js'
import { getRealQualifiersMap } from '../../services/tournament.service.js'

const { Pool } = pg

const pool = new Pool({ host: 'localhost', port: 5432, database: 'postgres', user: 'vdp', password: 'vdp' })

// ─── Test users ───────────────────────────────────────────────────────────────

const USERS = [
  { id: 'bb000000-0000-0000-0000-000000000001', name: 'u01-perfect',          email: 'u01@test.com' },
  { id: 'bb000000-0000-0000-0000-000000000002', name: 'u02-half-exact',       email: 'u02@test.com' },
  { id: 'bb000000-0000-0000-0000-000000000003', name: 'u03-sign-only',        email: 'u03@test.com' },
  { id: 'bb000000-0000-0000-0000-000000000004', name: 'u04-groups-only',      email: 'u04@test.com' },
  { id: 'bb000000-0000-0000-0000-000000000005', name: 'u05-half-groups',      email: 'u05@test.com' },
  { id: 'bb000000-0000-0000-0000-000000000006', name: 'u06-sign-no-knockout', email: 'u06@test.com' },
  { id: 'bb000000-0000-0000-0000-000000000007', name: 'u07-all-wrong',        email: 'u07@test.com' },
  { id: 'bb000000-0000-0000-0000-000000000008', name: 'u08-all-wrong-2',      email: 'u08@test.com' },
  { id: 'bb000000-0000-0000-0000-000000000009', name: 'u09-no-predictions',   email: 'u09@test.com' },
  { id: 'bb000000-0000-0000-0000-000000000010', name: 'u10-no-champion',      email: 'u10@test.com' },
]
const USER_IDS = USERS.map(u => u.id)

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function q(sql, params = []) { return pool.query(sql, params) }

async function cleanTestData() {
  const ids = USER_IDS
  await q('DELETE FROM score_log WHERE user_id = ANY($1)', [ids])
  await q('DELETE FROM predicted_bracket WHERE user_id = ANY($1)', [ids])
  await q('DELETE FROM predicted_group_standings WHERE user_id = ANY($1)', [ids])
  await q('DELETE FROM predictions WHERE user_id = ANY($1)', [ids])
  await q('DELETE FROM real_bracket')
  await q('UPDATE group_matches SET real_home_goals = NULL, real_away_goals = NULL, is_locked = false')
  await q('DELETE FROM users WHERE id = ANY($1)', [ids])
  await q('DELETE FROM email_whitelist WHERE email LIKE $1', ['u0%@test.com'])
}

// ─── Suite ────────────────────────────────────────────────────────────────────

describe('leaderboard — 10 usuarios con distintos aciertos', () => {

  before(async () => {
    await cleanTestData()
    for (const u of USERS) {
      await q(`INSERT INTO email_whitelist (email, invited_by) VALUES ($1, 'test') ON CONFLICT DO NOTHING`, [u.email])
      await q(
        `INSERT INTO users (id, email, first_name, last_name, display_name, password_hash, is_admin)
         VALUES ($1, $2, 'Test', $3, $3, 'hash', false) ON CONFLICT (id) DO NOTHING`,
        [u.id, u.email, u.name]
      )
    }
  })

  after(async () => {
    await cleanTestData()
    await pool.end()
  })

  test('ranking y puntos correctos para 10 usuarios', async () => {

    // ── Fetch match data ──────────────────────────────────────────────────────

    const { rows: groupMatches } = await q(
      'SELECT id, match_number, home_team_id, away_team_id FROM group_matches ORDER BY match_number'
    )

    // Split matches into two halves for u02/u05 (first 36 exact, last 36 sign-only)
    const firstHalf  = groupMatches.slice(0, 36)  // exact: 1-0
    const secondHalf = groupMatches.slice(36)       // sign only: 2-0

    // ── Insert group predictions ──────────────────────────────────────────────

    // u01: all exact (1-0)
    for (const m of groupMatches) {
      await q('INSERT INTO predictions (user_id, match_id, pred_home_goals, pred_away_goals) VALUES ($1,$2,1,0)',
        [USERS[0].id, m.id])
    }
    // u02: first 36 exact (1-0), last 36 sign (2-0)
    for (const m of firstHalf)  await q('INSERT INTO predictions VALUES (DEFAULT,$1,$2,1,0)', [USERS[1].id, m.id])
    for (const m of secondHalf) await q('INSERT INTO predictions VALUES (DEFAULT,$1,$2,2,0)', [USERS[1].id, m.id])
    // u03: all sign (2-0)
    for (const m of groupMatches) {
      await q('INSERT INTO predictions VALUES (DEFAULT,$1,$2,2,0)', [USERS[2].id, m.id])
    }
    // u04: all exact (1-0)
    for (const m of groupMatches) {
      await q('INSERT INTO predictions VALUES (DEFAULT,$1,$2,1,0)', [USERS[3].id, m.id])
    }
    // u05: first 36 exact, last 36 sign
    for (const m of firstHalf)  await q('INSERT INTO predictions VALUES (DEFAULT,$1,$2,1,0)', [USERS[4].id, m.id])
    for (const m of secondHalf) await q('INSERT INTO predictions VALUES (DEFAULT,$1,$2,2,0)', [USERS[4].id, m.id])
    // u06: all sign (2-0)
    for (const m of groupMatches) {
      await q('INSERT INTO predictions VALUES (DEFAULT,$1,$2,2,0)', [USERS[5].id, m.id])
    }
    // u07, u08: all wrong (0-1 away win)
    for (const m of groupMatches) {
      await q('INSERT INTO predictions VALUES (DEFAULT,$1,$2,0,1)', [USERS[6].id, m.id])
      await q('INSERT INTO predictions VALUES (DEFAULT,$1,$2,0,1)', [USERS[7].id, m.id])
    }
    // u09: no predictions
    // u10: all exact (1-0)
    for (const m of groupMatches) {
      await q('INSERT INTO predictions VALUES (DEFAULT,$1,$2,1,0)', [USERS[9].id, m.id])
    }

    // ── Set real results and score groups ─────────────────────────────────────

    await q('UPDATE group_matches SET real_home_goals = 1, real_away_goals = 0, is_locked = true')
    for (const m of groupMatches) {
      await scoreGroupMatch(m.id, pool)
    }

    // Verify group subtotals
    const grpCheck = await q(`
      SELECT u.display_name, COALESCE(SUM(sl.points),0)::int AS pts
      FROM users u
      LEFT JOIN score_log sl ON sl.user_id = u.id AND sl.stage = 'group'
      WHERE u.id = ANY($1)
      GROUP BY u.id, u.display_name ORDER BY u.display_name
    `, [USER_IDS])

    const grpPts = Object.fromEntries(grpCheck.rows.map(r => [r.display_name, r.pts]))
    assert.equal(grpPts['u01-perfect'],          360, 'u01 grupos')
    assert.equal(grpPts['u02-half-exact'],        252, 'u02 grupos')  // 36×5 + 36×2
    assert.equal(grpPts['u03-sign-only'],         144, 'u03 grupos')  // 72×2
    assert.equal(grpPts['u04-groups-only'],       360, 'u04 grupos')
    assert.equal(grpPts['u05-half-groups'],       252, 'u05 grupos')
    assert.equal(grpPts['u06-sign-no-knockout'],  144, 'u06 grupos')
    assert.equal(grpPts['u07-all-wrong'],           0, 'u07 grupos')
    assert.equal(grpPts['u08-all-wrong-2'],         0, 'u08 grupos')
    assert.equal(grpPts['u09-no-predictions'],      0, 'u09 grupos')
    assert.equal(grpPts['u10-no-champion'],       360, 'u10 grupos')

    // ── Setup qualification (same 32 qualifiers for everyone) ─────────────────

    const qualMap = await getRealQualifiersMap(pool)
    const { rows: r32Slots } = await q(
      `SELECT id, slot_label, home_source, away_source FROM knockout_slots WHERE stage='round_of_32' ORDER BY slot_label`
    )

    // Insert real_bracket for R32
    for (const slot of r32Slots) {
      await q(
        `INSERT INTO real_bracket (slot_id, home_team_id, away_team_id) VALUES ($1,$2,$3)
         ON CONFLICT (slot_id) DO UPDATE SET home_team_id=$2, away_team_id=$3`,
        [slot.id, qualMap[slot.home_source] ?? null, qualMap[slot.away_source] ?? null]
      )
    }

    // Insert predicted_group_standings for knockout users (u01, u02, u03, u10)
    // All predict the correct 32 qualifiers
    const knockoutUsers = [USERS[0], USERS[1], USERS[2], USERS[9]]
    const groups = ['A','B','C','D','E','F','G','H','I','J','K','L']

    for (const u of knockoutUsers) {
      for (const g of groups) {
        for (const [pos, label, pts, gd, gf] of [[1, `1${g}`, 9, 3, 3], [2, `2${g}`, 6, 1, 2]]) {
          const teamId = qualMap[label]
          if (teamId) await q(
            `INSERT INTO predicted_group_standings (user_id, team_id, group_name, position, pred_points, pred_gd, pred_gf, is_classified)
             VALUES ($1,$2,$3,$4,$5,$6,$7,true)`,
            [u.id, teamId, g, pos, pts, gd, gf]
          )
        }
      }
      // 8 best third-placed
      for (let i = 1; i <= 8; i++) {
        const teamId = qualMap[`3rd_${i}`]
        if (teamId) await q(
          `INSERT INTO predicted_group_standings (user_id, team_id, group_name, position, pred_points, pred_gd, pred_gf, is_classified)
           VALUES ($1,$2,$3,3,3,-1,1,true) ON CONFLICT DO NOTHING`,
          [u.id, teamId, groups[i - 1]]
        )
      }
    }

    await scoreGroupQualification(pool)

    // ── Knockout rounds ───────────────────────────────────────────────────────

    const stagesChain = [
      { sourceStage: 'round_of_32',   targetStage: 'round_of_16',   expectedKnockout: 160 },
      { sourceStage: 'round_of_16',   targetStage: 'quarter_final', expectedKnockout: 320 },
      { sourceStage: 'quarter_final', targetStage: 'semi_final',     expectedKnockout: 440 },
      { sourceStage: 'semi_final',    targetStage: 'final',          expectedKnockout: 540 },
    ]

    // Track home team per slot for bracket progression
    const slotTeams = {}  // slot_label → { slot_id, home_team_id }
    for (const slot of r32Slots) {
      slotTeams[slot.slot_label] = {
        slot_id:      slot.id,
        home_team_id: qualMap[slot.home_source] ?? null,
      }
    }

    for (const { sourceStage, targetStage } of stagesChain) {
      const { rows: srcSlots } = await q(
        `SELECT id, slot_label, home_source, away_source FROM knockout_slots WHERE stage=$1 ORDER BY slot_label`,
        [sourceStage]
      )
      const { rows: tgtSlots } = await q(
        `SELECT id, slot_label, home_source, away_source FROM knockout_slots WHERE stage=$1 ORDER BY slot_label`,
        [targetStage]
      )

      // Winners = home team of each source slot
      const winners = {}
      for (const s of srcSlots) {
        winners[s.slot_label] = slotTeams[s.slot_label].home_team_id
      }

      // Insert predicted_bracket for all knockout users (all pick home team = winner)
      for (const u of knockoutUsers) {
        for (const s of srcSlots) {
          await q(
            `INSERT INTO predicted_bracket (user_id, slot_id, pred_winner_id)
             VALUES ($1,$2,$3) ON CONFLICT (user_id, slot_id) DO UPDATE SET pred_winner_id=$3`,
            [u.id, slotTeams[s.slot_label].slot_id, winners[s.slot_label]]
          )
        }
      }

      // Insert real_bracket for target stage
      for (const ts of tgtSlots) {
        const homeWinner = winners[ts.home_source]
        const awayWinner = winners[ts.away_source]
        await q(
          `INSERT INTO real_bracket (slot_id, home_team_id, away_team_id) VALUES ($1,$2,$3)
           ON CONFLICT (slot_id) DO UPDATE SET home_team_id=$2, away_team_id=$3`,
          [ts.id, homeWinner, awayWinner]
        )
        slotTeams[ts.slot_label] = { slot_id: ts.id, home_team_id: homeWinner }
      }

      // Score advancement for each source slot winner
      for (const s of srcSlots) {
        await scoreKnockoutAdvancement(winners[s.slot_label], targetStage, null, pool)
      }
    }

    // ── Champion ──────────────────────────────────────────────────────────────

    const { rows: finalSlotRows } = await q(
      `SELECT rb.slot_id, rb.home_team_id, rb.away_team_id
       FROM real_bracket rb JOIN knockout_slots ks ON ks.id = rb.slot_id WHERE ks.stage='final'`
    )
    const champion    = finalSlotRows[0].home_team_id
    const wrongTeam   = finalSlotRows[0].away_team_id  // u10 picks the loser
    const finalSlotId = finalSlotRows[0].slot_id

    const { rows: [{ id: finalKsId }] } = await q(`SELECT id FROM knockout_slots WHERE stage='final'`)

    // u01, u02, u03: predict the real champion
    for (const u of [USERS[0], USERS[1], USERS[2]]) {
      await q(
        `INSERT INTO predicted_bracket (user_id, slot_id, pred_winner_id)
         VALUES ($1,$2,$3) ON CONFLICT (user_id, slot_id) DO UPDATE SET pred_winner_id=$3`,
        [u.id, finalKsId, champion]
      )
    }
    // u10: predicts the wrong finalist as champion
    await q(
      `INSERT INTO predicted_bracket (user_id, slot_id, pred_winner_id)
       VALUES ($1,$2,$3) ON CONFLICT (user_id, slot_id) DO UPDATE SET pred_winner_id=$3`,
      [USERS[9].id, finalKsId, wrongTeam]
    )

    // Set real_winner_id in the final bracket row
    await q('UPDATE real_bracket SET real_winner_id=$1 WHERE slot_id=$2', [champion, finalSlotId])

    await scoreChampion(pool)

    // ── Leaderboard assertions ────────────────────────────────────────────────

    const { rows: lb } = await q(`
      SELECT user_id, display_name, total_points::int, group_points::int, knockout_points::int, rank::int
      FROM leaderboard
      WHERE user_id = ANY($1)
      ORDER BY rank, display_name
    `, [USER_IDS])

    const byName = Object.fromEntries(lb.map(r => [r.display_name, r]))

    // Points
    assert.equal(byName['u01-perfect'].total_points,         1020, 'u01 total')
    assert.equal(byName['u01-perfect'].group_points,          360, 'u01 grupos')
    assert.equal(byName['u01-perfect'].knockout_points,       660, 'u01 knockout')

    assert.equal(byName['u10-no-champion'].total_points,      970, 'u10 total')
    assert.equal(byName['u10-no-champion'].knockout_points,   610, 'u10 knockout (sin campeón)')

    assert.equal(byName['u02-half-exact'].total_points,       912, 'u02 total')  // 252 + 660
    assert.equal(byName['u02-half-exact'].group_points,       252, 'u02 grupos')

    assert.equal(byName['u03-sign-only'].total_points,        804, 'u03 total')  // 144 + 660
    assert.equal(byName['u03-sign-only'].group_points,        144, 'u03 grupos')

    assert.equal(byName['u04-groups-only'].total_points,      360, 'u04 total')
    assert.equal(byName['u04-groups-only'].knockout_points,     0, 'u04 knockout (ninguno)')

    assert.equal(byName['u05-half-groups'].total_points,      252, 'u05 total')
    assert.equal(byName['u06-sign-no-knockout'].total_points, 144, 'u06 total')

    assert.equal(byName['u07-all-wrong'].total_points,          0, 'u07 total')
    assert.equal(byName['u08-all-wrong-2'].total_points,        0, 'u08 total')
    assert.equal(byName['u09-no-predictions'].total_points,     0, 'u09 total')

    // Ranking
    assert.equal(byName['u01-perfect'].rank,         1, 'u01 rank 1')
    assert.equal(byName['u10-no-champion'].rank,     2, 'u10 rank 2')
    assert.equal(byName['u02-half-exact'].rank,      3, 'u02 rank 3')
    assert.equal(byName['u03-sign-only'].rank,       4, 'u03 rank 4')
    assert.equal(byName['u04-groups-only'].rank,     5, 'u04 rank 5')
    assert.equal(byName['u05-half-groups'].rank,     6, 'u05 rank 6')
    assert.equal(byName['u06-sign-no-knockout'].rank,7, 'u06 rank 7')
    // u07, u08, u09 all tied at rank 8
    assert.equal(byName['u07-all-wrong'].rank,       8, 'u07 rank 8 (empate)')
    assert.equal(byName['u08-all-wrong-2'].rank,     8, 'u08 rank 8 (empate)')
    assert.equal(byName['u09-no-predictions'].rank,  8, 'u09 rank 8 (empate)')

    console.log('\n📊 Leaderboard:')
    lb.forEach(r =>
      console.log(`  ${String(r.rank).padStart(2)}. ${r.display_name.padEnd(22)} ${String(r.total_points).padStart(5)} pts  (grupos: ${r.group_points}, KO: ${r.knockout_points})`)
    )
  })
})

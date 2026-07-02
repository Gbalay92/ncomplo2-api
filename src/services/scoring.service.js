import pool from '../db/pool.js'
import { scoreGroupPrediction } from './scoring.utils.js'

// Stage that feeds into each knockout stage — used to know which predictions to look up.
const PREV_STAGE = {
  round_of_16:   'round_of_32',
  quarter_final: 'round_of_16',
  semi_final:    'quarter_final',
  final:         'semi_final',
}

// ─── scoreGroupMatch ──────────────────────────────────────────────────────────
// Called after admin enters a group match result.

export async function scoreGroupMatch(matchId, db = pool) {
  const client = await db.connect()
  try {
    await client.query('BEGIN')

    const { rows: matches } = await client.query(
      'SELECT real_home_goals, real_away_goals FROM group_matches WHERE id = $1',
      [matchId]
    )
    if (!matches.length || matches[0].real_home_goals == null) {
      throw new Error('Match has no result yet')
    }
    const { real_home_goals, real_away_goals } = matches[0]

    const { rows: rules } = await client.query(
      "SELECT points_sign, points_exact FROM scoring_rules WHERE stage = 'group'"
    )
    const { points_sign, points_exact } = rules[0]

    const { rows: predictions } = await client.query(
      'SELECT user_id, pred_home_goals, pred_away_goals FROM predictions WHERE match_id = $1',
      [matchId]
    )

    await client.query(
      "DELETE FROM score_log WHERE event_type = 'group_match' AND event_ref = $1",
      [matchId]
    )

    for (const pred of predictions) {
      const pts = scoreGroupPrediction(
        pred.pred_home_goals, pred.pred_away_goals,
        real_home_goals, real_away_goals,
        points_sign, points_exact
      )
      if (pts > 0) {
        await client.query(`
          INSERT INTO score_log (user_id, event_type, event_ref, stage, points)
          VALUES ($1, 'group_match', $2, 'group', $3)
          ON CONFLICT (user_id, event_type, event_ref, stage) DO UPDATE SET points = EXCLUDED.points
        `, [pred.user_id, matchId, pts])
      }
    }

    await client.query('COMMIT')
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
}

// ─── scoreGroupQualification ──────────────────────────────────────────────────
// Called once from lockGroupStage after R32 is seeded.
// Compares each user's predicted 32 qualifiers (stored in predicted_group_standings)
// against the actual 32 qualifiers (from real_bracket for round_of_32 slots).
// Awards points_classify for each correct team.
// Max: 32 teams × points_classify = 32 × 5 = 160 pts.

export async function scoreGroupQualification(db = pool) {
  const client = await db.connect()
  try {
    await client.query('BEGIN')

    // All users' predicted qualifiers (already computed and persisted)
    const { rows: predictedQuals } = await client.query(`
      SELECT user_id, team_id
      FROM predicted_group_standings
      WHERE is_classified = true
    `)

    // Actual R32 qualifiers (just seeded by lockGroupStage)
    const { rows: r32Slots } = await client.query(`
      SELECT rb.home_team_id, rb.away_team_id
      FROM real_bracket rb
      JOIN knockout_slots ks ON ks.id = rb.slot_id
      WHERE ks.stage = 'round_of_32'
    `)
    const actualQualifiers = new Set(
      r32Slots.flatMap(s => [s.home_team_id, s.away_team_id].filter(Boolean))
    )

    if (actualQualifiers.size === 0) {
      await client.query('COMMIT')
      return
    }

    const { rows: rules } = await client.query(
      "SELECT points_classify FROM scoring_rules WHERE stage = 'round_of_32'"
    )
    const { points_classify } = rules[0]

    // Idempotent: wipe previous R32 classification entries
    await client.query(
      "DELETE FROM score_log WHERE event_type = 'classification' AND stage = 'round_of_32'"
    )

    for (const { user_id, team_id } of predictedQuals) {
      if (actualQualifiers.has(team_id)) {
        await client.query(`
          INSERT INTO score_log (user_id, event_type, event_ref, stage, points)
          VALUES ($1, 'classification', $2, 'round_of_32', $3)
        `, [user_id, team_id, points_classify])
      }
    }

    await client.query('COMMIT')
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
}

// ─── scoreKnockoutAdvancement ─────────────────────────────────────────────────
// Called from setKnockoutResult whenever a knockout result is saved (live or final).
//
// teamId     — current winner (null if live score has no winner yet, e.g. 1-1 mid-match)
// targetStage — stage the winner advances INTO
// prevTeamId  — previous winner stored in DB before this update (null if first save)
//               used to clean up stale scoring when the winner changes
//
// Max per round: N_teams × points_classify
//   R16:  16 × 10 = 160 pts   QF:   8 × 15 = 120 pts
//   SF:    4 × 25 = 100 pts   Final: 2 × 35 = 70 pts

export async function scoreKnockoutAdvancement(teamId, targetStage, prevTeamId = null, db = pool) {
  const client = await db.connect()
  try {
    await client.query('BEGIN')

    const sourceStage = PREV_STAGE[targetStage]
    if (!sourceStage) throw new Error(`No previous stage for: ${targetStage}`)

    // Clean up stale entries when the winner changes (e.g. 1-0 → 1-1 → 1-2)
    if (prevTeamId && prevTeamId !== teamId) {
      await client.query(
        "DELETE FROM score_log WHERE event_type = 'classification' AND event_ref = $1 AND stage = $2",
        [prevTeamId, targetStage]
      )
    }

    // No winner yet (live intermediate score) — stale entries already cleaned up, nothing to insert
    if (!teamId) {
      await client.query('COMMIT')
      return
    }

    const { rows: rules } = await client.query(
      'SELECT points_classify FROM scoring_rules WHERE stage = $1',
      [targetStage]
    )
    if (!rules.length) throw new Error(`No scoring rule for stage: ${targetStage}`)
    const { points_classify } = rules[0]

    // Users who predicted teamId to win any match in the source stage
    const { rows: users } = await client.query(`
      SELECT pb.user_id
      FROM predicted_bracket pb
      JOIN knockout_slots ks ON ks.id = pb.slot_id
      WHERE ks.stage = $1 AND pb.pred_winner_id = $2
    `, [sourceStage, teamId])

    // Idempotent: delete previous entries for this team's advancement to targetStage
    await client.query(
      "DELETE FROM score_log WHERE event_type = 'classification' AND event_ref = $1 AND stage = $2",
      [teamId, targetStage]
    )

    for (const { user_id } of users) {
      await client.query(`
        INSERT INTO score_log (user_id, event_type, event_ref, stage, points)
        VALUES ($1, 'classification', $2, $3, $4)
      `, [user_id, teamId, targetStage, points_classify])
    }

    await client.query('COMMIT')
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
}

// ─── scoreChampion ────────────────────────────────────────────────────────────
// Called after the final result is confirmed.

export async function scoreChampion(db = pool) {
  const client = await db.connect()
  try {
    await client.query('BEGIN')

    const { rows: finalSlot } = await client.query(`
      SELECT rb.real_winner_id
      FROM real_bracket rb
      JOIN knockout_slots ks ON ks.id = rb.slot_id
      WHERE ks.stage = 'final' AND rb.real_winner_id IS NOT NULL
    `)
    if (!finalSlot.length) throw new Error('Final result not yet confirmed')
    const championId = finalSlot[0].real_winner_id

    const { rows: rules } = await client.query(
      "SELECT points_champion FROM scoring_rules WHERE stage = 'final'"
    )
    const { points_champion } = rules[0]

    const { rows: correct } = await client.query(`
      SELECT pb.user_id
      FROM predicted_bracket pb
      JOIN knockout_slots ks ON ks.id = pb.slot_id
      WHERE ks.stage = 'final' AND pb.pred_winner_id = $1
    `, [championId])

    await client.query(
      "DELETE FROM score_log WHERE event_type = 'champion' AND event_ref = 'final'"
    )

    for (const { user_id } of correct) {
      await client.query(`
        INSERT INTO score_log (user_id, event_type, event_ref, stage, points)
        VALUES ($1, 'champion', 'final', 'final', $2)
      `, [user_id, points_champion])
    }

    await client.query('COMMIT')
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
}

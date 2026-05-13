import pool from '../db/pool.js'

const GROUPS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L']

// Pure: given an array of { home_team_id, away_team_id, home_goals, away_goals }
// returns standings sorted by pts → gd → gf
function calculateGroupTable(matches) {
  const stats = {}

  for (const { home_team_id, away_team_id } of matches) {
    if (!stats[home_team_id]) stats[home_team_id] = { team_id: home_team_id, pts: 0, gd: 0, gf: 0 }
    if (!stats[away_team_id]) stats[away_team_id] = { team_id: away_team_id, pts: 0, gd: 0, gf: 0 }
  }

  for (const { home_team_id, away_team_id, home_goals, away_goals } of matches) {
    if (home_goals == null || away_goals == null) continue
    stats[home_team_id].gf += home_goals
    stats[home_team_id].gd += home_goals - away_goals
    stats[away_team_id].gf += away_goals
    stats[away_team_id].gd += away_goals - home_goals
    if (home_goals > away_goals) stats[home_team_id].pts += 3
    else if (away_goals > home_goals) stats[away_team_id].pts += 3
    else { stats[home_team_id].pts += 1; stats[away_team_id].pts += 1 }
  }

  return Object.values(stats).sort((a, b) => b.pts - a.pts || b.gd - a.gd || b.gf - a.gf)
}

// ─── USER PREDICTED STANDINGS ────────────────────────────────────────────────

async function deriveUserGroupStandings(userId, groupName, client) {
  const { rows } = await client.query(`
    SELECT m.home_team_id, m.away_team_id,
           p.pred_home_goals AS home_goals,
           p.pred_away_goals AS away_goals
    FROM group_matches m
    LEFT JOIN predictions p ON p.match_id = m.id AND p.user_id = $1
    WHERE m.group_name = $2
  `, [userId, groupName])

  const table = calculateGroupTable(rows)

  await client.query(
    'DELETE FROM predicted_group_standings WHERE user_id = $1 AND group_name = $2',
    [userId, groupName]
  )

  for (let i = 0; i < table.length; i++) {
    const { team_id, pts, gd, gf } = table[i]
    await client.query(`
      INSERT INTO predicted_group_standings
        (user_id, team_id, group_name, position, pred_points, pred_gd, pred_gf, is_classified)
      VALUES ($1, $2, $3, $4, $5, $6, $7, false)
    `, [userId, team_id, groupName, i + 1, pts, gd, gf])
  }

  return table
}

// Mark top 2 per group + 8 best third-placed as classified
async function markUserClassified(userId, client) {
  await client.query(`
    UPDATE predicted_group_standings
    SET is_classified = (position <= 2)
    WHERE user_id = $1
  `, [userId])

  const { rows: thirds } = await client.query(`
    SELECT id FROM predicted_group_standings
    WHERE user_id = $1 AND position = 3
    ORDER BY pred_points DESC, pred_gd DESC, pred_gf DESC
    LIMIT 8
  `, [userId])

  if (thirds.length > 0) {
    await client.query(
      'UPDATE predicted_group_standings SET is_classified = true WHERE id = ANY($1)',
      [thirds.map(r => r.id)]
    )
  }
}

// Recalculate all 12 groups for a user and mark classification
export async function deriveUserStandings(userId) {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    for (const group of GROUPS) {
      await deriveUserGroupStandings(userId, group, client)
    }
    await markUserClassified(userId, client)
    await client.query('COMMIT')
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
}

// Recalculate standings for one group for a user (called after saving group predictions)
export async function deriveUserGroupOnly(userId, groupName) {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    await deriveUserGroupStandings(userId, groupName, client)
    await markUserClassified(userId, client)
    await client.query('COMMIT')
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
}

// Returns the 32 predicted qualifiers for a user (used to build the bracket picker)
export async function getUserQualifiers(userId) {
  const { rows } = await pool.query(`
    SELECT pgs.position, pgs.group_name, pgs.is_classified,
           t.id AS team_id, t.name, t.code, t.flag_url,
           pgs.pred_points, pgs.pred_gd, pgs.pred_gf
    FROM predicted_group_standings pgs
    JOIN teams t ON t.id = pgs.team_id
    WHERE pgs.user_id = $1 AND pgs.is_classified = true
    ORDER BY pgs.group_name, pgs.position
  `, [userId])
  return rows
}

// ─── REAL STANDINGS (used by admin) ──────────────────────────────────────────

async function deriveRealGroupTable(groupName, client) {
  const { rows } = await client.query(`
    SELECT home_team_id, away_team_id,
           real_home_goals AS home_goals,
           real_away_goals AS away_goals
    FROM group_matches
    WHERE group_name = $1
  `, [groupName])

  return calculateGroupTable(rows)
}

// Returns a position-label → team_id map for seeding the real knockout bracket
// e.g. { '1A': uuid, '2A': uuid, '3rd_1': uuid, ... }
export async function getRealQualifiersMap() {
  const client = await pool.connect()
  try {
    const map = {}
    const thirdPlaced = []

    for (const group of GROUPS) {
      const table = await deriveRealGroupTable(group, client)
      table.forEach((entry, i) => {
        map[`${i + 1}${group}`] = entry.team_id
        if (i === 2) {
          thirdPlaced.push({ group, team_id: entry.team_id, pts: entry.pts, gd: entry.gd, gf: entry.gf })
        }
      })
    }

    // Rank all 12 third-placed teams and label the top 8
    thirdPlaced
      .sort((a, b) => b.pts - a.pts || b.gd - a.gd || b.gf - a.gf)
      .slice(0, 8)
      .forEach((t, i) => { map[`3rd_${i + 1}`] = t.team_id })

    return map
  } finally {
    client.release()
  }
}

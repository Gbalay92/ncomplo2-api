import pool from '../db/pool.js'

export const GROUPS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L']

// ─── FIFA THIRD-PLACE ASSIGNMENT TABLE ───────────────────────────────────────
//
// Source: FIFA World Cup 2026 Regulations, Annex C (495 combinations).
//
// Columns (in order): [1A, 1B, 1D, 1E, 1G, 1I, 1K, 1L]
// Each column = which third-place group's team is assigned to face that group winner.
//
// Key = the 8 qualifying group letters sorted alphabetically and joined.
// e.g. groups E,F,G,H,I,J,K,L → key 'EFGHIJKL'
//      → assignment ['E','J','I','F','H','G','L','K']
//      → 3E faces 1A, 3J faces 1B, 3I faces 1D, 3F faces 1E, etc.

const _FIFA_RAW = `\
E J I F H G L K
H G I D J F L K
E J I D H G L K
E J I D H F L K
E G I D J F L K
E G J D H F L K
E G I D H F L K
E G J D H F L I
E G J D H F I K
H G I C J F L K
E J I C H G L K
E J I C H F L K
E G I C J F L K
E G J C H F L K
E G I C H F L K
E G J C H F L I
E G J C H F I K
H G I C J D L K
C J I D H F L K
C G I D J F L K
C G J D H F L K
C G I D H F L K
C G J D H F L I
C G J D H F I K
E J I C H D L K
E G I C J D L K
E G J C H D L K
E G I C H D L K
E G J C H D L I
E G J C H D I K
C J E D I F L K
C J E D H F L K
C E I D H F L K
C J E D H F L I
C J E D H F I K
C G E D J F L K
C G E D I F L K
C G E D J F L I
C G E D J F I K
C G E D H F L K
C G J D H F L E
C G J D H F E K
C G E D H F L I
C G E D H F I K
C G J D H F E I
H J B F I G L K
E J I B H G L K
E J B F I H L K
E J B F I G L K
E J B F H G L K
E G B F I H L K
E J B F H G L I
E J B F H G I K
H J B D I G L K
H J B D I F L K
I G B D J F L K
H G B D J F L K
H G B D I F L K
H G B D J F L I
H G B D J F I K
E J B D I H L K
E J B D I G L K
E J B D H G L K
E G B D I H L K
E J B D H G L I
E J B D H G I K
E J B D I F L K
E J B D H F L K
E I B D H F L K
E J B D H F L I
E J B D H F I K
E G B D J F L K
E G B D I F L K
E G B D J F L I
E G B D J F I K
E G B D H F L K
H G B D J F L E
H G B D J F E K
E G B D H F L I
E G B D H F I K
H G B D J F E I
H J B C I G L K
H J B C I F L K
I G B C J F L K
H G B C J F L K
H G B C I F L K
H G B C J F L I
H G B C J F I K
E J B C I H L K
E J B C I G L K
E J B C H G L K
E G B C I H L K
E J B C H G L I
E J B C H G I K
E J B C I F L K
E J B C H F L K
E I B C H F L K
E J B C H F L I
E J B C H F I K
E G B C J F L K
E G B C I F L K
E G B C J F L I
E G B C J F I K
E G B C H F L K
H G B C J F L E
H G B C J F E K
E G B C H F L I
E G B C H F I K
H G B C J F E I
H J B C I D L K
I G B C J D L K
H G B C J D L K
H G B C I D L K
H G B C J D L I
H G B C J D I K
C J B D I F L K
C J B D H F L K
C I B D H F L K
C J B D H F L I
C J B D H F I K
C G B D J F L K
C G B D I F L K
C G B D J F L I
C G B D J F I K
C G B D H F L K
C G B D H F L J
H G B C J F D K
C G B D H F L I
C G B D H F I K
H G B C J F D I
E J B C I D L K
E J B C H D L K
E I B C H D L K
E J B C H D L I
E J B C H D I K
E G B C J D L K
E G B C I D L K
E G B C J D L I
E G B C J D I K
E G B C H D L K
H G B C J D L E
H G B C J D E K
E G B C H D L I
E G B C H D I K
H G B C J D E I
C J B D E F L K
C E B D I F L K
C J B D E F L I
C J B D E F I K
C E B D H F L K
C J B D H F L E
C J B D H F E K
C E B D H F L I
C E B D H F I K
C J B D H F E I
C G B D E F L K
C G B D J F L E
C G B D J F E K
C G B D E F L I
C G B D E F I K
C G B D J F E I
C G B D H F L E
C G B D H F E K
H G B C J F D E
C G B D H F E I
H J I F A G L K
E J I A H G L K
E J I F A H L K
E J I F A G L K
E G J F A H L K
E G I F A H L K
E G J F A H L I
E G J F A H I K
H J I D A G L K
H J I D A F L K
I G J D A F L K
H G J D A F L K
H G I D A F L K
H G J D A F L I
H G J D A F I K
E J I D A H L K
E J I D A G L K
E G J D A H L K
E G I D A H L K
E G J D A H L I
E G J D A H I K
E J I D A F L K
H J E D A F L K
H E I D A F L K
H J E D A F L I
H J E D A F I K
E G J D A F L K
E G I D A F L K
E G J D A F L I
E G J D A F I K
H G E D A F L K
H G J D A F L E
H G J D A F E K
H G E D A F L I
H G E D A F I K
H G J D A F E I
H J I C A G L K
H J I C A F L K
I G J C A F L K
H G J C A F L K
H G I C A F L K
H G J C A F L I
H G J C A F I K
E J I C A H L K
E J I C A G L K
E G J C A H L K
E G I C A H L K
E G J C A H L I
E G J C A H I K
E J I C A F L K
H J E C A F L K
H E I C A F L K
H J E C A F L I
H J E C A F I K
E G J C A F L K
E G I C A F L K
E G J C A F L I
E G J C A F I K
H G E C A F L K
H G J C A F L E
H G J C A F E K
H G E C A F L I
H G E C A F I K
H G J C A F E I
H J I C A D L K
I G J C A D L K
H G J C A D L K
H G I C A D L K
H G J C A D L I
H G J C A D I K
C J I D A F L K
H J F C A D L K
H F I C A D L K
H J F C A D L I
H J F C A D I K
C G J D A F L K
C G I D A F L K
C G J D A F L I
C G J D A F I K
H G F C A D L K
C G J D A F L H
H G J C A F D K
H G F C A D L I
H G F C A D I K
H G J C A F D I
E J I C A D L K
H J E C A D L K
H E I C A D L K
H J E C A D L I
H J E C A D I K
E G J C A D L K
E G I C A D L K
E G J C A D L I
E G J C A D I K
H G E C A D L K
H G J C A D L E
H G J C A D E K
H G E C A D L I
H G E C A D I K
H G J C A D E I
C J E D A F L K
C E I D A F L K
C J E D A F L I
C J E D A F I K
H E F C A D L K
H J F C A D L E
H J E C A F D K
H E F C A D L I
H E F C A D I K
H J E C A F D I
C G E D A F L K
C G J D A F L E
C G J D A F E K
C G E D A F L I
C G E D A F I K
C G J D A F E I
H G F C A D L E
H G E C A F D K
H G J C A F D E
H G E C A F D I
H J B A I G L K
H J B A I F L K
I J B F A G L K
H J B F A G L K
H G B A I F L K
H J B F A G L I
H J B F A G I K
E J B A I H L K
E J B A I G L K
E J B A H G L K
E G B A I H L K
E J B A H G L I
E J B A H G I K
E J B A I F L K
E J B F A H L K
E I B F A H L K
E J B F A H L I
E J B F A H I K
E J B F A G L K
E G B A I F L K
E J B F A G L I
E J B F A G I K
E G B F A H L K
H J B F A G L E
H J B F A G E K
E G B F A H L I
E G B F A H I K
H J B F A G E I
I J B D A H L K
I J B D A G L K
H J B D A G L K
I G B D A H L K
H J B D A G L I
H J B D A G I K
I J B D A F L K
H J B D A F L K
H I B D A F L K
H J B D A F L I
H J B D A F I K
F J B D A G L K
I G B D A F L K
F J B D A G L I
F J B D A G I K
H G B D A F L K
H G B D A F L J
H G B D A F J K
H G B D A F L I
H G B D A F I K
H G B D A F I J
E J B A I D L K
E J B D A H L K
E I B D A H L K
E J B D A H L I
E J B D A H I K
E J B D A G L K
E G B A I D L K
E J B D A G L I
E J B D A G I K
E G B D A H L K
H J B D A G L E
H J B D A G E K
E G B D A H L I
E G B D A H I K
H J B D A G E I
E J B D A F L K
E I B D A F L K
E J B D A F L I
E J B D A F I K
H E B D A F L K
H J B D A F L E
H J B D A F E K
H E B D A F L I
H E B D A F I K
H J B D A F E I
E G B D A F L K
E G B D A F L J
E G B D A F J K
E G B D A F L I
E G B D A F I K
E G B D A F I J
H G B D A F L E
H G B D A F E K
H G B D A F E J
H G B D A F E I
I J B C A H L K
I J B C A G L K
H J B C A G L K
I G B C A H L K
H J B C A G L I
H J B C A G I K
I J B C A F L K
H J B C A F L K
H I B C A F L K
H J B C A F L I
H J B C A F I K
C J B F A G L K
I G B C A F L K
C J B F A G L I
C J B F A G I K
H G B C A F L K
H G B C A F L J
H G B C A F J K
H G B C A F L I
H G B C A F I K
H G B C A F I J
E J B A I C L K
E J B C A H L K
E I B C A H L K
E J B C A H L I
E J B C A H I K
E J B C A G L K
E G B A I C L K
E J B C A G L I
E J B C A G I K
E G B C A H L K
H J B C A G L E
H J B C A G E K
E G B C A H L I
E G B C A H I K
H J B C A G E I
E J B C A F L K
E I B C A F L K
E J B C A F L I
E J B C A F I K
H E B C A F L K
H J B C A F L E
H J B C A F E K
H E B C A F L I
H E B C A F I K
H J B C A F E I
E G B C A F L K
E G B C A F L J
E G B C A F J K
E G B C A F L I
E G B C A F I K
E G B C A F I J
H G B C A F L E
H G B C A F E K
H G B C A F E J
H G B C A F E I
I J B C A D L K
H J B C A D L K
H I B C A D L K
H J B C A D L I
H J B C A D I K
C J B D A G L K
I G B C A D L K
C J B D A G L I
C J B D A G I K
H G B C A D L K
H G B C A D L J
H G B C A D J K
H G B C A D L I
H G B C A D I K
H G B C A D I J
C J B D A F L K
C I B D A F L K
C J B D A F L I
C J B D A F I K
H F B C A D L K
C J B D A F L H
H J B C A F D K
H F B C A D L I
H F B C A D I K
H J B C A F D I
C G B D A F L K
C G B D A F L J
C G B D A F J K
C G B D A F L I
C G B D A F I K
C G B D A F I J
C G B D A F L H
H G B C A F D K
H G B C A F D J
H G B C A F D I
E J B C A D L K
E I B C A D L K
E J B C A D L I
E J B C A D I K
H E B C A D L K
H J B C A D L E
H J B C A D E K
H E B C A D L I
H E B C A D I K
H J B C A D E I
E G B C A D L K
E G B C A D L J
E G B C A D J K
E G B C A D L I
E G B C A D I K
E G B C A D I J
H G B C A D L E
H G B C A D E K
H G B C A D E J
H G B C A D E I
C E B D A F L K
C J B D A F L E
C J B D A F E K
C E B D A F L I
C E B D A F I K
C J B D A F E I
H F B C A D L E
H E B C A F D K
H J B C A F D E
H E B C A F D I
C G B D A F L E
C G B D A F E K
C G B D A F E J
C G B D A F E I
H G B C A F D E`

// Build lookup: sorted qualifying groups → [grp_for_1A, grp_for_1B, grp_for_1D, grp_for_1E, grp_for_1G, grp_for_1I, grp_for_1K, grp_for_1L]
const FIFA_THIRD_PLACE_TABLE = {}
for (const row of _FIFA_RAW.trim().split('\n')) {
  const slots = row.trim().split(/\s+/)          // 8 single-letter group codes
  const key   = [...slots].sort().join('')        // e.g. 'EFGHIJKL'
  FIFA_THIRD_PLACE_TABLE[key] = slots
}

// Column index → slot source key used in knockout_slots.away_source
// Order matches the header: 1A | 1B | 1D | 1E | 1G | 1I | 1K | 1L
const THIRD_SLOT_KEYS = [
  '3rd_vs_1A',  // col 0 → match 79 (R32-07)
  '3rd_vs_1B',  // col 1 → match 85 (R32-13)
  '3rd_vs_1D',  // col 2 → match 81 (R32-09)
  '3rd_vs_1E',  // col 3 → match 74 (R32-02)
  '3rd_vs_1G',  // col 4 → match 82 (R32-10)
  '3rd_vs_1I',  // col 5 → match 77 (R32-05)
  '3rd_vs_1K',  // col 6 → match 87 (R32-15)
  '3rd_vs_1L',  // col 7 → match 80 (R32-08)
]

// Pure: given an array of { home_team_id, away_team_id, home_goals, away_goals }
// returns standings sorted by pts → gd → gf
export function calculateGroupTable(matches) {
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

// Returns a position-label → team_id map for seeding the real knockout bracket.
//
// Regular slots : { '1A': uuid, '2A': uuid, ... }
// 3rd-place slots: { '3rd_vs_1A': uuid, '3rd_vs_1B': uuid, ... }
//   Keys match knockout_slots.away_source for R32 3rd-place slots.
//
// Uses the official FIFA 495-combination table (Annex C) to assign each
// qualifying third-place team to the correct R32 slot.
//
// Accepts optional db and groups list for testing.
export async function getRealQualifiersMap(db = pool, groups = GROUPS) {
  const client = await db.connect()
  try {
    const map = {}
    const thirdPlaced = []

    for (const group of groups) {
      const table = await deriveRealGroupTable(group, client)
      table.forEach((entry, i) => {
        // Store all positions: '1A', '2A', '3A', '4A', etc.
        map[`${i + 1}${group}`] = entry.team_id
        if (i === 2) {
          thirdPlaced.push({ group, team_id: entry.team_id, pts: entry.pts, gd: entry.gd, gf: entry.gf })
        }
      })
    }

    // Rank all 12 thirds, take top 8
    const top8 = thirdPlaced
      .sort((a, b) => b.pts - a.pts || b.gd - a.gd || b.gf - a.gf)
      .slice(0, 8)

    // Look up the FIFA assignment table
    const qualifyingKey = top8.map(t => t.group).sort().join('')
    const assignment = FIFA_THIRD_PLACE_TABLE[qualifyingKey]

    if (!assignment) {
      throw new Error(`No FIFA third-place assignment found for qualifying groups: ${qualifyingKey}`)
    }

    // assignment[i] = group letter whose 3rd-place team goes to THIRD_SLOT_KEYS[i]
    for (let i = 0; i < 8; i++) {
      const group = assignment[i]          // e.g. 'E'
      map[THIRD_SLOT_KEYS[i]] = map[`3${group}`]  // '3E' → team_id
    }

    return map
  } finally {
    client.release()
  }
}

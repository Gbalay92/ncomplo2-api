/**
 * Creates a fake DB pool for testing.
 *
 * Usage:
 *   const db = fakeDb([
 *     { rows: [{ real_home_goals: 2, real_away_goals: 1 }] },
 *     { rows: [{ points_sign: 2, points_exact: 3 }] },
 *     ...
 *   ])
 *
 * Each call to client.query() or db.query() consumes the next response in the queue.
 * Calls to BEGIN / COMMIT / ROLLBACK / DELETE are always no-ops.
 * UPDATE queries that return rows are tracked in db.updates.
 * After the test, db.inserts contains all rows passed to INSERT statements.
 */
export function fakeDb(queryResponses = []) {
  const queue = [...queryResponses]
  const inserts = []
  const updates = []
  const deletes = []
  let began = false
  let committed = false
  let rolledBack = false

  const query = async (sql, params = []) => {
    const s = sql.trim().toUpperCase()
    if (s.startsWith('BEGIN'))    { began = true;      return { rows: [] } }
    if (s.startsWith('COMMIT'))   { committed = true;  return { rows: [] } }
    if (s.startsWith('ROLLBACK')) { rolledBack = true; return { rows: [] } }
    if (s.startsWith('DELETE'))   { deletes.push(params); return { rows: [] } }
    if (s.startsWith('INSERT')) {
      inserts.push(params)
      return { rows: [] }
    }
    if (s.startsWith('UPDATE')) {
      const next = queue.shift()
      if (!next) throw new Error(`fakeDb: unexpected UPDATE query:\n${sql}`)
      updates.push({ sql, params, result: next })
      return next
    }
    const next = queue.shift()
    if (!next) throw new Error(`fakeDb: unexpected query:\n${sql}`)
    return next
  }

  const client = {
    inserts,
    updates,
    deletes,
    query,
    release: () => {},
    get began()      { return began },
    get committed()  { return committed },
    get rolledBack() { return rolledBack },
  }

  return {
    connect: async () => client,
    query,   // pool-level direct queries (no transaction)
    inserts,
    updates,
    deletes,
  }
}

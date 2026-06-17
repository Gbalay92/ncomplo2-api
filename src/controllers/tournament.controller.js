import pool from '../db/pool.js'

export async function getSettings(req, res) {
  const [{ rows: s }, { rows: r }] = await Promise.all([
    pool.query('SELECT predictions_locked, group_stage_locked FROM tournament_settings WHERE id = true'),
    pool.query("SELECT points_sign, points_exact FROM scoring_rules WHERE stage = 'group'"),
  ])
  const settings = s[0] ?? { predictions_locked: false, group_stage_locked: false }
  const rules = r[0] ?? { points_sign: 2, points_exact: 1 }
  res.json({ ...settings, points_sign: rules.points_sign, points_exact: rules.points_exact })
}

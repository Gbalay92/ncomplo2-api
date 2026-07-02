import pool from '../db/pool.js'

export async function getSettings(req, res) {
  const { rows: s } = await pool.query(
    'SELECT predictions_locked, group_stage_locked FROM tournament_settings WHERE id = true'
  )
  const settings = s[0] ?? { predictions_locked: false, group_stage_locked: false }

  let points_sign = 2, points_exact = 1
  try {
    const { rows: r } = await pool.query("SELECT points_sign, points_exact FROM scoring_rules WHERE stage = 'group'")
    if (r[0]) { points_sign = r[0].points_sign; points_exact = r[0].points_exact }
  } catch {}

  res.json({ ...settings, points_sign, points_exact })
}

-- ============================================================
--  World Cup 2026 — Group Stage Seed
--  48 teams, 72 matches (12 groups × 6 matches each)
--  All times in UTC, converted from official EDT (UTC-4) schedule.
-- ============================================================

-- ── TEAMS ────────────────────────────────────────────────────
INSERT INTO teams (name, code, flag_url) VALUES
  ('Mexico',              'MEX', 'https://flagcdn.com/w40/mx.png'),
  ('South Africa',        'RSA', 'https://flagcdn.com/w40/za.png'),
  ('Korea Republic',      'KOR', 'https://flagcdn.com/w40/kr.png'),
  ('Czechia',             'CZE', 'https://flagcdn.com/w40/cz.png'),
  ('Canada',              'CAN', 'https://flagcdn.com/w40/ca.png'),
  ('Bosnia-Herzegovina',  'BIH', 'https://flagcdn.com/w40/ba.png'),
  ('Qatar',               'QAT', 'https://flagcdn.com/w40/qa.png'),
  ('Switzerland',         'SUI', 'https://flagcdn.com/w40/ch.png'),
  ('Brazil',              'BRA', 'https://flagcdn.com/w40/br.png'),
  ('Morocco',             'MAR', 'https://flagcdn.com/w40/ma.png'),
  ('Haiti',               'HAI', 'https://flagcdn.com/w40/ht.png'),
  ('Scotland',            'SCO', 'https://flagcdn.com/w40/gb-sct.png'),
  ('United States',       'USA', 'https://flagcdn.com/w40/us.png'),
  ('Paraguay',            'PAR', 'https://flagcdn.com/w40/py.png'),
  ('Australia',           'AUS', 'https://flagcdn.com/w40/au.png'),
  ('Türkiye',             'TUR', 'https://flagcdn.com/w40/tr.png'),
  ('Germany',             'GER', 'https://flagcdn.com/w40/de.png'),
  ('Curaçao',             'CUW', 'https://flagcdn.com/w40/cw.png'),
  ('Ivory Coast',         'CIV', 'https://flagcdn.com/w40/ci.png'),
  ('Ecuador',             'ECU', 'https://flagcdn.com/w40/ec.png'),
  ('Netherlands',         'NED', 'https://flagcdn.com/w40/nl.png'),
  ('Japan',               'JPN', 'https://flagcdn.com/w40/jp.png'),
  ('Sweden',              'SWE', 'https://flagcdn.com/w40/se.png'),
  ('Tunisia',             'TUN', 'https://flagcdn.com/w40/tn.png'),
  ('Belgium',             'BEL', 'https://flagcdn.com/w40/be.png'),
  ('Egypt',               'EGY', 'https://flagcdn.com/w40/eg.png'),
  ('Iran',                'IRN', 'https://flagcdn.com/w40/ir.png'),
  ('New Zealand',         'NZL', 'https://flagcdn.com/w40/nz.png'),
  ('Spain',               'ESP', 'https://flagcdn.com/w40/es.png'),
  ('Cape Verde',          'CPV', 'https://flagcdn.com/w40/cv.png'),
  ('Saudi Arabia',        'KSA', 'https://flagcdn.com/w40/sa.png'),
  ('Uruguay',             'URU', 'https://flagcdn.com/w40/uy.png'),
  ('France',              'FRA', 'https://flagcdn.com/w40/fr.png'),
  ('Senegal',             'SEN', 'https://flagcdn.com/w40/sn.png'),
  ('Iraq',                'IRQ', 'https://flagcdn.com/w40/iq.png'),
  ('Norway',              'NOR', 'https://flagcdn.com/w40/no.png'),
  ('Argentina',           'ARG', 'https://flagcdn.com/w40/ar.png'),
  ('Algeria',             'ALG', 'https://flagcdn.com/w40/dz.png'),
  ('Austria',             'AUT', 'https://flagcdn.com/w40/at.png'),
  ('Jordan',              'JOR', 'https://flagcdn.com/w40/jo.png'),
  ('Portugal',            'POR', 'https://flagcdn.com/w40/pt.png'),
  ('DR Congo',            'COD', 'https://flagcdn.com/w40/cd.png'),
  ('Uzbekistan',          'UZB', 'https://flagcdn.com/w40/uz.png'),
  ('Colombia',            'COL', 'https://flagcdn.com/w40/co.png'),
  ('England',             'ENG', 'https://flagcdn.com/w40/gb-eng.png'),
  ('Croatia',             'CRO', 'https://flagcdn.com/w40/hr.png'),
  ('Ghana',               'GHA', 'https://flagcdn.com/w40/gh.png'),
  ('Panama',              'PAN', 'https://flagcdn.com/w40/pa.png');

-- ── GROUP MATCHES ─────────────────────────────────────────────
-- Pattern per group:
--   MD1: 1v2, 3v4  |  MD2: 1v3, 2v4  |  MD3: 1v4, 2v3 (simultaneous)

-- ── GROUP A: Mexico / South Africa / Korea Republic / Czechia ──
INSERT INTO group_matches (match_number, group_name, home_team_id, away_team_id, match_date) VALUES
  (1,  'A', (SELECT id FROM teams WHERE code='MEX'), (SELECT id FROM teams WHERE code='RSA'), '2026-06-11 19:00:00+00'),
  (2,  'A', (SELECT id FROM teams WHERE code='KOR'), (SELECT id FROM teams WHERE code='CZE'), '2026-06-12 02:00:00+00'),
  (3,  'A', (SELECT id FROM teams WHERE code='MEX'), (SELECT id FROM teams WHERE code='KOR'), '2026-06-19 01:00:00+00'),
  (4,  'A', (SELECT id FROM teams WHERE code='RSA'), (SELECT id FROM teams WHERE code='CZE'), '2026-06-18 16:00:00+00'),
  (5,  'A', (SELECT id FROM teams WHERE code='MEX'), (SELECT id FROM teams WHERE code='CZE'), '2026-06-25 01:00:00+00'),
  (6,  'A', (SELECT id FROM teams WHERE code='RSA'), (SELECT id FROM teams WHERE code='KOR'), '2026-06-25 01:00:00+00');

-- ── GROUP B: Canada / Bosnia-Herzegovina / Qatar / Switzerland ──
INSERT INTO group_matches (match_number, group_name, home_team_id, away_team_id, match_date) VALUES
  (7,  'B', (SELECT id FROM teams WHERE code='CAN'), (SELECT id FROM teams WHERE code='BIH'), '2026-06-12 19:00:00+00'),
  (8,  'B', (SELECT id FROM teams WHERE code='QAT'), (SELECT id FROM teams WHERE code='SUI'), '2026-06-13 19:00:00+00'),
  (9,  'B', (SELECT id FROM teams WHERE code='CAN'), (SELECT id FROM teams WHERE code='QAT'), '2026-06-18 22:00:00+00'),
  (10, 'B', (SELECT id FROM teams WHERE code='BIH'), (SELECT id FROM teams WHERE code='SUI'), '2026-06-18 19:00:00+00'),
  (11, 'B', (SELECT id FROM teams WHERE code='CAN'), (SELECT id FROM teams WHERE code='SUI'), '2026-06-24 19:00:00+00'),
  (12, 'B', (SELECT id FROM teams WHERE code='BIH'), (SELECT id FROM teams WHERE code='QAT'), '2026-06-24 19:00:00+00');

-- ── GROUP C: Brazil / Morocco / Haiti / Scotland ──
INSERT INTO group_matches (match_number, group_name, home_team_id, away_team_id, match_date) VALUES
  (13, 'C', (SELECT id FROM teams WHERE code='BRA'), (SELECT id FROM teams WHERE code='MAR'), '2026-06-13 22:00:00+00'),
  (14, 'C', (SELECT id FROM teams WHERE code='HAI'), (SELECT id FROM teams WHERE code='SCO'), '2026-06-14 01:00:00+00'),
  (15, 'C', (SELECT id FROM teams WHERE code='BRA'), (SELECT id FROM teams WHERE code='HAI'), '2026-06-20 01:00:00+00'),
  (16, 'C', (SELECT id FROM teams WHERE code='MAR'), (SELECT id FROM teams WHERE code='SCO'), '2026-06-19 22:00:00+00'),
  (17, 'C', (SELECT id FROM teams WHERE code='BRA'), (SELECT id FROM teams WHERE code='SCO'), '2026-06-24 22:00:00+00'),
  (18, 'C', (SELECT id FROM teams WHERE code='MAR'), (SELECT id FROM teams WHERE code='HAI'), '2026-06-24 22:00:00+00');

-- ── GROUP D: United States / Paraguay / Australia / Türkiye ──
INSERT INTO group_matches (match_number, group_name, home_team_id, away_team_id, match_date) VALUES
  (19, 'D', (SELECT id FROM teams WHERE code='USA'), (SELECT id FROM teams WHERE code='PAR'), '2026-06-13 01:00:00+00'),
  (20, 'D', (SELECT id FROM teams WHERE code='AUS'), (SELECT id FROM teams WHERE code='TUR'), '2026-06-14 04:00:00+00'),
  (21, 'D', (SELECT id FROM teams WHERE code='USA'), (SELECT id FROM teams WHERE code='AUS'), '2026-06-19 19:00:00+00'),
  (22, 'D', (SELECT id FROM teams WHERE code='PAR'), (SELECT id FROM teams WHERE code='TUR'), '2026-06-20 03:00:00+00'),
  (23, 'D', (SELECT id FROM teams WHERE code='USA'), (SELECT id FROM teams WHERE code='TUR'), '2026-06-26 02:00:00+00'),
  (24, 'D', (SELECT id FROM teams WHERE code='PAR'), (SELECT id FROM teams WHERE code='AUS'), '2026-06-26 02:00:00+00');

-- ── GROUP E: Germany / Curaçao / Ivory Coast / Ecuador ──
INSERT INTO group_matches (match_number, group_name, home_team_id, away_team_id, match_date) VALUES
  (25, 'E', (SELECT id FROM teams WHERE code='GER'), (SELECT id FROM teams WHERE code='CUW'), '2026-06-14 17:00:00+00'),
  (26, 'E', (SELECT id FROM teams WHERE code='CIV'), (SELECT id FROM teams WHERE code='ECU'), '2026-06-14 23:00:00+00'),
  (27, 'E', (SELECT id FROM teams WHERE code='GER'), (SELECT id FROM teams WHERE code='CIV'), '2026-06-20 20:00:00+00'),
  (28, 'E', (SELECT id FROM teams WHERE code='CUW'), (SELECT id FROM teams WHERE code='ECU'), '2026-06-21 00:00:00+00'),
  (29, 'E', (SELECT id FROM teams WHERE code='GER'), (SELECT id FROM teams WHERE code='ECU'), '2026-06-25 20:00:00+00'),
  (30, 'E', (SELECT id FROM teams WHERE code='CUW'), (SELECT id FROM teams WHERE code='CIV'), '2026-06-25 20:00:00+00');

-- ── GROUP F: Netherlands / Japan / Sweden / Tunisia ──
INSERT INTO group_matches (match_number, group_name, home_team_id, away_team_id, match_date) VALUES
  (31, 'F', (SELECT id FROM teams WHERE code='NED'), (SELECT id FROM teams WHERE code='JPN'), '2026-06-14 20:00:00+00'),
  (32, 'F', (SELECT id FROM teams WHERE code='SWE'), (SELECT id FROM teams WHERE code='TUN'), '2026-06-15 02:00:00+00'),
  (33, 'F', (SELECT id FROM teams WHERE code='NED'), (SELECT id FROM teams WHERE code='SWE'), '2026-06-20 17:00:00+00'),
  (34, 'F', (SELECT id FROM teams WHERE code='JPN'), (SELECT id FROM teams WHERE code='TUN'), '2026-06-21 04:00:00+00'),
  (35, 'F', (SELECT id FROM teams WHERE code='NED'), (SELECT id FROM teams WHERE code='TUN'), '2026-06-25 23:00:00+00'),
  (36, 'F', (SELECT id FROM teams WHERE code='JPN'), (SELECT id FROM teams WHERE code='SWE'), '2026-06-25 23:00:00+00');

-- ── GROUP G: Belgium / Egypt / Iran / New Zealand ──
INSERT INTO group_matches (match_number, group_name, home_team_id, away_team_id, match_date) VALUES
  (37, 'G', (SELECT id FROM teams WHERE code='BEL'), (SELECT id FROM teams WHERE code='EGY'), '2026-06-15 19:00:00+00'),
  (38, 'G', (SELECT id FROM teams WHERE code='IRN'), (SELECT id FROM teams WHERE code='NZL'), '2026-06-16 01:00:00+00'),
  (39, 'G', (SELECT id FROM teams WHERE code='BEL'), (SELECT id FROM teams WHERE code='IRN'), '2026-06-21 19:00:00+00'),
  (40, 'G', (SELECT id FROM teams WHERE code='EGY'), (SELECT id FROM teams WHERE code='NZL'), '2026-06-22 01:00:00+00'),
  (41, 'G', (SELECT id FROM teams WHERE code='BEL'), (SELECT id FROM teams WHERE code='NZL'), '2026-06-27 03:00:00+00'),
  (42, 'G', (SELECT id FROM teams WHERE code='EGY'), (SELECT id FROM teams WHERE code='IRN'), '2026-06-27 03:00:00+00');

-- ── GROUP H: Spain / Cape Verde / Saudi Arabia / Uruguay ──
INSERT INTO group_matches (match_number, group_name, home_team_id, away_team_id, match_date) VALUES
  (43, 'H', (SELECT id FROM teams WHERE code='ESP'), (SELECT id FROM teams WHERE code='CPV'), '2026-06-15 16:00:00+00'),
  (44, 'H', (SELECT id FROM teams WHERE code='KSA'), (SELECT id FROM teams WHERE code='URU'), '2026-06-15 22:00:00+00'),
  (45, 'H', (SELECT id FROM teams WHERE code='ESP'), (SELECT id FROM teams WHERE code='KSA'), '2026-06-21 16:00:00+00'),
  (46, 'H', (SELECT id FROM teams WHERE code='CPV'), (SELECT id FROM teams WHERE code='URU'), '2026-06-21 22:00:00+00'),
  (47, 'H', (SELECT id FROM teams WHERE code='ESP'), (SELECT id FROM teams WHERE code='URU'), '2026-06-27 00:00:00+00'),
  (48, 'H', (SELECT id FROM teams WHERE code='CPV'), (SELECT id FROM teams WHERE code='KSA'), '2026-06-27 00:00:00+00');

-- ── GROUP I: France / Senegal / Iraq / Norway ──
INSERT INTO group_matches (match_number, group_name, home_team_id, away_team_id, match_date) VALUES
  (49, 'I', (SELECT id FROM teams WHERE code='FRA'), (SELECT id FROM teams WHERE code='SEN'), '2026-06-16 19:00:00+00'),
  (50, 'I', (SELECT id FROM teams WHERE code='IRQ'), (SELECT id FROM teams WHERE code='NOR'), '2026-06-16 22:00:00+00'),
  (51, 'I', (SELECT id FROM teams WHERE code='FRA'), (SELECT id FROM teams WHERE code='IRQ'), '2026-06-22 21:00:00+00'),
  (52, 'I', (SELECT id FROM teams WHERE code='SEN'), (SELECT id FROM teams WHERE code='NOR'), '2026-06-23 00:00:00+00'),
  (53, 'I', (SELECT id FROM teams WHERE code='FRA'), (SELECT id FROM teams WHERE code='NOR'), '2026-06-26 19:00:00+00'),
  (54, 'I', (SELECT id FROM teams WHERE code='SEN'), (SELECT id FROM teams WHERE code='IRQ'), '2026-06-26 19:00:00+00');

-- ── GROUP J: Argentina / Algeria / Austria / Jordan ──
INSERT INTO group_matches (match_number, group_name, home_team_id, away_team_id, match_date) VALUES
  (55, 'J', (SELECT id FROM teams WHERE code='ARG'), (SELECT id FROM teams WHERE code='ALG'), '2026-06-17 01:00:00+00'),
  (56, 'J', (SELECT id FROM teams WHERE code='AUT'), (SELECT id FROM teams WHERE code='JOR'), '2026-06-17 04:00:00+00'),
  (57, 'J', (SELECT id FROM teams WHERE code='ARG'), (SELECT id FROM teams WHERE code='AUT'), '2026-06-22 17:00:00+00'),
  (58, 'J', (SELECT id FROM teams WHERE code='ALG'), (SELECT id FROM teams WHERE code='JOR'), '2026-06-23 03:00:00+00'),
  (59, 'J', (SELECT id FROM teams WHERE code='ARG'), (SELECT id FROM teams WHERE code='JOR'), '2026-06-28 02:00:00+00'),
  (60, 'J', (SELECT id FROM teams WHERE code='ALG'), (SELECT id FROM teams WHERE code='AUT'), '2026-06-28 02:00:00+00');

-- ── GROUP K: Portugal / DR Congo / Uzbekistan / Colombia ──
INSERT INTO group_matches (match_number, group_name, home_team_id, away_team_id, match_date) VALUES
  (61, 'K', (SELECT id FROM teams WHERE code='POR'), (SELECT id FROM teams WHERE code='COD'), '2026-06-17 17:00:00+00'),
  (62, 'K', (SELECT id FROM teams WHERE code='UZB'), (SELECT id FROM teams WHERE code='COL'), '2026-06-18 02:00:00+00'),
  (63, 'K', (SELECT id FROM teams WHERE code='POR'), (SELECT id FROM teams WHERE code='UZB'), '2026-06-23 17:00:00+00'),
  (64, 'K', (SELECT id FROM teams WHERE code='COD'), (SELECT id FROM teams WHERE code='COL'), '2026-06-24 02:00:00+00'),
  (65, 'K', (SELECT id FROM teams WHERE code='POR'), (SELECT id FROM teams WHERE code='COL'), '2026-06-27 23:30:00+00'),
  (66, 'K', (SELECT id FROM teams WHERE code='COD'), (SELECT id FROM teams WHERE code='UZB'), '2026-06-27 23:30:00+00');

-- ── GROUP L: England / Croatia / Ghana / Panama ──
INSERT INTO group_matches (match_number, group_name, home_team_id, away_team_id, match_date) VALUES
  (67, 'L', (SELECT id FROM teams WHERE code='ENG'), (SELECT id FROM teams WHERE code='CRO'), '2026-06-17 20:00:00+00'),
  (68, 'L', (SELECT id FROM teams WHERE code='GHA'), (SELECT id FROM teams WHERE code='PAN'), '2026-06-17 23:00:00+00'),
  (69, 'L', (SELECT id FROM teams WHERE code='ENG'), (SELECT id FROM teams WHERE code='GHA'), '2026-06-23 20:00:00+00'),
  (70, 'L', (SELECT id FROM teams WHERE code='CRO'), (SELECT id FROM teams WHERE code='PAN'), '2026-06-23 23:00:00+00'),
  (71, 'L', (SELECT id FROM teams WHERE code='ENG'), (SELECT id FROM teams WHERE code='PAN'), '2026-06-27 21:00:00+00'),
  (72, 'L', (SELECT id FROM teams WHERE code='CRO'), (SELECT id FROM teams WHERE code='GHA'), '2026-06-27 21:00:00+00');

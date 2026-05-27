-- Migration 003: Fix Round of 32 bracket matchups
--
-- Updates knockout_slots to reflect the real FIFA World Cup 2026 bracket:
--   - Correct home_source / away_source for all 16 R32 slots
--   - 3rd-place slots now use '3rd_vs_1X' sources (resolved via FIFA Annex C table)
--   - Updated match dates (group stage ends ~June 27; R32 runs June 28 – July 3)
--
-- Match 76 source: was "1E vs 2F" (typo in original draft) → corrected to "1C vs 2F"

UPDATE knockout_slots SET
  match_date    = '2026-06-28 21:00:00+00',
  home_source   = '2A',
  away_source   = '2B'
WHERE slot_label = 'R32-01';

UPDATE knockout_slots SET
  match_date    = '2026-06-29 18:00:00+00',
  home_source   = '1E',
  away_source   = '3rd_vs_1E'
WHERE slot_label = 'R32-02';

UPDATE knockout_slots SET
  match_date    = '2026-06-29 21:00:00+00',
  home_source   = '1F',
  away_source   = '2C'
WHERE slot_label = 'R32-03';

UPDATE knockout_slots SET
  match_date    = '2026-06-30 00:00:00+00',
  home_source   = '1C',
  away_source   = '2F'
WHERE slot_label = 'R32-04';

UPDATE knockout_slots SET
  match_date    = '2026-06-30 18:00:00+00',
  home_source   = '1I',
  away_source   = '3rd_vs_1I'
WHERE slot_label = 'R32-05';

UPDATE knockout_slots SET
  match_date    = '2026-06-30 21:00:00+00',
  home_source   = '2E',
  away_source   = '2I'
WHERE slot_label = 'R32-06';

UPDATE knockout_slots SET
  match_date    = '2026-07-01 00:00:00+00',
  home_source   = '1A',
  away_source   = '3rd_vs_1A'
WHERE slot_label = 'R32-07';

UPDATE knockout_slots SET
  match_date    = '2026-07-01 18:00:00+00',
  home_source   = '1L',
  away_source   = '3rd_vs_1L'
WHERE slot_label = 'R32-08';

UPDATE knockout_slots SET
  match_date    = '2026-07-01 21:00:00+00',
  home_source   = '1D',
  away_source   = '3rd_vs_1D'
WHERE slot_label = 'R32-09';

UPDATE knockout_slots SET
  match_date    = '2026-07-02 00:00:00+00',
  home_source   = '1G',
  away_source   = '3rd_vs_1G'
WHERE slot_label = 'R32-10';

UPDATE knockout_slots SET
  match_date    = '2026-07-02 18:00:00+00',
  home_source   = '2K',
  away_source   = '2L'
WHERE slot_label = 'R32-11';

UPDATE knockout_slots SET
  match_date    = '2026-07-02 21:00:00+00',
  home_source   = '1H',
  away_source   = '2J'
WHERE slot_label = 'R32-12';

UPDATE knockout_slots SET
  match_date    = '2026-07-03 00:00:00+00',
  home_source   = '1B',
  away_source   = '3rd_vs_1B'
WHERE slot_label = 'R32-13';

UPDATE knockout_slots SET
  match_date    = '2026-07-03 18:00:00+00',
  home_source   = '1J',
  away_source   = '2H'
WHERE slot_label = 'R32-14';

UPDATE knockout_slots SET
  match_date    = '2026-07-03 21:00:00+00',
  home_source   = '1K',
  away_source   = '3rd_vs_1K'
WHERE slot_label = 'R32-15';

UPDATE knockout_slots SET
  match_date    = '2026-07-04 00:00:00+00',
  home_source   = '2D',
  away_source   = '2G'
WHERE slot_label = 'R32-16';

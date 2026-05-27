-- Migration 003: Fix knockout bracket — R32 sources, R16/QF/SF sources and all dates
--
-- Changes vs original seed:
--   R32 : correct home_source/away_source for all 16 slots
--         3rd-place slots now use '3rd_vs_1X' (resolved via FIFA Annex C table)
--         match dates corrected to exact UTC kickoff times
--   R16 : all home_source/away_source were wrong (old seed used sequential pairs)
--         now reflect the real FIFA bracket draw
--         dates corrected
--   QF  : QF-02 and QF-03 home_source/away_source were swapped
--         dates corrected
--   SF  : dates corrected
--
-- UTC conversions (local times from official FIFA schedule):
--   PDT = UTC-7  |  CDT = UTC-5  |  EDT = UTC-4
--
-- Match 76 note: source was '1E vs 2F' (typo in original draft) → corrected to '1C vs 2F'

-- ── ROUND OF 32 ──────────────────────────────────────────────

UPDATE knockout_slots SET match_date = '2026-06-28 22:00:00+00', home_source = '2A',  away_source = '2B'           WHERE slot_label = 'R32-01';
UPDATE knockout_slots SET match_date = '2026-06-29 20:30:00+00', home_source = '1E',  away_source = '3rd_vs_1E'   WHERE slot_label = 'R32-02';
UPDATE knockout_slots SET match_date = '2026-06-30 02:00:00+00', home_source = '1F',  away_source = '2C'           WHERE slot_label = 'R32-03';
UPDATE knockout_slots SET match_date = '2026-06-29 18:00:00+00', home_source = '1C',  away_source = '2F'           WHERE slot_label = 'R32-04';
UPDATE knockout_slots SET match_date = '2026-06-30 21:00:00+00', home_source = '1I',  away_source = '3rd_vs_1I'   WHERE slot_label = 'R32-05';
UPDATE knockout_slots SET match_date = '2026-06-30 18:00:00+00', home_source = '2E',  away_source = '2I'           WHERE slot_label = 'R32-06';
UPDATE knockout_slots SET match_date = '2026-07-01 02:00:00+00', home_source = '1A',  away_source = '3rd_vs_1A'   WHERE slot_label = 'R32-07';
UPDATE knockout_slots SET match_date = '2026-07-01 16:00:00+00', home_source = '1L',  away_source = '3rd_vs_1L'   WHERE slot_label = 'R32-08';
UPDATE knockout_slots SET match_date = '2026-07-02 03:00:00+00', home_source = '1D',  away_source = '3rd_vs_1D'   WHERE slot_label = 'R32-09';
UPDATE knockout_slots SET match_date = '2026-07-01 23:00:00+00', home_source = '1G',  away_source = '3rd_vs_1G'   WHERE slot_label = 'R32-10';
UPDATE knockout_slots SET match_date = '2026-07-02 23:00:00+00', home_source = '2K',  away_source = '2L'           WHERE slot_label = 'R32-11';
UPDATE knockout_slots SET match_date = '2026-07-02 22:00:00+00', home_source = '1H',  away_source = '2J'           WHERE slot_label = 'R32-12';
UPDATE knockout_slots SET match_date = '2026-07-03 06:00:00+00', home_source = '1B',  away_source = '3rd_vs_1B'   WHERE slot_label = 'R32-13';
UPDATE knockout_slots SET match_date = '2026-07-03 22:00:00+00', home_source = '1J',  away_source = '2H'           WHERE slot_label = 'R32-14';
UPDATE knockout_slots SET match_date = '2026-07-04 02:30:00+00', home_source = '1K',  away_source = '3rd_vs_1K'   WHERE slot_label = 'R32-15';
UPDATE knockout_slots SET match_date = '2026-07-03 19:00:00+00', home_source = '2D',  away_source = '2G'           WHERE slot_label = 'R32-16';

-- ── ROUND OF 16 ──────────────────────────────────────────────

UPDATE knockout_slots SET match_date = '2026-07-04 21:00:00+00', home_source = 'R32-02', away_source = 'R32-05' WHERE slot_label = 'R16-01';
UPDATE knockout_slots SET match_date = '2026-07-04 18:00:00+00', home_source = 'R32-01', away_source = 'R32-03' WHERE slot_label = 'R16-02';
UPDATE knockout_slots SET match_date = '2026-07-05 20:00:00+00', home_source = 'R32-04', away_source = 'R32-06' WHERE slot_label = 'R16-03';
UPDATE knockout_slots SET match_date = '2026-07-06 01:00:00+00', home_source = 'R32-07', away_source = 'R32-08' WHERE slot_label = 'R16-04';
UPDATE knockout_slots SET match_date = '2026-07-06 20:00:00+00', home_source = 'R32-11', away_source = 'R32-12' WHERE slot_label = 'R16-05';
UPDATE knockout_slots SET match_date = '2026-07-07 03:00:00+00', home_source = 'R32-09', away_source = 'R32-10' WHERE slot_label = 'R16-06';
UPDATE knockout_slots SET match_date = '2026-07-07 16:00:00+00', home_source = 'R32-14', away_source = 'R32-16' WHERE slot_label = 'R16-07';
UPDATE knockout_slots SET match_date = '2026-07-07 23:00:00+00', home_source = 'R32-13', away_source = 'R32-15' WHERE slot_label = 'R16-08';

-- ── QUARTER-FINALS ───────────────────────────────────────────

UPDATE knockout_slots SET match_date = '2026-07-09 20:00:00+00', home_source = 'R16-01', away_source = 'R16-02' WHERE slot_label = 'QF-01';
UPDATE knockout_slots SET match_date = '2026-07-10 22:00:00+00', home_source = 'R16-05', away_source = 'R16-06' WHERE slot_label = 'QF-02';
UPDATE knockout_slots SET match_date = '2026-07-11 21:00:00+00', home_source = 'R16-03', away_source = 'R16-04' WHERE slot_label = 'QF-03';
UPDATE knockout_slots SET match_date = '2026-07-12 02:00:00+00', home_source = 'R16-07', away_source = 'R16-08' WHERE slot_label = 'QF-04';

-- ── SEMI-FINALS ──────────────────────────────────────────────

UPDATE knockout_slots SET match_date = '2026-07-14 20:00:00+00', home_source = 'QF-01', away_source = 'QF-02' WHERE slot_label = 'SF-01';
UPDATE knockout_slots SET match_date = '2026-07-15 19:00:00+00', home_source = 'QF-03', away_source = 'QF-04' WHERE slot_label = 'SF-02';

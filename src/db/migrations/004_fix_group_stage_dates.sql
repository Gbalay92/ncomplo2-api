-- Migration 004: Fix group stage match dates
--
-- All times corrected from official EDT (UTC-4) schedule.
-- Only match_date is updated — home/away order unchanged.
--
-- Matches already correct (no update needed): 1, 7, 25, 32, 61

-- ── GROUP A ──────────────────────────────────────────────────────
-- Match 1: MEX vs RSA  Jun 11 15:00 EDT = 19:00 UTC  ✓
UPDATE group_matches SET match_date = '2026-06-12 02:00:00+00' WHERE match_number = 2;  -- Jun 11 22:00 EDT
UPDATE group_matches SET match_date = '2026-06-19 01:00:00+00' WHERE match_number = 3;  -- Jun 18 21:00 EDT
UPDATE group_matches SET match_date = '2026-06-18 16:00:00+00' WHERE match_number = 4;  -- Jun 18 12:00 EDT
UPDATE group_matches SET match_date = '2026-06-25 01:00:00+00' WHERE match_number = 5;  -- Jun 24 21:00 EDT
UPDATE group_matches SET match_date = '2026-06-25 01:00:00+00' WHERE match_number = 6;  -- Jun 24 21:00 EDT

-- ── GROUP B ──────────────────────────────────────────────────────
-- Match 7: CAN vs BIH  Jun 12 15:00 EDT = 19:00 UTC  ✓
UPDATE group_matches SET match_date = '2026-06-13 19:00:00+00' WHERE match_number = 8;  -- Jun 13 15:00 EDT
UPDATE group_matches SET match_date = '2026-06-18 22:00:00+00' WHERE match_number = 9;  -- Jun 18 18:00 EDT
UPDATE group_matches SET match_date = '2026-06-18 19:00:00+00' WHERE match_number = 10; -- Jun 18 15:00 EDT
UPDATE group_matches SET match_date = '2026-06-24 19:00:00+00' WHERE match_number = 11; -- Jun 24 15:00 EDT
UPDATE group_matches SET match_date = '2026-06-24 19:00:00+00' WHERE match_number = 12; -- Jun 24 15:00 EDT

-- ── GROUP C ──────────────────────────────────────────────────────
UPDATE group_matches SET match_date = '2026-06-13 22:00:00+00' WHERE match_number = 13; -- Jun 13 18:00 EDT
UPDATE group_matches SET match_date = '2026-06-14 01:00:00+00' WHERE match_number = 14; -- Jun 13 21:00 EDT
UPDATE group_matches SET match_date = '2026-06-20 01:00:00+00' WHERE match_number = 15; -- Jun 19 21:00 EDT
UPDATE group_matches SET match_date = '2026-06-19 22:00:00+00' WHERE match_number = 16; -- Jun 19 18:00 EDT
UPDATE group_matches SET match_date = '2026-06-24 22:00:00+00' WHERE match_number = 17; -- Jun 24 18:00 EDT
UPDATE group_matches SET match_date = '2026-06-24 22:00:00+00' WHERE match_number = 18; -- Jun 24 18:00 EDT

-- ── GROUP D ──────────────────────────────────────────────────────
UPDATE group_matches SET match_date = '2026-06-13 01:00:00+00' WHERE match_number = 19; -- Jun 12 21:00 EDT
UPDATE group_matches SET match_date = '2026-06-14 04:00:00+00' WHERE match_number = 20; -- Jun 13 00:00 EDT (midnight → Jun 14)
UPDATE group_matches SET match_date = '2026-06-19 19:00:00+00' WHERE match_number = 21; -- Jun 19 15:00 EDT
UPDATE group_matches SET match_date = '2026-06-20 04:00:00+00' WHERE match_number = 22; -- Jun 19 00:00 EDT (midnight → Jun 20)
UPDATE group_matches SET match_date = '2026-06-26 02:00:00+00' WHERE match_number = 23; -- Jun 25 22:00 EDT
UPDATE group_matches SET match_date = '2026-06-26 02:00:00+00' WHERE match_number = 24; -- Jun 25 22:00 EDT

-- ── GROUP E ──────────────────────────────────────────────────────
-- Match 25: GER vs CUW  Jun 14 13:00 EDT = 17:00 UTC  ✓
UPDATE group_matches SET match_date = '2026-06-14 23:00:00+00' WHERE match_number = 26; -- Jun 14 19:00 EDT
UPDATE group_matches SET match_date = '2026-06-20 20:00:00+00' WHERE match_number = 27; -- Jun 20 16:00 EDT
UPDATE group_matches SET match_date = '2026-06-21 02:00:00+00' WHERE match_number = 28; -- Jun 20 22:00 EDT
UPDATE group_matches SET match_date = '2026-06-25 20:00:00+00' WHERE match_number = 29; -- Jun 25 16:00 EDT
UPDATE group_matches SET match_date = '2026-06-25 20:00:00+00' WHERE match_number = 30; -- Jun 25 16:00 EDT

-- ── GROUP F ──────────────────────────────────────────────────────
UPDATE group_matches SET match_date = '2026-06-14 20:00:00+00' WHERE match_number = 31; -- Jun 14 16:00 EDT
-- Match 32: SWE vs TUN  Jun 14 22:00 EDT = Jun 15 02:00 UTC  ✓
UPDATE group_matches SET match_date = '2026-06-20 17:00:00+00' WHERE match_number = 33; -- Jun 20 13:00 EDT
UPDATE group_matches SET match_date = '2026-06-21 04:00:00+00' WHERE match_number = 34; -- Jun 20 00:00 EDT (midnight → Jun 21)
UPDATE group_matches SET match_date = '2026-06-25 23:00:00+00' WHERE match_number = 35; -- Jun 25 19:00 EDT
UPDATE group_matches SET match_date = '2026-06-25 23:00:00+00' WHERE match_number = 36; -- Jun 25 19:00 EDT

-- ── GROUP G ──────────────────────────────────────────────────────
UPDATE group_matches SET match_date = '2026-06-15 19:00:00+00' WHERE match_number = 37; -- Jun 15 15:00 EDT
UPDATE group_matches SET match_date = '2026-06-16 01:00:00+00' WHERE match_number = 38; -- Jun 15 21:00 EDT
UPDATE group_matches SET match_date = '2026-06-21 19:00:00+00' WHERE match_number = 39; -- Jun 21 15:00 EDT
UPDATE group_matches SET match_date = '2026-06-22 01:00:00+00' WHERE match_number = 40; -- Jun 21 21:00 EDT
UPDATE group_matches SET match_date = '2026-06-27 03:00:00+00' WHERE match_number = 41; -- Jun 26 23:00 EDT
UPDATE group_matches SET match_date = '2026-06-27 03:00:00+00' WHERE match_number = 42; -- Jun 26 23:00 EDT

-- ── GROUP H ──────────────────────────────────────────────────────
UPDATE group_matches SET match_date = '2026-06-15 16:00:00+00' WHERE match_number = 43; -- Jun 15 12:00 EDT
UPDATE group_matches SET match_date = '2026-06-15 22:00:00+00' WHERE match_number = 44; -- Jun 15 18:00 EDT
UPDATE group_matches SET match_date = '2026-06-21 16:00:00+00' WHERE match_number = 45; -- Jun 21 12:00 EDT
UPDATE group_matches SET match_date = '2026-06-21 22:00:00+00' WHERE match_number = 46; -- Jun 21 18:00 EDT
UPDATE group_matches SET match_date = '2026-06-27 00:00:00+00' WHERE match_number = 47; -- Jun 26 20:00 EDT
UPDATE group_matches SET match_date = '2026-06-27 00:00:00+00' WHERE match_number = 48; -- Jun 26 20:00 EDT

-- ── GROUP I ──────────────────────────────────────────────────────
UPDATE group_matches SET match_date = '2026-06-16 19:00:00+00' WHERE match_number = 49; -- Jun 16 15:00 EDT
UPDATE group_matches SET match_date = '2026-06-16 22:00:00+00' WHERE match_number = 50; -- Jun 16 18:00 EDT
UPDATE group_matches SET match_date = '2026-06-22 21:00:00+00' WHERE match_number = 51; -- Jun 22 17:00 EDT
UPDATE group_matches SET match_date = '2026-06-23 00:00:00+00' WHERE match_number = 52; -- Jun 22 20:00 EDT
UPDATE group_matches SET match_date = '2026-06-26 19:00:00+00' WHERE match_number = 53; -- Jun 26 15:00 EDT
UPDATE group_matches SET match_date = '2026-06-26 19:00:00+00' WHERE match_number = 54; -- Jun 26 15:00 EDT

-- ── GROUP J ──────────────────────────────────────────────────────
UPDATE group_matches SET match_date = '2026-06-17 01:00:00+00' WHERE match_number = 55; -- Jun 16 21:00 EDT
UPDATE group_matches SET match_date = '2026-06-17 04:00:00+00' WHERE match_number = 56; -- Jun 16 00:00 EDT (midnight → Jun 17)
UPDATE group_matches SET match_date = '2026-06-22 17:00:00+00' WHERE match_number = 57; -- Jun 22 13:00 EDT
UPDATE group_matches SET match_date = '2026-06-23 03:00:00+00' WHERE match_number = 58; -- Jun 22 23:00 EDT
UPDATE group_matches SET match_date = '2026-06-28 02:00:00+00' WHERE match_number = 59; -- Jun 27 22:00 EDT
UPDATE group_matches SET match_date = '2026-06-28 02:00:00+00' WHERE match_number = 60; -- Jun 27 22:00 EDT

-- ── GROUP K ──────────────────────────────────────────────────────
-- Match 61: POR vs COD  Jun 17 13:00 EDT = 17:00 UTC  ✓
UPDATE group_matches SET match_date = '2026-06-18 02:00:00+00' WHERE match_number = 62; -- Jun 17 22:00 EDT
UPDATE group_matches SET match_date = '2026-06-23 17:00:00+00' WHERE match_number = 63; -- Jun 23 13:00 EDT
UPDATE group_matches SET match_date = '2026-06-24 02:00:00+00' WHERE match_number = 64; -- Jun 23 22:00 EDT
UPDATE group_matches SET match_date = '2026-06-27 23:30:00+00' WHERE match_number = 65; -- Jun 27 19:30 EDT
UPDATE group_matches SET match_date = '2026-06-27 23:30:00+00' WHERE match_number = 66; -- Jun 27 19:30 EDT

-- ── GROUP L ──────────────────────────────────────────────────────
UPDATE group_matches SET match_date = '2026-06-17 20:00:00+00' WHERE match_number = 67; -- Jun 17 16:00 EDT
UPDATE group_matches SET match_date = '2026-06-17 23:00:00+00' WHERE match_number = 68; -- Jun 17 19:00 EDT
UPDATE group_matches SET match_date = '2026-06-23 20:00:00+00' WHERE match_number = 69; -- Jun 23 16:00 EDT
UPDATE group_matches SET match_date = '2026-06-23 23:00:00+00' WHERE match_number = 70; -- Jun 23 19:00 EDT
UPDATE group_matches SET match_date = '2026-06-27 21:00:00+00' WHERE match_number = 71; -- Jun 27 17:00 EDT
UPDATE group_matches SET match_date = '2026-06-27 21:00:00+00' WHERE match_number = 72; -- Jun 27 17:00 EDT

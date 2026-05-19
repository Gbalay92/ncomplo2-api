UPDATE scoring_rules SET points_sign = 2, points_exact = 3 WHERE stage = 'group';
UPDATE scoring_rules SET points_classify =  5 WHERE stage = 'round_of_32';
UPDATE scoring_rules SET points_classify = 10 WHERE stage = 'round_of_16';
UPDATE scoring_rules SET points_classify = 15 WHERE stage = 'quarter_final';
UPDATE scoring_rules SET points_classify = 25 WHERE stage = 'semi_final';
UPDATE scoring_rules SET points_classify = 35, points_champion = 50 WHERE stage = 'final';

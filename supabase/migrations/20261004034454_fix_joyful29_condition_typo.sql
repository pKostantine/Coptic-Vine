-- The risen verse (verse 4) of tenouosht, ekesmaroout and ethrenhosErok, and
-- of their NaiNan forms, named the 29th's flag as "Joyful 29". The space makes
-- the whole condition unparseable, which the app treats as false, so the verse
-- never showed. The annual verse deliberately steps aside on the same Sundays
-- (Sundays from the Apostles' Fast to the end of Hathor), so those Sundays had
-- no verse at all. The flag is Joyful29.
--
-- Updating the rows also marks their offline package dirty (the
-- chc_offline_dirty_* triggers), so the phone apps pick the fix up at the next
-- package publication.
update public.hymn_texts
set condition = replace(condition, 'Joyful 29', 'Joyful29')
where condition like '%Joyful 29%';

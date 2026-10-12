-- Where each reading came from, so the dashboard can label real vs test data:
--   pzem      real mains measurement (PZEM-004T)
--   laptop    real laptop power (battery sensor), relayed by the ESP32 over USB
--   test      made-up values from the firmware's TEST_MODE
--   simulated scripts/fake-device.js
-- Null on older rows and on seed data (is_seeded = true).
-- Run once in the Supabase SQL editor. Safe to re-run.

alter table public.readings
  add column if not exists source text
  check (source is null or source in ('pzem', 'laptop', 'test', 'simulated'));

-- Residential energy charge per unit (PKR), UNPROTECTED consumers.
-- Source: NEPRA uniform tariff, SRO 279(I)/2026 (effective Feb 2026), as published by
-- FESCO bill calculators (bijlibills.com, ebillpakistan.pk). Same rates for FESCO / all of Punjab.
-- Excludes fixed charges, fuel adjustment and taxes. Check against a real bill before relying on it.
-- Unprotected billing: ALL units are charged at the rate of the slab the total falls in
-- (SLAB_MODE = "single_rate" in lib/bill.js).
insert into public.tariff_slabs (id, min_units, max_units, rate_per_unit) values
  (1,   1,  100, 22.44),
  (2, 101,  200, 28.91),
  (3, 201,  300, 33.10),
  (4, 301,  400, 36.46),
  (5, 401,  500, 38.95),
  (6, 501,  600, 40.22),
  (7, 601,  700, 41.85),
  (8, 701, null, 47.20)
on conflict (id) do update set
  min_units = excluded.min_units,
  max_units = excluded.max_units,
  rate_per_unit = excluded.rate_per_unit;

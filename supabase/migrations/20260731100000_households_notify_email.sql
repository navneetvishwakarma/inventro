-- S-32/E-13: additive column for F14's email digest recipient. Nullable,
-- no write path yet (same precedent as households.monthly_budget, E-0) --
-- Settings (S-33/E-14) will add the UI to set it. Until then both digest
-- cron routes read this as null and skip sending honestly rather than
-- guessing a recipient.
alter table households add column notify_email text;

comment on column households.notify_email is
  'Recipient for F14 daily/weekly digest emails. Null until Settings (S-33/E-14) ships a write path -- digest routes skip sending honestly when unset.';

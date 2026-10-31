-- Adds the counter behind "sign out other sessions". A constant default makes this a quick,
-- additive change: existing rows start at 0, which every existing token already matches.
-- Fail fast instead of queueing every authenticated request behind a long transaction on "users".
-- If this times out, run the migration again when the table is quiet.
SET lock_timeout = '5s';
ALTER TABLE "users" ADD COLUMN "sessionVersion" INTEGER NOT NULL DEFAULT 0;
RESET lock_timeout;

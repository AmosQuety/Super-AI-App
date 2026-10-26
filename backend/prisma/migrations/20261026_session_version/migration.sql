-- Adds the counter behind "sign out other sessions". A constant default makes this a quick,
-- additive change: existing rows start at 0, which every existing token already matches.
ALTER TABLE "users" ADD COLUMN "sessionVersion" INTEGER NOT NULL DEFAULT 0;

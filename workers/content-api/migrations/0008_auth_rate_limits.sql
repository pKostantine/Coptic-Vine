-- Better Auth's rate limiter, kept in D1 so every Worker isolate counts the
-- same requests (workers/api/src/auth/index.ts, rateLimit.storage
-- 'database'). One row per limited key (an address and a path); last_request
-- is milliseconds since the epoch.
CREATE TABLE "auth.rate_limits" (
  "id" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "count" INTEGER NOT NULL,
  "last_request" INTEGER NOT NULL,
  PRIMARY KEY ("id")
) STRICT;
CREATE UNIQUE INDEX "auth.rate_limits_key_key" ON "auth.rate_limits" ("key");

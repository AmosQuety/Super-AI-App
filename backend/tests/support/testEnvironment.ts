// Import this first in tests that load the resolvers: some modules build a
// Supabase client when they are imported and fail if the variables are unset.
process.env.SUPABASE_URL = process.env.SUPABASE_URL || "http://127.0.0.1:54321";
process.env.SUPABASE_KEY = process.env.SUPABASE_KEY || "test-key-not-used";

// Tests must not depend on a developer's .env for the signing secret.
process.env.JWT_SECRET = process.env.JWT_SECRET || "test-only-signing-secret-that-is-long-enough-to-pass-validation";

// The webhook and chat tests stub the Redis methods on the client object; make sure the
// object exists even where no .env provides a URL. No command is ever sent to it.
process.env.REDIS_URL = process.env.REDIS_URL || "redis://127.0.0.1:6390";

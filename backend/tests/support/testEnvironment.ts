// Import this first in tests that load the resolvers: some modules build a
// Supabase client when they are imported and fail if the variables are unset.
process.env.SUPABASE_URL = process.env.SUPABASE_URL || "http://127.0.0.1:54321";
process.env.SUPABASE_KEY = process.env.SUPABASE_KEY || "test-key-not-used";

// Tests must not depend on a developer's .env for the signing secret.
process.env.JWT_SECRET = process.env.JWT_SECRET || "test-only-signing-secret-that-is-long-enough-to-pass-validation";

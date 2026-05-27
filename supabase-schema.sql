-- Run this in your Supabase SQL Editor
-- TODO: App does not currently implement multi-user ownership securely.
-- RLS must be enabled with proper auth checks before production use.
CREATE TABLE threads (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  messages JSONB NOT NULL DEFAULT '[]',
  "updatedAt" BIGINT NOT NULL
);

-- Enable Row Level Security (optional depending on your setup)
-- ALTER TABLE threads ENABLE ROW LEVEL SECURITY;

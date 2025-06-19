-- Create sessions table for PostgreSQL session store
CREATE TABLE IF NOT EXISTS sessions (
  sid VARCHAR NOT NULL PRIMARY KEY,
  sess JSON NOT NULL,
  expire TIMESTAMP(6) NOT NULL
);

-- Create index for session expiration
CREATE INDEX IF NOT EXISTS IDX_sessions_expire ON sessions (expire);
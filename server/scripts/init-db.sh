#!/bin/bash

# Create the database
createdb rylie

# Create the sessions table
psql -d rylie -c "
CREATE TABLE IF NOT EXISTS sessions (
  sid varchar NOT NULL COLLATE \"default\" PRIMARY KEY,
  sess json NOT NULL,
  expire timestamp(6) NOT NULL
);
"

# Create the users table with admin user
psql -d rylie -c "
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(255) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert default admin user (password: admin123)
INSERT INTO users (username, password) 
VALUES ('admin', '\$2b\$10\$3euPcmQFCiblsZeEXZgQXOzRYWGVsDxHCCzlWXZd1PrU558T4HS9K')
ON CONFLICT (username) DO NOTHING;
"

echo "Database initialized successfully!"

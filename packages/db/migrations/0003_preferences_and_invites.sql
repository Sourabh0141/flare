-- Migration: 0003_preferences_and_invites.sql
-- Description: Per-user voice and personality preferences, and a table for invite requests
-- submitted from the public site.

ALTER TABLE users ADD COLUMN voice TEXT;
ALTER TABLE users ADD COLUMN persona TEXT;

CREATE TABLE IF NOT EXISTS invite_requests (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    reason TEXT NOT NULL DEFAULT '',
    ip_hash TEXT,
    user_agent TEXT,
    created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_invite_requests_email ON invite_requests(email);
CREATE INDEX IF NOT EXISTS idx_invite_requests_created ON invite_requests(created_at DESC);

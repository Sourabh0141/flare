-- Migration: 0004_expression_language_organisation.sql
-- Description: Emotion intensity and spoken language per message, pinned and archived
-- conversations, and review status for invite requests.

ALTER TABLE messages ADD COLUMN intensity REAL;
ALTER TABLE messages ADD COLUMN language TEXT;

ALTER TABLE conversations ADD COLUMN pinned INTEGER NOT NULL DEFAULT 0;
ALTER TABLE conversations ADD COLUMN archived INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_conversations_user_list
ON conversations(user_id, archived, pinned DESC, updated_at DESC);

ALTER TABLE invite_requests ADD COLUMN status TEXT NOT NULL DEFAULT 'pending';
ALTER TABLE invite_requests ADD COLUMN reviewed_at INTEGER;

CREATE INDEX IF NOT EXISTS idx_invite_requests_status ON invite_requests(status, created_at DESC);

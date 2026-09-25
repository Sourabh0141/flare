-- Migration: 0002_message_expression.sql
-- Description: Persist the emotion and gesture chosen for each assistant reply so the
-- transcript view and audio replay can restore the character's expression.

ALTER TABLE messages ADD COLUMN emotion TEXT;
ALTER TABLE messages ADD COLUMN gesture TEXT;

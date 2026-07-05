-- Migration: Create chat_conversations table
-- Purpose: Store persistent chat history per user
-- Date: 2026-07-04

-- Create chat_conversations table
CREATE TABLE IF NOT EXISTS chat_conversations (
    id SERIAL PRIMARY KEY,
    user_id INTEGER,
    session_id VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL CHECK (role IN ('user', 'assistant')),
    content TEXT NOT NULL,
    context JSONB DEFAULT '{}',
    complexity VARCHAR(20),
    response_time_ms INTEGER,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_chat_user_session ON chat_conversations(user_id, session_id);
CREATE INDEX idx_chat_created_at ON chat_conversations(created_at DESC);
CREATE INDEX idx_chat_user_id ON chat_conversations(user_id);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_chat_conversations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_chat_conversations_updated_at
BEFORE UPDATE ON chat_conversations
FOR EACH ROW
EXECUTE FUNCTION update_chat_conversations_updated_at();

-- Comments
COMMENT ON TABLE chat_conversations IS 'Stores chat conversation history for each user';
COMMENT ON COLUMN chat_conversations.user_id IS 'User ID (nullable for anonymous)';
COMMENT ON COLUMN chat_conversations.session_id IS 'Unique session identifier (UUID)';
COMMENT ON COLUMN chat_conversations.role IS 'Message sender: user or assistant';
COMMENT ON COLUMN chat_conversations.content IS 'Message text content';
COMMENT ON COLUMN chat_conversations.context IS 'Additional context (businesses, documents returned)';
COMMENT ON COLUMN chat_conversations.complexity IS 'Query complexity: simple, semantic, complex';
COMMENT ON COLUMN chat_conversations.response_time_ms IS 'Response time in milliseconds';

-- ============================================
-- The Debate Guide - Quiz Persistence Schema
-- Uses dg_ prefix to avoid conflicts with superdebate.org tables
-- Run this in Supabase SQL Editor
-- ============================================

-- Enable UUID extension (may already exist)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- TABLES (with dg_ prefix)
-- ============================================

-- Users table (anonymous or authenticated)
CREATE TABLE IF NOT EXISTS dg_users (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    anonymous_id TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE,
    display_name TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    last_seen_at TIMESTAMPTZ DEFAULT NOW()
);

-- Quiz attempts table
CREATE TABLE IF NOT EXISTS dg_quiz_attempts (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES dg_users(id) ON DELETE CASCADE,
    chapter_number INTEGER NOT NULL CHECK (chapter_number >= 1 AND chapter_number <= 20),
    score INTEGER NOT NULL CHECK (score >= 0),
    total_questions INTEGER NOT NULL CHECK (total_questions > 0),
    percentage INTEGER NOT NULL CHECK (percentage >= 0 AND percentage <= 100),
    hints_used INTEGER DEFAULT 0 CHECK (hints_used >= 0),
    time_taken_seconds INTEGER,
    completed_at TIMESTAMPTZ DEFAULT NOW()
);

-- Individual question responses (for analytics)
CREATE TABLE IF NOT EXISTS dg_question_responses (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    attempt_id UUID REFERENCES dg_quiz_attempts(id) ON DELETE CASCADE,
    question_index INTEGER NOT NULL CHECK (question_index >= 0),
    question_type TEXT NOT NULL,
    question_text TEXT,
    user_answer JSONB,
    correct_answer JSONB,
    is_correct BOOLEAN NOT NULL,
    hints_used_for_question INTEGER DEFAULT 0
);

-- ============================================
-- INDEXES
-- ============================================

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_dg_users_anonymous_id ON dg_users(anonymous_id);
CREATE INDEX IF NOT EXISTS idx_dg_attempts_user_id ON dg_quiz_attempts(user_id);
CREATE INDEX IF NOT EXISTS idx_dg_attempts_chapter ON dg_quiz_attempts(chapter_number);
CREATE INDEX IF NOT EXISTS idx_dg_attempts_completed_at ON dg_quiz_attempts(completed_at);
CREATE INDEX IF NOT EXISTS idx_dg_responses_attempt_id ON dg_question_responses(attempt_id);
CREATE INDEX IF NOT EXISTS idx_dg_responses_correct ON dg_question_responses(is_correct);
CREATE INDEX IF NOT EXISTS idx_dg_responses_question_index ON dg_question_responses(question_index);

-- Composite indexes for common queries
CREATE INDEX IF NOT EXISTS idx_dg_attempts_user_chapter ON dg_quiz_attempts(user_id, chapter_number);
CREATE INDEX IF NOT EXISTS idx_dg_responses_attempt_correct ON dg_question_responses(attempt_id, is_correct);

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================

-- Enable RLS on all tables
ALTER TABLE dg_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE dg_quiz_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE dg_question_responses ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can insert users (for anonymous tracking)
CREATE POLICY "Allow anonymous user creation" ON dg_users
    FOR INSERT
    WITH CHECK (true);

-- Policy: Users can read their own data
CREATE POLICY "Users can read own data" ON dg_users
    FOR SELECT
    USING (true);

-- Policy: Allow updating users (for last_seen_at)
CREATE POLICY "Allow user updates" ON dg_users
    FOR UPDATE
    USING (true);

-- Policy: Allow inserting quiz attempts
CREATE POLICY "Allow quiz attempt insertion" ON dg_quiz_attempts
    FOR INSERT
    WITH CHECK (true);

-- Policy: Allow reading quiz attempts (for analytics)
CREATE POLICY "Allow reading quiz attempts" ON dg_quiz_attempts
    FOR SELECT
    USING (true);

-- Policy: Allow inserting question responses
CREATE POLICY "Allow question response insertion" ON dg_question_responses
    FOR INSERT
    WITH CHECK (true);

-- Policy: Allow reading question responses (for analytics)
CREATE POLICY "Allow reading question responses" ON dg_question_responses
    FOR SELECT
    USING (true);

-- ============================================
-- ADMIN FUNCTIONS (for dashboard)
-- ============================================

-- Function: Get overall stats
CREATE OR REPLACE FUNCTION dg_get_quiz_stats()
RETURNS JSON AS $$
BEGIN
    RETURN (
        SELECT json_build_object(
            'total_users', (SELECT COUNT(*) FROM dg_users),
            'total_attempts', (SELECT COUNT(*) FROM dg_quiz_attempts),
            'total_questions_answered', (SELECT COUNT(*) FROM dg_question_responses),
            'average_score', (SELECT ROUND(AVG(percentage)::numeric, 1) FROM dg_quiz_attempts),
            'pass_rate', (SELECT ROUND(
                (COUNT(*) FILTER (WHERE percentage >= 70)::numeric /
                NULLIF(COUNT(*)::numeric, 0)) * 100, 1
            ) FROM dg_quiz_attempts),
            'unique_chapters_attempted', (SELECT COUNT(DISTINCT chapter_number) FROM dg_quiz_attempts),
            'last_24h_attempts', (SELECT COUNT(*) FROM dg_quiz_attempts WHERE completed_at > NOW() - INTERVAL '24 hours'),
            'last_7d_attempts', (SELECT COUNT(*) FROM dg_quiz_attempts WHERE completed_at > NOW() - INTERVAL '7 days')
        )
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Get per-chapter stats
CREATE OR REPLACE FUNCTION dg_get_chapter_stats()
RETURNS JSON AS $$
BEGIN
    RETURN (
        SELECT json_agg(chapter_data ORDER BY chapter_number)
        FROM (
            SELECT
                chapter_number,
                COUNT(*) as attempts,
                COUNT(DISTINCT user_id) as unique_users,
                ROUND(AVG(percentage)::numeric, 1) as avg_score,
                ROUND(
                    (COUNT(*) FILTER (WHERE percentage >= 70)::numeric /
                    NULLIF(COUNT(*)::numeric, 0)) * 100, 1
                ) as pass_rate,
                MIN(percentage) as min_score,
                MAX(percentage) as max_score
            FROM dg_quiz_attempts
            GROUP BY chapter_number
        ) chapter_data
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Get question-level analytics
CREATE OR REPLACE FUNCTION dg_get_question_analytics(p_chapter INTEGER DEFAULT NULL)
RETURNS JSON AS $$
BEGIN
    RETURN (
        SELECT json_agg(question_data ORDER BY error_rate DESC)
        FROM (
            SELECT
                qa.chapter_number,
                qr.question_index,
                qr.question_type,
                qr.question_text,
                COUNT(*) as total_responses,
                COUNT(*) FILTER (WHERE qr.is_correct = false) as incorrect_count,
                ROUND(
                    (COUNT(*) FILTER (WHERE qr.is_correct = false)::numeric /
                    NULLIF(COUNT(*)::numeric, 0)) * 100, 1
                ) as error_rate,
                ROUND(AVG(qr.hints_used_for_question)::numeric, 2) as avg_hints_used
            FROM dg_question_responses qr
            JOIN dg_quiz_attempts qa ON qr.attempt_id = qa.id
            WHERE (p_chapter IS NULL OR qa.chapter_number = p_chapter)
            GROUP BY qa.chapter_number, qr.question_index, qr.question_type, qr.question_text
            HAVING COUNT(*) >= 3  -- Only include questions with at least 3 responses
        ) question_data
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Get wrong answer patterns
CREATE OR REPLACE FUNCTION dg_get_wrong_answer_patterns(p_chapter INTEGER DEFAULT NULL, p_limit INTEGER DEFAULT 20)
RETURNS JSON AS $$
BEGIN
    RETURN (
        SELECT json_agg(pattern_data)
        FROM (
            SELECT
                qa.chapter_number,
                qr.question_index,
                qr.question_text,
                qr.user_answer,
                qr.correct_answer,
                COUNT(*) as frequency
            FROM dg_question_responses qr
            JOIN dg_quiz_attempts qa ON qr.attempt_id = qa.id
            WHERE qr.is_correct = false
                AND (p_chapter IS NULL OR qa.chapter_number = p_chapter)
            GROUP BY qa.chapter_number, qr.question_index, qr.question_text, qr.user_answer, qr.correct_answer
            ORDER BY frequency DESC
            LIMIT p_limit
        ) pattern_data
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Get recent activity
CREATE OR REPLACE FUNCTION dg_get_recent_activity(p_limit INTEGER DEFAULT 50)
RETURNS JSON AS $$
BEGIN
    RETURN (
        SELECT json_agg(activity_data ORDER BY completed_at DESC)
        FROM (
            SELECT
                qa.id,
                qa.chapter_number,
                qa.score,
                qa.total_questions,
                qa.percentage,
                qa.hints_used,
                qa.completed_at,
                u.anonymous_id
            FROM dg_quiz_attempts qa
            JOIN dg_users u ON qa.user_id = u.id
            ORDER BY qa.completed_at DESC
            LIMIT p_limit
        ) activity_data
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- GRANT PERMISSIONS
-- ============================================

-- Grant execute on functions to anon and authenticated roles
GRANT EXECUTE ON FUNCTION dg_get_quiz_stats() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION dg_get_chapter_stats() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION dg_get_question_analytics(INTEGER) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION dg_get_wrong_answer_patterns(INTEGER, INTEGER) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION dg_get_recent_activity(INTEGER) TO anon, authenticated;

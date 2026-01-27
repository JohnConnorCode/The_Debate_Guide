/**
 * POST /api/admin/setup
 * One-time database schema setup
 * Creates all required tables and functions for the quiz system
 *
 * IMPORTANT: Delete this file after running setup successfully
 */

const { createClient } = require('@supabase/supabase-js');

const schema = `
-- Users table (anonymous or authenticated)
CREATE TABLE IF NOT EXISTS dg_users (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    anonymous_id TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    last_seen_at TIMESTAMPTZ DEFAULT NOW()
);

-- Quiz attempts table
CREATE TABLE IF NOT EXISTS dg_quiz_attempts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES dg_users(id) ON DELETE CASCADE,
    chapter_number INTEGER NOT NULL CHECK (chapter_number >= 1 AND chapter_number <= 20),
    score INTEGER NOT NULL CHECK (score >= 0),
    total_questions INTEGER NOT NULL CHECK (total_questions > 0),
    percentage INTEGER NOT NULL CHECK (percentage >= 0 AND percentage <= 100),
    hints_used INTEGER DEFAULT 0,
    time_taken_seconds INTEGER,
    completed_at TIMESTAMPTZ DEFAULT NOW()
);

-- Individual question responses for detailed analytics
CREATE TABLE IF NOT EXISTS dg_question_responses (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    attempt_id UUID REFERENCES dg_quiz_attempts(id) ON DELETE CASCADE,
    question_index INTEGER NOT NULL,
    question_type TEXT NOT NULL,
    question_text TEXT,
    user_answer JSONB,
    correct_answer JSONB,
    is_correct BOOLEAN NOT NULL,
    hints_used_for_question INTEGER DEFAULT 0
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_dg_attempts_user ON dg_quiz_attempts(user_id);
CREATE INDEX IF NOT EXISTS idx_dg_attempts_chapter ON dg_quiz_attempts(chapter_number);
CREATE INDEX IF NOT EXISTS idx_dg_attempts_completed ON dg_quiz_attempts(completed_at);
CREATE INDEX IF NOT EXISTS idx_dg_responses_attempt ON dg_question_responses(attempt_id);
CREATE INDEX IF NOT EXISTS idx_dg_responses_correct ON dg_question_responses(is_correct);
CREATE INDEX IF NOT EXISTS idx_dg_users_anonymous ON dg_users(anonymous_id);
`;

const functions = `
-- Function to get overall quiz statistics
CREATE OR REPLACE FUNCTION dg_get_quiz_stats()
RETURNS JSON AS $$
DECLARE
    result JSON;
BEGIN
    SELECT json_build_object(
        'total_users', (SELECT COUNT(*) FROM dg_users),
        'total_attempts', (SELECT COUNT(*) FROM dg_quiz_attempts),
        'unique_chapters_attempted', (SELECT COUNT(DISTINCT chapter_number) FROM dg_quiz_attempts),
        'avg_score', (SELECT ROUND(AVG(percentage)::numeric, 1) FROM dg_quiz_attempts),
        'pass_rate', (SELECT ROUND((COUNT(*) FILTER (WHERE percentage >= 70)::numeric / NULLIF(COUNT(*), 0) * 100)::numeric, 1) FROM dg_quiz_attempts),
        'total_questions_answered', (SELECT COUNT(*) FROM dg_question_responses),
        'overall_accuracy', (SELECT ROUND((COUNT(*) FILTER (WHERE is_correct)::numeric / NULLIF(COUNT(*), 0) * 100)::numeric, 1) FROM dg_question_responses)
    ) INTO result;
    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get per-chapter statistics
CREATE OR REPLACE FUNCTION dg_get_chapter_stats()
RETURNS TABLE (
    chapter_number INTEGER,
    attempts BIGINT,
    unique_users BIGINT,
    avg_score NUMERIC,
    pass_rate NUMERIC,
    min_score INTEGER,
    max_score INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        qa.chapter_number,
        COUNT(*)::BIGINT as attempts,
        COUNT(DISTINCT qa.user_id)::BIGINT as unique_users,
        ROUND(AVG(qa.percentage)::numeric, 1) as avg_score,
        ROUND((COUNT(*) FILTER (WHERE qa.percentage >= 70)::numeric / NULLIF(COUNT(*), 0) * 100)::numeric, 1) as pass_rate,
        MIN(qa.percentage) as min_score,
        MAX(qa.percentage) as max_score
    FROM dg_quiz_attempts qa
    GROUP BY qa.chapter_number
    ORDER BY qa.chapter_number;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get question-level analytics
CREATE OR REPLACE FUNCTION dg_get_question_analytics(p_chapter INTEGER DEFAULT NULL)
RETURNS TABLE (
    chapter_number INTEGER,
    question_index INTEGER,
    question_type TEXT,
    times_answered BIGINT,
    times_correct BIGINT,
    error_rate NUMERIC,
    avg_hints_used NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        qa.chapter_number,
        qr.question_index,
        qr.question_type,
        COUNT(*)::BIGINT as times_answered,
        COUNT(*) FILTER (WHERE qr.is_correct)::BIGINT as times_correct,
        ROUND((COUNT(*) FILTER (WHERE NOT qr.is_correct)::numeric / NULLIF(COUNT(*), 0) * 100)::numeric, 1) as error_rate,
        ROUND(AVG(qr.hints_used_for_question)::numeric, 2) as avg_hints_used
    FROM dg_question_responses qr
    JOIN dg_quiz_attempts qa ON qr.attempt_id = qa.id
    WHERE p_chapter IS NULL OR qa.chapter_number = p_chapter
    GROUP BY qa.chapter_number, qr.question_index, qr.question_type
    ORDER BY error_rate DESC NULLS LAST;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get wrong answer patterns
CREATE OR REPLACE FUNCTION dg_get_wrong_answer_patterns(p_chapter INTEGER DEFAULT NULL, p_limit INTEGER DEFAULT 50)
RETURNS TABLE (
    chapter_number INTEGER,
    question_index INTEGER,
    question_text TEXT,
    wrong_answer JSONB,
    correct_answer JSONB,
    occurrence_count BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        qa.chapter_number,
        qr.question_index,
        qr.question_text,
        qr.user_answer as wrong_answer,
        qr.correct_answer,
        COUNT(*)::BIGINT as occurrence_count
    FROM dg_question_responses qr
    JOIN dg_quiz_attempts qa ON qr.attempt_id = qa.id
    WHERE NOT qr.is_correct
        AND (p_chapter IS NULL OR qa.chapter_number = p_chapter)
    GROUP BY qa.chapter_number, qr.question_index, qr.question_text, qr.user_answer, qr.correct_answer
    ORDER BY occurrence_count DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get recent activity
CREATE OR REPLACE FUNCTION dg_get_recent_activity(p_limit INTEGER DEFAULT 50)
RETURNS TABLE (
    attempt_id UUID,
    user_anonymous_id TEXT,
    chapter_number INTEGER,
    score INTEGER,
    total_questions INTEGER,
    percentage INTEGER,
    hints_used INTEGER,
    completed_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        qa.id as attempt_id,
        u.anonymous_id as user_anonymous_id,
        qa.chapter_number,
        qa.score,
        qa.total_questions,
        qa.percentage,
        qa.hints_used,
        qa.completed_at
    FROM dg_quiz_attempts qa
    JOIN dg_users u ON qa.user_id = u.id
    ORDER BY qa.completed_at DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
`;

const rlsPolicies = `
-- Enable RLS
ALTER TABLE dg_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE dg_quiz_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE dg_question_responses ENABLE ROW LEVEL SECURITY;

-- Policies for dg_users
DROP POLICY IF EXISTS "Users can insert their own record" ON dg_users;
CREATE POLICY "Users can insert their own record" ON dg_users
    FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Users can view their own record" ON dg_users;
CREATE POLICY "Users can view their own record" ON dg_users
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can update their own record" ON dg_users;
CREATE POLICY "Users can update their own record" ON dg_users
    FOR UPDATE USING (true);

-- Policies for dg_quiz_attempts
DROP POLICY IF EXISTS "Users can insert their own attempts" ON dg_quiz_attempts;
CREATE POLICY "Users can insert their own attempts" ON dg_quiz_attempts
    FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Users can view their own attempts" ON dg_quiz_attempts;
CREATE POLICY "Users can view their own attempts" ON dg_quiz_attempts
    FOR SELECT USING (true);

-- Policies for dg_question_responses
DROP POLICY IF EXISTS "Users can insert their own responses" ON dg_question_responses;
CREATE POLICY "Users can insert their own responses" ON dg_question_responses
    FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Users can view their own responses" ON dg_question_responses;
CREATE POLICY "Users can view their own responses" ON dg_question_responses
    FOR SELECT USING (true);
`;

module.exports = async function handler(req, res) {
    // Only allow POST
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed. Use POST.' });
    }

    // Require setup key for security
    const setupKey = req.headers['x-setup-key'] || req.query.key;
    if (setupKey !== 'debate-guide-setup-2024') {
        return res.status(401).json({ error: 'Invalid setup key' });
    }

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
        return res.status(500).json({
            error: 'Missing Supabase credentials',
            hasUrl: !!supabaseUrl,
            hasServiceKey: !!supabaseServiceKey,
            availableEnvs: Object.keys(process.env).filter(k => k.includes('SUPABASE'))
        });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
        auth: { autoRefreshToken: false, persistSession: false }
    });

    const results = {
        schema: null,
        functions: null,
        policies: null,
        errors: []
    };

    try {
        // Run schema creation
        const { error: schemaError } = await supabase.rpc('exec_sql', { sql: schema }).maybeSingle();
        if (schemaError && !schemaError.message.includes('does not exist')) {
            // Try direct SQL via REST
            const schemaResult = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'apikey': supabaseServiceKey,
                    'Authorization': `Bearer ${supabaseServiceKey}`
                },
                body: JSON.stringify({ sql: schema })
            });
            if (!schemaResult.ok) {
                results.errors.push({ step: 'schema', error: 'exec_sql not available - run SQL manually' });
            }
        }
        results.schema = 'attempted';

    } catch (error) {
        results.errors.push({ step: 'schema', error: error.message });
    }

    // Test if tables were created by trying to query them
    try {
        const { data, error } = await supabase.from('dg_users').select('id').limit(1);
        if (error) {
            results.errors.push({ step: 'verify', error: error.message });

            return res.status(500).json({
                success: false,
                message: 'Tables not created. Please run the SQL manually in Supabase SQL Editor.',
                sqlToRun: 'See supabase-schema.sql in the repository',
                results,
                instructions: [
                    '1. Go to your Supabase project dashboard',
                    '2. Click SQL Editor in the left sidebar',
                    '3. Copy contents of supabase-schema.sql from the repo',
                    '4. Paste and click Run'
                ]
            });
        }

        results.tablesExist = true;

    } catch (error) {
        results.errors.push({ step: 'verify', error: error.message });
    }

    return res.status(200).json({
        success: true,
        message: 'Database schema setup completed',
        results
    });
};

/**
 * GET /api/admin/export
 * Export quiz data as CSV
 * Requires admin authentication
 *
 * Query params:
 * - type: 'attempts' | 'users' | 'questions' (default: attempts)
 * - chapter: Filter by chapter number (optional, for attempts/questions)
 * - format: 'csv' | 'json' (default: csv)
 */

const { getSupabaseAdminClient, validateAdminAuth, corsHeaders } = require('../lib/supabase');

module.exports = async function handler(req, res) {
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
        return res.status(200).json({ ok: true });
    }

    // Only allow GET
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    // Set CORS headers
    Object.entries(corsHeaders).forEach(([key, value]) => {
        res.setHeader(key, value);
    });

    // Validate admin auth
    if (!validateAdminAuth(req)) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
        const supabase = getSupabaseAdminClient();

        const type = req.query.type || 'attempts';
        const chapter = req.query.chapter ? parseInt(req.query.chapter, 10) : null;
        const format = req.query.format || 'csv';

        let data = [];
        let filename = '';
        let headers = [];

        switch (type) {
            case 'attempts': {
                let query = supabase
                    .from('dg_quiz_attempts')
                    .select(`
                        id,
                        chapter_number,
                        score,
                        total_questions,
                        percentage,
                        hints_used,
                        time_taken_seconds,
                        completed_at,
                        user:dg_users(anonymous_id)
                    `)
                    .order('completed_at', { ascending: false });

                if (chapter) {
                    query = query.eq('chapter_number', chapter);
                }

                const { data: attempts, error } = await query;

                if (error) throw error;

                data = (attempts || []).map(a => ({
                    id: a.id,
                    user_id: a.user?.anonymous_id || 'unknown',
                    chapter: a.chapter_number,
                    score: a.score,
                    total: a.total_questions,
                    percentage: a.percentage,
                    hints_used: a.hints_used,
                    time_seconds: a.time_taken_seconds || '',
                    completed_at: a.completed_at
                }));

                headers = ['id', 'user_id', 'chapter', 'score', 'total', 'percentage', 'hints_used', 'time_seconds', 'completed_at'];
                filename = chapter ? `quiz-attempts-chapter-${chapter}` : 'quiz-attempts-all';
                break;
            }

            case 'users': {
                const { data: users, error } = await supabase
                    .from('dg_users')
                    .select('id, anonymous_id, email, created_at, last_seen_at')
                    .order('created_at', { ascending: false });

                if (error) throw error;

                // Get attempt counts per user
                const { data: attemptCounts } = await supabase
                    .from('dg_quiz_attempts')
                    .select('user_id')
                    .then(res => {
                        const counts = {};
                        (res.data || []).forEach(a => {
                            counts[a.user_id] = (counts[a.user_id] || 0) + 1;
                        });
                        return { data: counts };
                    });

                data = (users || []).map(u => ({
                    id: u.id,
                    anonymous_id: u.anonymous_id,
                    email: u.email || '',
                    quiz_attempts: attemptCounts[u.id] || 0,
                    created_at: u.created_at,
                    last_seen: u.last_seen_at
                }));

                headers = ['id', 'anonymous_id', 'email', 'quiz_attempts', 'created_at', 'last_seen'];
                filename = 'quiz-users';
                break;
            }

            case 'questions': {
                let query = supabase
                    .from('dg_question_responses')
                    .select(`
                        id,
                        question_index,
                        question_type,
                        question_text,
                        user_answer,
                        correct_answer,
                        is_correct,
                        hints_used_for_question,
                        attempt:dg_quiz_attempts(chapter_number, completed_at)
                    `)
                    .order('id', { ascending: false })
                    .limit(5000);

                if (chapter) {
                    // Need to filter after join
                }

                const { data: responses, error } = await query;

                if (error) throw error;

                let filteredResponses = responses || [];
                if (chapter) {
                    filteredResponses = filteredResponses.filter(r => r.attempt?.chapter_number === chapter);
                }

                data = filteredResponses.map(r => ({
                    id: r.id,
                    chapter: r.attempt?.chapter_number || '',
                    question_index: r.question_index,
                    question_type: r.question_type,
                    question_text: (r.question_text || '').substring(0, 100),
                    user_answer: typeof r.user_answer === 'string' ? r.user_answer : JSON.stringify(r.user_answer),
                    correct_answer: typeof r.correct_answer === 'string' ? r.correct_answer : JSON.stringify(r.correct_answer),
                    is_correct: r.is_correct ? 'true' : 'false',
                    hints_used: r.hints_used_for_question,
                    completed_at: r.attempt?.completed_at || ''
                }));

                headers = ['id', 'chapter', 'question_index', 'question_type', 'question_text', 'user_answer', 'correct_answer', 'is_correct', 'hints_used', 'completed_at'];
                filename = chapter ? `question-responses-chapter-${chapter}` : 'question-responses-all';
                break;
            }

            default:
                return res.status(400).json({ error: 'Invalid export type. Use: attempts, users, questions' });
        }

        if (format === 'json') {
            res.setHeader('Content-Type', 'application/json');
            res.setHeader('Content-Disposition', `attachment; filename="${filename}.json"`);
            return res.status(200).json(data);
        }

        // Convert to CSV
        const csvRows = [headers.join(',')];
        data.forEach(row => {
            const values = headers.map(h => {
                const val = row[h];
                if (val === null || val === undefined) return '';
                const str = String(val);
                // Escape quotes and wrap if contains comma
                if (str.includes(',') || str.includes('"') || str.includes('\n')) {
                    return `"${str.replace(/"/g, '""')}"`;
                }
                return str;
            });
            csvRows.push(values.join(','));
        });

        const csv = csvRows.join('\n');

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}.csv"`);
        return res.status(200).send(csv);

    } catch (error) {
        console.error('Admin export error:', error);
        return res.status(500).json({
            error: 'Internal server error',
            message: error.message
        });
    }
};

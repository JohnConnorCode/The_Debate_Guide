/**
 * GET /api/admin/questions
 * Returns question-level analytics and wrong answer patterns
 * Requires admin authentication
 *
 * Query params:
 * - chapter: Filter by chapter number (optional)
 * - limit: Max results (default 50)
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

        const chapter = req.query.chapter ? parseInt(req.query.chapter, 10) : null;
        const limit = Math.min(parseInt(req.query.limit, 10) || 50, 200);

        // Get question analytics
        const { data: questionData, error: questionError } = await supabase
            .rpc('dg_get_question_analytics', { p_chapter: chapter });

        if (questionError) {
            console.error('Error fetching question analytics:', questionError);
        }

        // Get wrong answer patterns
        const { data: patternData, error: patternError } = await supabase
            .rpc('dg_get_wrong_answer_patterns', { p_chapter: chapter, p_limit: limit });

        if (patternError) {
            console.error('Error fetching wrong answer patterns:', patternError);
        }

        // Get hardest questions (highest error rate)
        const hardestQuestions = (questionData || [])
            .filter(q => q.error_rate > 0)
            .sort((a, b) => b.error_rate - a.error_rate)
            .slice(0, 20);

        // Get hint effectiveness
        const hintEffectiveness = (questionData || [])
            .filter(q => q.avg_hints_used > 0)
            .sort((a, b) => b.avg_hints_used - a.avg_hints_used)
            .slice(0, 20);

        return res.status(200).json({
            success: true,
            hardestQuestions,
            wrongAnswerPatterns: patternData || [],
            hintEffectiveness,
            totalQuestionsAnalyzed: questionData?.length || 0
        });

    } catch (error) {
        console.error('Admin questions error:', error);
        return res.status(500).json({
            error: 'Internal server error',
            message: error.message
        });
    }
};

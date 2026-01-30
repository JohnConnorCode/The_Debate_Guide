/**
 * GET /api/quiz/progress
 * Fetch user's progress from Supabase for cross-device sync
 * Returns best scores per chapter for the given anonymous ID
 */

const { getSupabaseClient, corsHeaders } = require('../lib/supabase');

module.exports = async function handler(req, res) {
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
        Object.entries(corsHeaders).forEach(([key, value]) => {
            res.setHeader(key, value);
        });
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

    try {
        const anonymousId = req.query.anonymousId;

        if (!anonymousId) {
            return res.status(400).json({ error: 'Missing anonymousId query parameter' });
        }

        const supabase = getSupabaseClient();

        // Find user by anonymous ID
        const { data: user, error: userError } = await supabase
            .from('dg_users')
            .select('id')
            .eq('anonymous_id', anonymousId)
            .single();

        if (userError || !user) {
            // User not found - return empty progress (not an error)
            return res.status(200).json({
                success: true,
                found: false,
                progress: {},
                message: 'No server progress found for this user'
            });
        }

        // Get all quiz attempts for this user
        const { data: attempts, error: attemptsError } = await supabase
            .from('dg_quiz_attempts')
            .select('chapter_number, score, total_questions, percentage, hints_used, completed_at')
            .eq('user_id', user.id)
            .order('completed_at', { ascending: false });

        if (attemptsError) {
            console.error('Error fetching attempts:', attemptsError);
            return res.status(500).json({ error: 'Failed to fetch progress' });
        }

        // Build progress object with best scores per chapter
        const progress = {};
        const attemptCounts = {};

        if (attempts && attempts.length > 0) {
            for (const attempt of attempts) {
                const chapterId = String(attempt.chapter_number);

                // Count attempts per chapter
                attemptCounts[chapterId] = (attemptCounts[chapterId] || 0) + 1;

                // Keep only the best score per chapter
                if (!progress[chapterId] || attempt.percentage > progress[chapterId].percentage) {
                    progress[chapterId] = {
                        bestScore: attempt.score,
                        total: attempt.total_questions,
                        percentage: attempt.percentage,
                        hintsUsed: attempt.hints_used || 0,
                        completedAt: attempt.completed_at,
                        attempts: attemptCounts[chapterId]
                    };
                } else {
                    // Update attempt count even if not best score
                    progress[chapterId].attempts = attemptCounts[chapterId];
                }
            }
        }

        return res.status(200).json({
            success: true,
            found: true,
            progress: progress,
            totalAttempts: attempts ? attempts.length : 0,
            message: `Found progress for ${Object.keys(progress).length} chapters`
        });

    } catch (error) {
        console.error('Progress fetch error:', error);
        return res.status(500).json({
            error: 'Internal server error',
            message: error.message
        });
    }
};

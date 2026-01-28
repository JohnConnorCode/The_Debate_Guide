/**
 * GET /api/admin/users
 * Returns detailed per-user analytics
 * Requires admin authentication
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
        const userId = req.query.userId;

        // If specific user requested, get detailed view
        if (userId) {
            // Get user info
            const { data: user, error: userError } = await supabase
                .from('dg_users')
                .select('id, anonymous_id, email, created_at, last_seen_at')
                .eq('id', userId)
                .single();

            if (userError || !user) {
                return res.status(404).json({ error: 'User not found' });
            }

            // Get all their quiz attempts
            const { data: attempts, error: attemptsError } = await supabase
                .from('dg_quiz_attempts')
                .select('id, chapter_number, score, total_questions, percentage, hints_used, time_taken_seconds, completed_at')
                .eq('user_id', userId)
                .order('completed_at', { ascending: false });

            if (attemptsError) throw attemptsError;

            // Calculate user stats
            const chaptersPassed = new Set();
            const chaptersMastered = new Set();
            const chapterAttempts = {};

            (attempts || []).forEach(a => {
                if (a.percentage >= 70) chaptersPassed.add(a.chapter_number);
                if (a.percentage >= 90) chaptersMastered.add(a.chapter_number);
                chapterAttempts[a.chapter_number] = (chapterAttempts[a.chapter_number] || 0) + 1;
            });

            const totalScore = (attempts || []).reduce((sum, a) => sum + a.percentage, 0);
            const avgScore = attempts && attempts.length > 0 ? Math.round(totalScore / attempts.length) : 0;

            return res.status(200).json({
                success: true,
                user: {
                    ...user,
                    stats: {
                        totalAttempts: attempts?.length || 0,
                        chaptersPassed: chaptersPassed.size,
                        chaptersMastered: chaptersMastered.size,
                        averageScore: avgScore,
                        chapterAttempts
                    }
                },
                attempts: attempts || []
            });
        }

        // Get all users with their stats
        const { data: users, error: usersError } = await supabase
            .from('dg_users')
            .select('id, anonymous_id, email, created_at, last_seen_at')
            .order('last_seen_at', { ascending: false });

        if (usersError) throw usersError;

        // Get attempt counts and stats per user
        const { data: attempts, error: attemptsError } = await supabase
            .from('dg_quiz_attempts')
            .select('user_id, chapter_number, percentage');

        if (attemptsError) throw attemptsError;

        // Aggregate stats per user
        const userStats = {};
        (attempts || []).forEach(a => {
            if (!userStats[a.user_id]) {
                userStats[a.user_id] = {
                    attempts: 0,
                    totalScore: 0,
                    chaptersPassed: new Set(),
                    chaptersMastered: new Set()
                };
            }
            userStats[a.user_id].attempts++;
            userStats[a.user_id].totalScore += a.percentage;
            if (a.percentage >= 70) userStats[a.user_id].chaptersPassed.add(a.chapter_number);
            if (a.percentage >= 90) userStats[a.user_id].chaptersMastered.add(a.chapter_number);
        });

        // Merge stats into users
        const usersWithStats = (users || []).map(u => {
            const stats = userStats[u.id] || { attempts: 0, totalScore: 0, chaptersPassed: new Set(), chaptersMastered: new Set() };
            return {
                ...u,
                attempts: stats.attempts,
                avgScore: stats.attempts > 0 ? Math.round(stats.totalScore / stats.attempts) : null,
                chaptersPassed: stats.chaptersPassed.size,
                chaptersMastered: stats.chaptersMastered.size
            };
        });

        return res.status(200).json({
            success: true,
            users: usersWithStats,
            total: usersWithStats.length
        });

    } catch (error) {
        console.error('Admin users error:', error);
        return res.status(500).json({
            error: 'Internal server error',
            message: error.message
        });
    }
};

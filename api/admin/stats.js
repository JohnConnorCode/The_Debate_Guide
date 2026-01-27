/**
 * GET /api/admin/stats
 * Returns overall dashboard statistics
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

        // Call the stored function
        const { data, error } = await supabase.rpc('dg_get_quiz_stats');

        if (error) {
            console.error('Error fetching stats:', error);
            return res.status(500).json({ error: 'Failed to fetch stats' });
        }

        // Get additional time-series data for charts
        const { data: dailyData, error: dailyError } = await supabase
            .from('dg_quiz_attempts')
            .select('completed_at, percentage')
            .gte('completed_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
            .order('completed_at', { ascending: true });

        // Aggregate by day
        const dailyStats = {};
        if (dailyData) {
            dailyData.forEach(attempt => {
                const date = attempt.completed_at.split('T')[0];
                if (!dailyStats[date]) {
                    dailyStats[date] = { attempts: 0, totalScore: 0, passes: 0 };
                }
                dailyStats[date].attempts++;
                dailyStats[date].totalScore += attempt.percentage;
                if (attempt.percentage >= 70) {
                    dailyStats[date].passes++;
                }
            });
        }

        const dailyTrend = Object.entries(dailyStats).map(([date, stats]) => ({
            date,
            attempts: stats.attempts,
            avgScore: Math.round(stats.totalScore / stats.attempts),
            passRate: Math.round((stats.passes / stats.attempts) * 100)
        }));

        return res.status(200).json({
            success: true,
            stats: data,
            dailyTrend
        });

    } catch (error) {
        console.error('Admin stats error:', error);
        return res.status(500).json({
            error: 'Internal server error',
            message: error.message
        });
    }
};

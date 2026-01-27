/**
 * GET /api/admin/activity
 * Returns recent quiz activity
 * Requires admin authentication
 *
 * Query params:
 * - limit: Max results (default 50, max 200)
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
        const limit = Math.min(parseInt(req.query.limit, 10) || 50, 200);

        // Call the stored function
        const { data, error } = await supabase.rpc('dg_get_recent_activity', { p_limit: limit });

        if (error) {
            console.error('Error fetching activity:', error);
            return res.status(500).json({ error: 'Failed to fetch activity' });
        }

        return res.status(200).json({
            success: true,
            activity: data || []
        });

    } catch (error) {
        console.error('Admin activity error:', error);
        return res.status(500).json({
            error: 'Internal server error',
            message: error.message
        });
    }
};

/**
 * GET /api/debug
 * Temporary debug endpoint - DELETE AFTER TESTING
 */

module.exports = async function handler(req, res) {
    const envVars = {
        hasAdminPassword: !!process.env.ADMIN_PASSWORD,
        adminPasswordLength: process.env.ADMIN_PASSWORD?.length || 0,
        hasSupabaseUrl: !!process.env.SUPABASE_URL,
        hasSupabaseAnonKey: !!process.env.SUPABASE_ANON_KEY,
        hasSupabaseServiceKey: !!(process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY),
        nodeEnv: process.env.NODE_ENV,
        vercelEnv: process.env.VERCEL_ENV
    };

    return res.status(200).json(envVars);
};

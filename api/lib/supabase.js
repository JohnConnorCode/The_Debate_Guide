/**
 * Supabase client initialization for The Debate Guide
 */

const { createClient } = require('@supabase/supabase-js');

// Create Supabase client with anon key (for public endpoints)
function getSupabaseClient() {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
        throw new Error('Missing Supabase environment variables');
    }

    return createClient(supabaseUrl, supabaseAnonKey);
}

// Create Supabase admin client with service role key (for admin endpoints)
function getSupabaseAdminClient() {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
        throw new Error('Missing Supabase admin environment variables');
    }

    return createClient(supabaseUrl, supabaseServiceKey, {
        auth: {
            autoRefreshToken: false,
            persistSession: false
        }
    });
}

// Validate admin password from request
function validateAdminAuth(req) {
    const adminPassword = process.env.ADMIN_PASSWORD;
    if (!adminPassword) {
        return false;
    }

    // Check Authorization header (Basic auth)
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Basic ')) {
        const base64Credentials = authHeader.split(' ')[1];
        const credentials = Buffer.from(base64Credentials, 'base64').toString('utf8');
        const [, password] = credentials.split(':');
        return password === adminPassword;
    }

    // Check x-admin-password header (simpler for API calls)
    const headerPassword = req.headers['x-admin-password'];
    if (headerPassword === adminPassword) {
        return true;
    }

    // Check query param (for CSV downloads)
    const queryPassword = req.query?.password;
    if (queryPassword === adminPassword) {
        return true;
    }

    return false;
}

// CORS headers for API responses
const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Admin-Password',
};

module.exports = {
    getSupabaseClient,
    getSupabaseAdminClient,
    validateAdminAuth,
    corsHeaders
};

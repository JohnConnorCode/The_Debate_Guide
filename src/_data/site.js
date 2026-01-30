/**
 * Site configuration with environment variables
 * This extends the static site.json with dynamic values
 */

const staticConfig = require('./site.json');

module.exports = function() {
    return {
        ...staticConfig,
        // Supabase configuration (from environment variables)
        supabaseUrl: process.env.SUPABASE_URL || '',
        supabaseAnonKey: process.env.SUPABASE_ANON_KEY || ''
    };
};

/**
 * POST /api/auth/link-progress
 * Links anonymous quiz progress to an authenticated user account
 * Called after successful login to merge anonymous data
 */

const { getSupabaseAdminClient, corsHeaders } = require('../lib/supabase');

module.exports = async function handler(req, res) {
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
        Object.entries(corsHeaders).forEach(([key, value]) => {
            res.setHeader(key, value);
        });
        return res.status(200).json({ ok: true });
    }

    // Only allow POST
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    // Set CORS headers
    Object.entries(corsHeaders).forEach(([key, value]) => {
        res.setHeader(key, value);
    });

    try {
        const { anonymousId, userId, email } = req.body;

        if (!anonymousId || !userId) {
            return res.status(400).json({ error: 'Missing anonymousId or userId' });
        }

        const supabase = getSupabaseAdminClient();

        // Find anonymous user record
        const { data: anonUser } = await supabase
            .from('dg_users')
            .select('id')
            .eq('anonymous_id', anonymousId)
            .single();

        if (!anonUser) {
            // No anonymous progress to link
            return res.status(200).json({
                success: true,
                linked: false,
                message: 'No anonymous progress found to link'
            });
        }

        // Check if authenticated user already has a dg_users record
        const { data: existingAuthUser } = await supabase
            .from('dg_users')
            .select('id')
            .eq('email', email)
            .single();

        if (existingAuthUser) {
            // User already has progress - merge anonymous into existing
            // Transfer quiz attempts from anonymous to authenticated user
            const { data: anonAttempts } = await supabase
                .from('dg_quiz_attempts')
                .select('*')
                .eq('user_id', anonUser.id);

            if (anonAttempts && anonAttempts.length > 0) {
                // Get existing attempts for the authenticated user
                const { data: authAttempts } = await supabase
                    .from('dg_quiz_attempts')
                    .select('chapter_number, percentage')
                    .eq('user_id', existingAuthUser.id);

                const authBestScores = new Map();
                if (authAttempts) {
                    authAttempts.forEach(a => {
                        const existing = authBestScores.get(a.chapter_number);
                        if (!existing || a.percentage > existing) {
                            authBestScores.set(a.chapter_number, a.percentage);
                        }
                    });
                }

                // Only transfer attempts that are better than existing
                for (const attempt of anonAttempts) {
                    const existingBest = authBestScores.get(attempt.chapter_number);
                    if (!existingBest || attempt.percentage > existingBest) {
                        // Insert as new attempt for authenticated user
                        await supabase
                            .from('dg_quiz_attempts')
                            .insert({
                                user_id: existingAuthUser.id,
                                chapter_number: attempt.chapter_number,
                                score: attempt.score,
                                total_questions: attempt.total_questions,
                                percentage: attempt.percentage,
                                hints_used: attempt.hints_used,
                                completed_at: attempt.completed_at
                            });
                    }
                }
            }

            // Delete anonymous user record (cascades to attempts)
            await supabase
                .from('dg_users')
                .delete()
                .eq('id', anonUser.id);

            return res.status(200).json({
                success: true,
                linked: true,
                merged: true,
                message: 'Merged anonymous progress into existing account'
            });
        }

        // No existing authenticated record - update anonymous record with email
        await supabase
            .from('dg_users')
            .update({
                email: email,
                last_seen_at: new Date().toISOString()
            })
            .eq('id', anonUser.id);

        return res.status(200).json({
            success: true,
            linked: true,
            merged: false,
            message: 'Linked anonymous progress to account'
        });

    } catch (error) {
        console.error('Link progress error:', error);
        return res.status(500).json({
            error: 'Internal server error',
            message: error.message
        });
    }
};

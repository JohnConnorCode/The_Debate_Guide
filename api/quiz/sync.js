/**
 * POST /api/quiz/sync
 * Bulk sync localStorage quiz data to Supabase
 * Used when user returns and has offline data to sync
 */

const { getSupabaseClient, corsHeaders } = require('../lib/supabase');

module.exports = async function handler(req, res) {
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
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
        const {
            anonymousId,
            progress,    // Object: { chapterId: { bestScore, total, percentage, attempts, ... } }
            achievements // Object: { unlocked: [], stats: {} }
        } = req.body;

        if (!anonymousId) {
            return res.status(400).json({ error: 'Missing anonymousId' });
        }

        const supabase = getSupabaseClient();

        // Get or create user
        let userId;

        const { data: existingUser } = await supabase
            .from('users')
            .select('id')
            .eq('anonymous_id', anonymousId)
            .single();

        if (existingUser) {
            userId = existingUser.id;

            // Update last_seen_at
            await supabase
                .from('users')
                .update({ last_seen_at: new Date().toISOString() })
                .eq('id', userId);
        } else {
            // Create new user
            const { data: newUser, error: userError } = await supabase
                .from('users')
                .insert({ anonymous_id: anonymousId })
                .select('id')
                .single();

            if (userError) {
                console.error('Error creating user:', userError);
                return res.status(500).json({ error: 'Failed to create user' });
            }

            userId = newUser.id;
        }

        // Get existing server attempts to avoid duplicates
        const { data: existingAttempts } = await supabase
            .from('quiz_attempts')
            .select('chapter_number, percentage, completed_at')
            .eq('user_id', userId);

        const existingMap = new Map();
        if (existingAttempts) {
            existingAttempts.forEach(a => {
                const key = `${a.chapter_number}`;
                if (!existingMap.has(key) || a.percentage > existingMap.get(key).percentage) {
                    existingMap.set(key, a);
                }
            });
        }

        // Sync progress data
        let syncedCount = 0;
        let skippedCount = 0;

        if (progress && typeof progress === 'object') {
            for (const [chapterId, data] of Object.entries(progress)) {
                const chapterNum = parseInt(chapterId, 10);
                if (isNaN(chapterNum) || chapterNum < 1 || chapterNum > 20) {
                    continue;
                }

                // Check if we already have this data or better
                const existing = existingMap.get(String(chapterNum));
                if (existing && existing.percentage >= data.percentage) {
                    skippedCount++;
                    continue;
                }

                // Insert the attempt (we're syncing the best score from localStorage)
                const { error } = await supabase
                    .from('quiz_attempts')
                    .insert({
                        user_id: userId,
                        chapter_number: chapterNum,
                        score: data.bestScore,
                        total_questions: data.total,
                        percentage: data.percentage,
                        hints_used: data.hintsUsed || 0,
                        completed_at: data.completedAt || new Date().toISOString()
                    });

                if (!error) {
                    syncedCount++;
                } else {
                    console.error(`Error syncing chapter ${chapterNum}:`, error);
                }
            }
        }

        return res.status(200).json({
            success: true,
            userId: userId,
            synced: syncedCount,
            skipped: skippedCount,
            message: `Synced ${syncedCount} quiz results, skipped ${skippedCount} (already on server)`
        });

    } catch (error) {
        console.error('Quiz sync error:', error);
        return res.status(500).json({
            error: 'Internal server error',
            message: error.message
        });
    }
};

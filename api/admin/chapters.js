/**
 * GET /api/admin/chapters
 * Returns per-chapter analytics
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
        const { data, error } = await supabase.rpc('get_chapter_stats');

        if (error) {
            console.error('Error fetching chapter stats:', error);
            return res.status(500).json({ error: 'Failed to fetch chapter stats' });
        }

        // Chapter titles for reference
        const chapterTitles = [
            'Why Debate Matters',
            'The Greek Legacy',
            'The Rhetorical Triangle',
            'Kairos',
            'Ethos: Building Credibility',
            'Character in Action',
            'Pathos: Moving Hearts',
            'The Emotions Catalog',
            'Logos: Constructing Reason',
            'Evidence and Proof',
            'Building Your Case',
            'The Art of Refutation',
            'Fallacies and Traps',
            'The Socratic Method',
            'Steelmanning',
            'Debate in the Workplace',
            'Debate in Education',
            'Digital Discourse',
            'Debate as Civic Duty',
            "The Philosopher's Victory"
        ];

        // Enrich with chapter titles
        const enrichedData = (data || []).map(chapter => ({
            ...chapter,
            title: chapterTitles[chapter.chapter_number - 1] || `Chapter ${chapter.chapter_number}`
        }));

        // Fill in missing chapters with zeros
        const allChapters = [];
        for (let i = 1; i <= 20; i++) {
            const existing = enrichedData.find(c => c.chapter_number === i);
            if (existing) {
                allChapters.push(existing);
            } else {
                allChapters.push({
                    chapter_number: i,
                    title: chapterTitles[i - 1],
                    attempts: 0,
                    unique_users: 0,
                    avg_score: null,
                    pass_rate: null,
                    min_score: null,
                    max_score: null
                });
            }
        }

        return res.status(200).json({
            success: true,
            chapters: allChapters
        });

    } catch (error) {
        console.error('Admin chapters error:', error);
        return res.status(500).json({
            error: 'Internal server error',
            message: error.message
        });
    }
};

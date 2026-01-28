/**
 * POST /api/quiz/submit
 * Save quiz attempt and individual question responses to Supabase
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
            email,
            chapterNumber,
            score,
            totalQuestions,
            percentage,
            hintsUsed,
            timeTakenSeconds,
            responses // Array of { questionIndex, questionType, questionText, userAnswer, correctAnswer, isCorrect, hintsUsedForQuestion }
        } = req.body;

        // Validate required fields
        if (!anonymousId || !chapterNumber || score === undefined || !totalQuestions || percentage === undefined) {
            return res.status(400).json({
                error: 'Missing required fields',
                required: ['anonymousId', 'chapterNumber', 'score', 'totalQuestions', 'percentage']
            });
        }

        // Validate chapter number
        if (chapterNumber < 1 || chapterNumber > 20) {
            return res.status(400).json({ error: 'Invalid chapter number (must be 1-20)' });
        }

        const supabase = getSupabaseClient();

        // Get or create user
        let userId;

        // First try to find existing user
        const { data: existingUser } = await supabase
            .from('dg_users')
            .select('id')
            .eq('anonymous_id', anonymousId)
            .single();

        if (existingUser) {
            userId = existingUser.id;

            // Update last_seen_at and email (if provided)
            const updateData = { last_seen_at: new Date().toISOString() };
            if (email && typeof email === 'string' && email.includes('@')) {
                updateData.email = email.trim().toLowerCase();
            }
            await supabase
                .from('dg_users')
                .update(updateData)
                .eq('id', userId);
        } else {
            // Create new user with email if provided
            const insertData = { anonymous_id: anonymousId };
            if (email && typeof email === 'string' && email.includes('@')) {
                insertData.email = email.trim().toLowerCase();
            }
            const { data: newUser, error: userError } = await supabase
                .from('dg_users')
                .insert(insertData)
                .select('id')
                .single();

            if (userError) {
                console.error('Error creating user:', userError);
                return res.status(500).json({ error: 'Failed to create user' });
            }

            userId = newUser.id;
        }

        // Insert quiz attempt
        const { data: attempt, error: attemptError } = await supabase
            .from('dg_quiz_attempts')
            .insert({
                user_id: userId,
                chapter_number: chapterNumber,
                score: score,
                total_questions: totalQuestions,
                percentage: percentage,
                hints_used: hintsUsed || 0,
                time_taken_seconds: timeTakenSeconds || null
            })
            .select('id')
            .single();

        if (attemptError) {
            console.error('Error creating quiz attempt:', attemptError);
            return res.status(500).json({ error: 'Failed to save quiz attempt' });
        }

        // Insert question responses if provided
        if (responses && Array.isArray(responses) && responses.length > 0) {
            const responseRecords = responses.map(r => ({
                attempt_id: attempt.id,
                question_index: r.questionIndex,
                question_type: r.questionType || 'unknown',
                question_text: r.questionText || null,
                user_answer: r.userAnswer !== undefined ? JSON.stringify(r.userAnswer) : null,
                correct_answer: r.correctAnswer !== undefined ? JSON.stringify(r.correctAnswer) : null,
                is_correct: r.isCorrect === true,
                hints_used_for_question: r.hintsUsedForQuestion || 0
            }));

            const { error: responsesError } = await supabase
                .from('dg_question_responses')
                .insert(responseRecords);

            if (responsesError) {
                console.error('Error saving question responses:', responsesError);
                // Don't fail the whole request, attempt was already saved
            }
        }

        return res.status(200).json({
            success: true,
            attemptId: attempt.id,
            userId: userId
        });

    } catch (error) {
        console.error('Quiz submit error:', error);
        return res.status(500).json({
            error: 'Internal server error',
            message: error.message
        });
    }
};

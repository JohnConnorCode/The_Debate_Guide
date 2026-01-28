/**
 * The Debate Guide - Enhanced Chapter Quiz System
 *
 * Features:
 * - Multiple question types: MC, T/F, matching, ordering, scenario, fill-blank
 * - Question and answer randomization
 * - Keyboard navigation (1-4 keys, Enter, Tab, ?)
 * - Immediate feedback mode with explanations
 * - Progressive hint system
 * - Progress tracking with localStorage
 * - Spaced repetition support
 * - Achievement tracking
 */

(function() {
    'use strict';

    // ==========================================
    // CONFIGURATION
    // ==========================================

    const STORAGE_KEY = 'debateGuideQuizProgress';
    const ACHIEVEMENTS_KEY = 'debateGuideAchievements';
    const SPACED_REP_KEY = 'debateGuideSpacedRep';
    const USER_ID_KEY = 'debateGuideUserId';
    const USER_EMAIL_KEY = 'debateGuideUserEmail';

    // ==========================================
    // SERVER SYNC (fire-and-forget)
    // ==========================================

    /**
     * Get or create anonymous user ID for server tracking
     */
    function getAnonymousUserId() {
        let userId = localStorage.getItem(USER_ID_KEY);
        if (!userId) {
            // Generate a unique anonymous ID
            userId = 'anon_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 10);
            localStorage.setItem(USER_ID_KEY, userId);
        }
        return userId;
    }

    /**
     * Get stored user email
     */
    function getUserEmail() {
        return localStorage.getItem(USER_EMAIL_KEY) || null;
    }

    /**
     * Set user email
     */
    function setUserEmail(email) {
        if (email && typeof email === 'string') {
            localStorage.setItem(USER_EMAIL_KEY, email.trim().toLowerCase());
        }
    }

    /**
     * Validate email format
     */
    function isValidEmail(email) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    }

    /**
     * Sync quiz results to server (fire-and-forget, non-blocking)
     */
    async function syncToServer(chapterId, results, questionResponses = []) {
        try {
            const anonymousId = getAnonymousUserId();
            const email = getUserEmail();

            const payload = {
                anonymousId,
                email,
                chapterNumber: parseInt(chapterId, 10),
                score: results.bestScore,
                totalQuestions: results.total,
                percentage: results.percentage,
                hintsUsed: results.hintsUsed || 0,
                responses: questionResponses
            };

            // Fire-and-forget - don't await, don't block
            fetch('/api/quiz/submit', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            }).catch(() => {
                // Silently fail - localStorage is the primary store
                console.debug('Server sync failed (offline mode)');
            });
        } catch (e) {
            // Silently fail - we don't want to break the quiz experience
            console.debug('Server sync error:', e);
        }
    }

    /**
     * Sync all localStorage progress to server on page load (one-time)
     */
    function syncAllProgressToServer() {
        try {
            const progress = getProgress();
            const achievements = getAchievements();

            if (Object.keys(progress).length === 0) return;

            const anonymousId = getAnonymousUserId();

            fetch('/api/quiz/sync', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    anonymousId,
                    progress,
                    achievements
                })
            }).catch(() => {
                // Silently fail
            });
        } catch (e) {
            // Silently fail
        }
    }

    // ==========================================
    // STATE
    // ==========================================

    let quizData = null;
    let currentQuestion = 0;
    let userAnswers = [];
    let quizStarted = false;
    let immediateFeedbackMode = true; // Show feedback after each question
    let questionOrder = []; // Randomized question indices
    let answerOrders = {}; // Map of question index to randomized answer indices
    let hintsUsed = {}; // Track hints used per question
    let currentHintLevel = {}; // Current hint level per question (0, 1, 2)
    let feedbackShown = false; // Whether feedback is currently being shown

    // ==========================================
    // DOM ELEMENTS
    // ==========================================

    const elements = {};

    function cacheElements() {
        elements.section = document.getElementById('chapter-quiz');
        if (!elements.section) return false;

        elements.startState = document.getElementById('quiz-start');
        elements.activeState = document.getElementById('quiz-active');
        elements.completeState = document.getElementById('quiz-complete');

        elements.questionCount = document.getElementById('quiz-question-count');
        elements.passingScore = document.getElementById('quiz-passing-score');
        elements.bestScore = document.getElementById('quiz-best-score');
        elements.attemptsCount = document.getElementById('quiz-attempts');
        elements.startBtn = document.getElementById('quiz-start-btn');

        elements.progressFill = document.getElementById('quiz-progress-fill');
        elements.progressText = document.getElementById('quiz-progress-text');
        elements.questionContainer = document.getElementById('quiz-question-container');
        elements.prevBtn = document.getElementById('quiz-prev-btn');
        elements.nextBtn = document.getElementById('quiz-next-btn');
        elements.submitBtn = document.getElementById('quiz-submit-btn');

        elements.resultIcon = document.getElementById('quiz-result-icon');
        elements.scoreValue = document.getElementById('quiz-score-value');
        elements.resultMessage = document.getElementById('quiz-result-message');
        elements.reviewContainer = document.getElementById('quiz-review');
        elements.reviewToggle = document.getElementById('quiz-review-toggle');
        elements.retryBtn = document.getElementById('quiz-retry-btn');

        // Navigation CTAs
        elements.navigationCtas = document.getElementById('quiz-navigation-ctas');
        elements.ctaNextQuiz = document.getElementById('quiz-cta-next-quiz');
        elements.ctaNextQuizTitle = document.getElementById('quiz-cta-next-quiz-title');
        elements.ctaNext = document.getElementById('quiz-cta-next');
        elements.ctaNextTitle = document.getElementById('quiz-cta-next-title');
        elements.ctaProgress = document.getElementById('quiz-cta-progress');

        return true;
    }

    // ==========================================
    // UTILITY FUNCTIONS
    // ==========================================

    /**
     * Fisher-Yates shuffle algorithm
     */
    function shuffle(array) {
        const shuffled = [...array];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        return shuffled;
    }

    /**
     * Create an array of indices and shuffle them
     */
    function createShuffledIndices(length) {
        return shuffle(Array.from({ length }, (_, i) => i));
    }

    /**
     * Generate seeded random for reproducible results
     */
    function seededRandom(seed) {
        const x = Math.sin(seed++) * 10000;
        return x - Math.floor(x);
    }

    // ==========================================
    // STORAGE (localStorage, upgradeable to API)
    // ==========================================

    function getProgress() {
        try {
            const data = localStorage.getItem(STORAGE_KEY);
            return data ? JSON.parse(data) : {};
        } catch (e) {
            return {};
        }
    }

    function saveProgress(chapterId, score, total, hintsUsedCount = 0, questionResponses = []) {
        try {
            const progress = getProgress();
            const existing = progress[chapterId];
            const percentage = Math.round((score / total) * 100);

            // Calculate adjusted score for hints (reduce by 5% per hint used)
            const hintPenalty = Math.min(hintsUsedCount * 5, 25);
            const adjustedPercentage = Math.max(percentage - hintPenalty, 0);

            // Keep best score
            if (!existing || score > existing.bestScore) {
                progress[chapterId] = {
                    bestScore: score,
                    total: total,
                    percentage: percentage,
                    adjustedPercentage: adjustedPercentage,
                    completedAt: new Date().toISOString(),
                    attempts: (existing?.attempts || 0) + 1,
                    hintsUsed: hintsUsedCount,
                    averageScore: existing
                        ? Math.round((existing.averageScore * existing.attempts + percentage) / (existing.attempts + 1))
                        : percentage
                };
            } else {
                progress[chapterId].attempts = (existing?.attempts || 0) + 1;
                progress[chapterId].averageScore = Math.round(
                    (existing.averageScore * (existing.attempts - 1) + percentage) / existing.attempts
                );
                progress[chapterId].lastAttemptAt = new Date().toISOString();
            }

            localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));

            // Sync to server (fire-and-forget)
            syncToServer(chapterId, progress[chapterId], questionResponses);

            // Check and award achievements
            checkAchievements(chapterId, percentage, progress);

            // Update spaced repetition data
            updateSpacedRepetition(chapterId, percentage);

            // Dispatch event for TOC to update
            window.dispatchEvent(new CustomEvent('quizCompleted', {
                detail: { chapterId, progress: progress[chapterId] }
            }));

            return progress[chapterId];
        } catch (e) {
            console.error('Failed to save quiz progress:', e);
            return null;
        }
    }

    function getChapterProgress(chapterId) {
        const progress = getProgress();
        return progress[chapterId] || null;
    }

    // ==========================================
    // ACHIEVEMENTS SYSTEM
    // ==========================================

    function getAchievements() {
        try {
            const data = localStorage.getItem(ACHIEVEMENTS_KEY);
            return data ? JSON.parse(data) : { unlocked: [], stats: {} };
        } catch (e) {
            return { unlocked: [], stats: {} };
        }
    }

    function saveAchievement(achievementId) {
        try {
            const achievements = getAchievements();
            if (!achievements.unlocked.includes(achievementId)) {
                achievements.unlocked.push(achievementId);
                achievements.stats[achievementId] = {
                    unlockedAt: new Date().toISOString()
                };
                localStorage.setItem(ACHIEVEMENTS_KEY, JSON.stringify(achievements));

                // Dispatch achievement event for UI notification
                window.dispatchEvent(new CustomEvent('achievementUnlocked', {
                    detail: { achievementId }
                }));
            }
        } catch (e) {
            console.error('Failed to save achievement:', e);
        }
    }

    function checkAchievements(chapterId, percentage, allProgress) {
        const achievements = getAchievements();

        // First Steps - Complete first quiz
        if (!achievements.unlocked.includes('first-steps')) {
            saveAchievement('first-steps');
        }

        // Perfect Score - 100% on any chapter
        if (percentage === 100 && !achievements.unlocked.includes('perfect-score')) {
            saveAchievement('perfect-score');
        }

        // Count mastered chapters (90%+ twice)
        const masteredChapters = Object.values(allProgress).filter(
            p => p.percentage >= 90 && p.attempts >= 2
        ).length;

        // Scholar - Master 10 chapters
        if (masteredChapters >= 10 && !achievements.unlocked.includes('scholar')) {
            saveAchievement('scholar');
        }

        // Philosopher - Master all 20 chapters
        if (masteredChapters >= 20 && !achievements.unlocked.includes('philosopher')) {
            saveAchievement('philosopher');
        }

        // Check streak (would need daily tracking)
        checkStreakAchievement();
    }

    function checkStreakAchievement() {
        try {
            const achievements = getAchievements();
            const today = new Date().toDateString();

            if (!achievements.stats.lastStudyDate) {
                achievements.stats.lastStudyDate = today;
                achievements.stats.currentStreak = 1;
            } else {
                const lastDate = new Date(achievements.stats.lastStudyDate);
                const todayDate = new Date(today);
                const diffDays = Math.floor((todayDate - lastDate) / (1000 * 60 * 60 * 24));

                if (diffDays === 1) {
                    achievements.stats.currentStreak = (achievements.stats.currentStreak || 0) + 1;
                } else if (diffDays > 1) {
                    achievements.stats.currentStreak = 1;
                }
                achievements.stats.lastStudyDate = today;
            }

            // Streak Master - 7-day streak
            if (achievements.stats.currentStreak >= 7 && !achievements.unlocked.includes('streak-master')) {
                saveAchievement('streak-master');
            }

            localStorage.setItem(ACHIEVEMENTS_KEY, JSON.stringify(achievements));
        } catch (e) {
            console.error('Failed to check streak:', e);
        }
    }

    // ==========================================
    // SPACED REPETITION SYSTEM (SM-2 Algorithm)
    // ==========================================

    function getSpacedRepetitionData() {
        try {
            const data = localStorage.getItem(SPACED_REP_KEY);
            return data ? JSON.parse(data) : {};
        } catch (e) {
            return {};
        }
    }

    function updateSpacedRepetition(chapterId, percentage) {
        try {
            const srData = getSpacedRepetitionData();
            const quality = Math.round((percentage / 100) * 5); // Convert to 0-5 scale

            if (!srData[chapterId]) {
                srData[chapterId] = {
                    easeFactor: 2.5,
                    interval: 1,
                    repetitions: 0,
                    nextReview: new Date().toISOString()
                };
            }

            const item = srData[chapterId];

            // SM-2 algorithm
            if (quality >= 3) {
                if (item.repetitions === 0) {
                    item.interval = 1;
                } else if (item.repetitions === 1) {
                    item.interval = 6;
                } else {
                    item.interval = Math.round(item.interval * item.easeFactor);
                }
                item.repetitions++;
            } else {
                item.repetitions = 0;
                item.interval = 1;
            }

            // Update ease factor
            item.easeFactor = Math.max(1.3,
                item.easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02))
            );

            // Set next review date
            const nextDate = new Date();
            nextDate.setDate(nextDate.getDate() + item.interval);
            item.nextReview = nextDate.toISOString();

            localStorage.setItem(SPACED_REP_KEY, JSON.stringify(srData));
        } catch (e) {
            console.error('Failed to update spaced repetition:', e);
        }
    }

    function getDueReviews() {
        const srData = getSpacedRepetitionData();
        const now = new Date();
        const due = [];

        for (const [chapterId, data] of Object.entries(srData)) {
            if (new Date(data.nextReview) <= now) {
                due.push({ chapterId, ...data });
            }
        }

        return due.sort((a, b) => new Date(a.nextReview) - new Date(b.nextReview));
    }

    // ==========================================
    // QUIZ DATA LOADING & RANDOMIZATION
    // ==========================================

    async function loadQuizData(chapterId) {
        // Show loading state
        showLoadingState();

        try {
            // Pad chapter ID to match file naming
            const paddedId = String(chapterId).padStart(2, '0');
            const response = await fetch(`/quizzes/chapter-${paddedId}.json`);

            if (!response.ok) {
                console.log(`No quiz available for chapter ${chapterId}`);
                hideLoadingState();
                return null;
            }

            hideLoadingState();
            return await response.json();
        } catch (e) {
            console.error('Failed to load quiz data:', e);
            showErrorState('Unable to load quiz. Please check your connection and refresh the page.');
            return null;
        }
    }

    function showLoadingState() {
        if (!elements.startState) return;
        elements.startState.innerHTML = `
            <div class="quiz-loading" role="status" aria-live="polite">
                <div class="quiz-loading-spinner"></div>
                <p>Loading quiz...</p>
            </div>
        `;
    }

    function hideLoadingState() {
        // Will be replaced by renderStartState
    }

    function showErrorState(message) {
        if (!elements.startState) return;
        elements.startState.innerHTML = `
            <div class="quiz-error" role="alert">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="10"></circle>
                    <line x1="12" y1="8" x2="12" y2="12"></line>
                    <line x1="12" y1="16" x2="12.01" y2="16"></line>
                </svg>
                <p>${message}</p>
                <button class="quiz-btn quiz-btn-primary" onclick="window.location.reload()">
                    Retry
                </button>
            </div>
        `;
    }

    function randomizeQuiz() {
        // Randomize question order
        questionOrder = createShuffledIndices(quizData.questions.length);

        // Randomize answer order for each MC question
        answerOrders = {};
        quizData.questions.forEach((question, index) => {
            if (question.type === 'multiple-choice' || question.type === 'scenario') {
                answerOrders[index] = createShuffledIndices(question.options.length);
            }
        });

        // Reset hint tracking
        hintsUsed = {};
        currentHintLevel = {};
    }

    function getOriginalQuestionIndex(displayIndex) {
        return questionOrder[displayIndex];
    }

    function getDisplayAnswerIndex(questionIndex, originalAnswerIndex) {
        if (!answerOrders[questionIndex]) return originalAnswerIndex;
        return answerOrders[questionIndex].indexOf(originalAnswerIndex);
    }

    function getOriginalAnswerIndex(questionIndex, displayAnswerIndex) {
        if (!answerOrders[questionIndex]) return displayAnswerIndex;
        return answerOrders[questionIndex][displayAnswerIndex];
    }

    // ==========================================
    // UI RENDERING
    // ==========================================

    function showState(state) {
        elements.startState.hidden = state !== 'start';
        elements.activeState.hidden = state !== 'active';
        elements.completeState.hidden = state !== 'complete';
    }

    function renderStartState() {
        const chapterId = elements.section.dataset.chapter;
        const progress = getChapterProgress(chapterId);
        const attempts = progress ? (progress.attempts || 1) : 0;

        elements.questionCount.textContent = quizData.questions.length;
        elements.passingScore.textContent = quizData.passingScore + '%';
        elements.bestScore.textContent = progress ? progress.percentage + '%' : '—';
        if (elements.attemptsCount) {
            elements.attemptsCount.textContent = attempts;
        }

        // Update start button text based on attempts
        if (elements.startBtn) {
            const btnText = elements.startBtn.querySelector('span');
            if (btnText) {
                if (attempts === 0) {
                    btnText.textContent = 'Start Quiz';
                } else if (progress && progress.percentage >= 70) {
                    btnText.textContent = 'Retake Quiz';
                } else {
                    btnText.textContent = 'Try Again';
                }
            }
        }

        showState('start');
    }

    function renderQuestion() {
        const originalIndex = getOriginalQuestionIndex(currentQuestion);
        const question = quizData.questions[originalIndex];
        const total = quizData.questions.length;
        const userAnswer = userAnswers[currentQuestion];

        // Update progress
        const progressPercent = ((currentQuestion + 1) / total) * 100;
        elements.progressFill.style.width = progressPercent + '%';
        elements.progressText.textContent = `Question ${currentQuestion + 1} of ${total}`;

        // Build question HTML based on type
        let questionHtml = '';

        switch (question.type) {
            case 'true-false':
                questionHtml = renderTrueFalseQuestion(question, originalIndex, userAnswer);
                break;
            case 'multiple-choice':
                questionHtml = renderMultipleChoiceQuestion(question, originalIndex, userAnswer);
                break;
            case 'scenario':
                questionHtml = renderScenarioQuestion(question, originalIndex, userAnswer);
                break;
            case 'matching':
                questionHtml = renderMatchingQuestion(question, originalIndex, userAnswer);
                break;
            case 'ordering':
                questionHtml = renderOrderingQuestion(question, originalIndex, userAnswer);
                break;
            case 'fill-blank':
                questionHtml = renderFillBlankQuestion(question, originalIndex, userAnswer);
                break;
            default:
                questionHtml = renderMultipleChoiceQuestion(question, originalIndex, userAnswer);
        }

        // Add hint button if hints available
        const hintHtml = question.hints && question.hints.length > 0
            ? renderHintButton(originalIndex)
            : '';

        // Add keyboard hint
        const keyboardHintHtml = `
            <div class="quiz-keyboard-hint">
                <span class="kbd-hint-text">Press <kbd>1</kbd>-<kbd>4</kbd> to select, <kbd>Enter</kbd> to continue${question.hints ? ', <kbd>?</kbd> for hint' : ''}</span>
            </div>
        `;

        elements.questionContainer.innerHTML = `
            <div class="quiz-question" data-question="${currentQuestion}" data-original="${originalIndex}">
                <p class="quiz-question-text">${question.question}</p>
                ${questionHtml}
                ${hintHtml}
                ${keyboardHintHtml}
            </div>
        `;

        // Update button states
        updateButtonStates();

        // Add event handlers based on question type
        addQuestionEventHandlers(question.type);

        // Reset feedback state
        feedbackShown = false;
    }

    function renderTrueFalseQuestion(question, originalIndex, userAnswer) {
        return `
            <div class="quiz-options" role="radiogroup" aria-label="Answer options">
                <label class="quiz-option ${userAnswer === 0 ? 'selected' : ''}" tabindex="0" role="radio" aria-checked="${userAnswer === 0}">
                    <input type="radio" name="q${currentQuestion}" value="0" ${userAnswer === 0 ? 'checked' : ''}>
                    <span class="quiz-option-marker"></span>
                    <span class="quiz-option-text">True</span>
                    <span class="quiz-option-key">1</span>
                </label>
                <label class="quiz-option ${userAnswer === 1 ? 'selected' : ''}" tabindex="0" role="radio" aria-checked="${userAnswer === 1}">
                    <input type="radio" name="q${currentQuestion}" value="1" ${userAnswer === 1 ? 'checked' : ''}>
                    <span class="quiz-option-marker"></span>
                    <span class="quiz-option-text">False</span>
                    <span class="quiz-option-key">2</span>
                </label>
            </div>
        `;
    }

    function renderMultipleChoiceQuestion(question, originalIndex, userAnswer) {
        const order = answerOrders[originalIndex] || question.options.map((_, i) => i);
        let optionsHtml = '<div class="quiz-options" role="radiogroup" aria-label="Answer options">';

        order.forEach((optionIndex, displayIndex) => {
            const isSelected = userAnswer !== undefined && getOriginalAnswerIndex(originalIndex, userAnswer) === optionIndex;
            optionsHtml += `
                <label class="quiz-option ${isSelected ? 'selected' : ''}" tabindex="0" role="radio" aria-checked="${isSelected}" data-original="${optionIndex}">
                    <input type="radio" name="q${currentQuestion}" value="${displayIndex}" ${isSelected ? 'checked' : ''}>
                    <span class="quiz-option-marker"></span>
                    <span class="quiz-option-text">${question.options[optionIndex]}</span>
                    <span class="quiz-option-key">${displayIndex + 1}</span>
                </label>
            `;
        });

        optionsHtml += '</div>';
        return optionsHtml;
    }

    function renderScenarioQuestion(question, originalIndex, userAnswer) {
        const scenarioHtml = `
            <div class="quiz-scenario">
                <div class="scenario-label">Scenario</div>
                <p class="scenario-text">${question.scenario}</p>
            </div>
        `;

        const optionsHtml = renderMultipleChoiceQuestion(question, originalIndex, userAnswer);
        return scenarioHtml + optionsHtml;
    }

    function renderMatchingQuestion(question, originalIndex, userAnswer) {
        const answer = userAnswer || {};
        let leftHtml = '<div class="matching-left">';
        let rightHtml = '<div class="matching-right">';

        // Shuffle right side for display
        const rightOrder = answerOrders[originalIndex] || question.pairs.map((_, i) => i);

        question.pairs.forEach((pair, index) => {
            const selectedRight = answer[index];
            leftHtml += `
                <div class="matching-item matching-item-left" data-index="${index}">
                    <span class="matching-text">${pair.left}</span>
                    <select class="matching-select" data-left="${index}" aria-label="Match for ${pair.left}">
                        <option value="">Select...</option>
                        ${rightOrder.map(ri => `
                            <option value="${ri}" ${selectedRight === ri ? 'selected' : ''}>
                                ${question.pairs[ri].right}
                            </option>
                        `).join('')}
                    </select>
                </div>
            `;
        });

        leftHtml += '</div>';
        rightHtml += '</div>';

        return `
            <div class="quiz-matching">
                ${leftHtml}
            </div>
        `;
    }

    function renderOrderingQuestion(question, originalIndex, userAnswer) {
        // If user has ordered items, use that; otherwise show shuffled
        let items = userAnswer;
        if (!items) {
            items = createShuffledIndices(question.items.length);
            // Store the initial shuffled order as the answer so button enables
            userAnswers[currentQuestion] = items;
        }

        let itemsHtml = '<div class="quiz-ordering" role="list" aria-label="Drag to reorder items">';

        items.forEach((itemIndex, position) => {
            itemsHtml += `
                <div class="ordering-item" draggable="true" data-index="${itemIndex}" data-position="${position}" role="listitem" tabindex="0">
                    <span class="ordering-handle" aria-hidden="true">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <line x1="8" y1="6" x2="16" y2="6"></line>
                            <line x1="8" y1="12" x2="16" y2="12"></line>
                            <line x1="8" y1="18" x2="16" y2="18"></line>
                        </svg>
                    </span>
                    <span class="ordering-number">${position + 1}</span>
                    <span class="ordering-text">${question.items[itemIndex]}</span>
                    <div class="ordering-controls">
                        <button class="ordering-up" aria-label="Move up" ${position === 0 ? 'disabled' : ''}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <polyline points="18 15 12 9 6 15"></polyline>
                            </svg>
                        </button>
                        <button class="ordering-down" aria-label="Move down" ${position === items.length - 1 ? 'disabled' : ''}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <polyline points="6 9 12 15 18 9"></polyline>
                            </svg>
                        </button>
                    </div>
                </div>
            `;
        });

        itemsHtml += '</div>';
        return itemsHtml;
    }

    function renderFillBlankQuestion(question, originalIndex, userAnswer) {
        const answer = userAnswer || '';
        return `
            <div class="quiz-fill-blank">
                <input
                    type="text"
                    class="fill-blank-input"
                    placeholder="Type your answer..."
                    value="${answer}"
                    aria-label="Your answer"
                    autocomplete="off"
                    autocapitalize="off"
                    spellcheck="false"
                >
            </div>
        `;
    }

    function renderHintButton(questionIndex) {
        const question = quizData.questions[questionIndex];
        const currentLevel = currentHintLevel[questionIndex] || 0;
        const maxHints = question.hints ? question.hints.length : 0;
        const hintsRemaining = maxHints - currentLevel;

        return `
            <div class="quiz-hint-container">
                <button class="quiz-hint-btn" ${hintsRemaining === 0 ? 'disabled' : ''} aria-label="Show hint">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <circle cx="12" cy="12" r="10"></circle>
                        <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path>
                        <line x1="12" y1="17" x2="12.01" y2="17"></line>
                    </svg>
                    <span>Hint${hintsRemaining > 0 ? ` (${hintsRemaining} left)` : ' (none left)'}</span>
                </button>
                <div class="quiz-hints-display" id="hints-display-${questionIndex}">
                    ${renderShownHints(questionIndex)}
                </div>
            </div>
        `;
    }

    function renderShownHints(questionIndex) {
        const question = quizData.questions[questionIndex];
        const level = currentHintLevel[questionIndex] || 0;

        if (!question.hints || level === 0) return '';

        let hintsHtml = '';
        for (let i = 0; i < level; i++) {
            hintsHtml += `
                <div class="quiz-hint ${i === level - 1 ? 'hint-new' : ''}">
                    <span class="hint-label">Hint ${i + 1}:</span>
                    <span class="hint-text">${question.hints[i]}</span>
                </div>
            `;
        }
        return hintsHtml;
    }

    function updateButtonStates() {
        const total = quizData.questions.length;

        elements.prevBtn.disabled = currentQuestion === 0;

        const isLastQuestion = currentQuestion === total - 1;

        if (immediateFeedbackMode) {
            // In immediate feedback mode, show Continue after feedback, then Next/Submit
            elements.nextBtn.hidden = isLastQuestion || feedbackShown;
            elements.submitBtn.hidden = !isLastQuestion || feedbackShown;
        } else {
            elements.nextBtn.hidden = isLastQuestion;
            elements.submitBtn.hidden = !isLastQuestion;
        }

        // Enable next/submit only if answered
        const hasAnswer = userAnswers[currentQuestion] !== undefined;
        elements.nextBtn.disabled = !hasAnswer;
        elements.submitBtn.disabled = !hasAnswer;
    }

    function addQuestionEventHandlers(questionType) {
        switch (questionType) {
            case 'multiple-choice':
            case 'true-false':
            case 'scenario':
                addOptionHandlers();
                break;
            case 'matching':
                addMatchingHandlers();
                break;
            case 'ordering':
                addOrderingHandlers();
                break;
            case 'fill-blank':
                addFillBlankHandlers();
                break;
        }

        // Add hint button handler
        const hintBtn = elements.questionContainer.querySelector('.quiz-hint-btn');
        if (hintBtn) {
            hintBtn.addEventListener('click', handleHintRequest);
        }
    }

    function addOptionHandlers() {
        elements.questionContainer.querySelectorAll('.quiz-option input').forEach(input => {
            input.addEventListener('change', handleOptionSelect);
        });

        // Add click handler for the label itself (for better UX)
        elements.questionContainer.querySelectorAll('.quiz-option').forEach(option => {
            option.addEventListener('click', function(e) {
                if (feedbackShown) return; // Don't allow changes during feedback
                const input = this.querySelector('input');
                if (input && !input.checked) {
                    input.checked = true;
                    input.dispatchEvent(new Event('change', { bubbles: true }));
                }
            });
        });
    }

    function addMatchingHandlers() {
        elements.questionContainer.querySelectorAll('.matching-select').forEach(select => {
            select.addEventListener('change', handleMatchingSelect);
        });
    }

    function addOrderingHandlers() {
        const container = elements.questionContainer.querySelector('.quiz-ordering');
        if (!container) return;

        // Drag and drop
        let draggedItem = null;

        container.querySelectorAll('.ordering-item').forEach(item => {
            item.addEventListener('dragstart', (e) => {
                draggedItem = item;
                item.classList.add('dragging');
                e.dataTransfer.effectAllowed = 'move';
            });

            item.addEventListener('dragend', () => {
                item.classList.remove('dragging');
                draggedItem = null;
                updateOrderingAnswer();
            });

            item.addEventListener('dragover', (e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';

                if (draggedItem && draggedItem !== item) {
                    const rect = item.getBoundingClientRect();
                    const midY = rect.top + rect.height / 2;

                    if (e.clientY < midY) {
                        container.insertBefore(draggedItem, item);
                    } else {
                        container.insertBefore(draggedItem, item.nextSibling);
                    }
                }
            });
        });

        // Button controls
        container.querySelectorAll('.ordering-up').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const item = e.target.closest('.ordering-item');
                const prev = item.previousElementSibling;
                if (prev) {
                    container.insertBefore(item, prev);
                    updateOrderingAnswer();
                    renderOrderingNumbers();
                }
            });
        });

        container.querySelectorAll('.ordering-down').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const item = e.target.closest('.ordering-item');
                const next = item.nextElementSibling;
                if (next) {
                    container.insertBefore(next, item);
                    updateOrderingAnswer();
                    renderOrderingNumbers();
                }
            });
        });
    }

    function renderOrderingNumbers() {
        const container = elements.questionContainer.querySelector('.quiz-ordering');
        if (!container) return;

        container.querySelectorAll('.ordering-item').forEach((item, index) => {
            item.querySelector('.ordering-number').textContent = index + 1;
            item.dataset.position = index;

            const upBtn = item.querySelector('.ordering-up');
            const downBtn = item.querySelector('.ordering-down');

            if (upBtn) upBtn.disabled = index === 0;
            if (downBtn) downBtn.disabled = index === container.children.length - 1;
        });
    }

    function updateOrderingAnswer() {
        const container = elements.questionContainer.querySelector('.quiz-ordering');
        if (!container) return;

        const order = Array.from(container.querySelectorAll('.ordering-item'))
            .map(item => parseInt(item.dataset.index, 10));

        userAnswers[currentQuestion] = order;
        updateButtonStates();
    }

    function addFillBlankHandlers() {
        const input = elements.questionContainer.querySelector('.fill-blank-input');
        if (input) {
            input.addEventListener('input', handleFillBlankInput);
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && input.value.trim()) {
                    e.preventDefault();
                    const isLast = currentQuestion === quizData.questions.length - 1;
                    if (isLast) {
                        handleSubmit();
                    } else {
                        handleNext();
                    }
                }
            });
            // Focus the input
            input.focus();
        }
    }

    // ==========================================
    // IMMEDIATE FEEDBACK
    // ==========================================

    function showImmediateFeedback() {
        if (!immediateFeedbackMode) return;

        const originalIndex = getOriginalQuestionIndex(currentQuestion);
        const question = quizData.questions[originalIndex];
        const userAnswer = userAnswers[currentQuestion];

        const isCorrect = checkAnswer(question, originalIndex, userAnswer);

        feedbackShown = true;

        // Add feedback class to question container
        const questionEl = elements.questionContainer.querySelector('.quiz-question');
        questionEl.classList.add('feedback-shown', isCorrect ? 'answer-correct' : 'answer-incorrect');

        // Mark correct and incorrect options for MC/TF questions
        if (question.type === 'multiple-choice' || question.type === 'true-false' || question.type === 'scenario') {
            markCorrectIncorrectOptions(question, originalIndex, userAnswer);
        }

        // Show explanation
        const feedbackHtml = `
            <div class="quiz-feedback ${isCorrect ? 'feedback-correct' : 'feedback-incorrect'}">
                <div class="feedback-header">
                    <span class="feedback-icon">
                        ${isCorrect
                            ? '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg>'
                            : '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>'
                        }
                    </span>
                    <span class="feedback-title">${isCorrect ? 'Correct!' : 'Not quite right'}</span>
                </div>
                <div class="feedback-explanation">
                    <p>${question.explanation}</p>
                </div>
                <button class="quiz-btn quiz-btn-primary quiz-continue-btn">
                    Continue
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <line x1="5" y1="12" x2="19" y2="12"></line>
                        <polyline points="12 5 19 12 12 19"></polyline>
                    </svg>
                </button>
            </div>
        `;

        // Insert feedback after options
        const optionsEl = elements.questionContainer.querySelector('.quiz-options, .quiz-matching, .quiz-ordering, .quiz-fill-blank');
        if (optionsEl) {
            optionsEl.insertAdjacentHTML('afterend', feedbackHtml);
        }

        // Add continue button handler
        const continueBtn = elements.questionContainer.querySelector('.quiz-continue-btn');
        if (continueBtn) {
            continueBtn.addEventListener('click', handleContinueAfterFeedback);
            continueBtn.focus();
        }

        // Hide navigation buttons during feedback
        elements.nextBtn.hidden = true;
        elements.submitBtn.hidden = true;
        elements.prevBtn.disabled = true;

        // Disable option selection
        elements.questionContainer.querySelectorAll('.quiz-option input').forEach(input => {
            input.disabled = true;
        });
    }

    function markCorrectIncorrectOptions(question, originalIndex, userAnswer) {
        const options = elements.questionContainer.querySelectorAll('.quiz-option');

        let correctAnswerIndex;
        if (question.type === 'true-false') {
            correctAnswerIndex = question.correct ? 0 : 1;
        } else {
            correctAnswerIndex = getDisplayAnswerIndex(originalIndex, question.correct);
        }

        options.forEach((option, index) => {
            const input = option.querySelector('input');
            const displayIndex = parseInt(input.value, 10);

            if (displayIndex === correctAnswerIndex) {
                option.classList.add('option-correct');
            } else if (displayIndex === userAnswer) {
                option.classList.add('option-incorrect');
            }
        });
    }

    function checkAnswer(question, originalIndex, userAnswer) {
        switch (question.type) {
            case 'true-false':
                const correctTF = question.correct ? 0 : 1;
                return userAnswer === correctTF;

            case 'multiple-choice':
            case 'scenario':
                const originalAnswer = getOriginalAnswerIndex(originalIndex, userAnswer);
                return originalAnswer === question.correct;

            case 'matching':
                if (!userAnswer) return false;
                return question.pairs.every((pair, index) => userAnswer[index] === index);

            case 'ordering':
                if (!userAnswer) return false;
                return userAnswer.every((itemIndex, position) =>
                    itemIndex === question.correctOrder[position]
                );

            case 'fill-blank':
                if (!userAnswer) return false;
                const normalizedAnswer = userAnswer.toLowerCase().trim();
                const acceptableAnswers = question.acceptableAnswers || [question.answer];
                return acceptableAnswers.some(ans => ans.toLowerCase().trim() === normalizedAnswer);

            default:
                return false;
        }
    }

    function handleContinueAfterFeedback() {
        feedbackShown = false;

        const total = quizData.questions.length;
        const isLastQuestion = currentQuestion === total - 1;

        if (isLastQuestion) {
            renderResults();
        } else {
            currentQuestion++;
            renderQuestion();
        }
    }

    // ==========================================
    // RESULTS RENDERING
    // ==========================================

    function renderResults() {
        const total = quizData.questions.length;
        let correct = 0;
        const questionResponses = [];

        quizData.questions.forEach((question, originalIndex) => {
            // Find the display index for this original question
            const displayIndex = questionOrder.indexOf(originalIndex);
            const userAnswer = userAnswers[displayIndex];
            const isCorrect = checkAnswer(question, originalIndex, userAnswer);

            if (isCorrect) {
                correct++;
            }

            // Collect response data for analytics
            let correctAnswer;
            let formattedUserAnswer = userAnswer;

            switch (question.type) {
                case 'true-false':
                    correctAnswer = question.correct;
                    formattedUserAnswer = userAnswer === 0;
                    break;
                case 'multiple-choice':
                case 'scenario':
                    correctAnswer = question.options[question.correct];
                    formattedUserAnswer = question.options[getOriginalAnswerIndex(originalIndex, userAnswer)];
                    break;
                case 'matching':
                    correctAnswer = 'all-matched';
                    break;
                case 'ordering':
                    correctAnswer = question.correctOrder;
                    break;
                case 'fill-blank':
                    correctAnswer = question.answer;
                    break;
            }

            questionResponses.push({
                questionIndex: originalIndex,
                questionType: question.type,
                questionText: question.question,
                userAnswer: formattedUserAnswer,
                correctAnswer: correctAnswer,
                isCorrect: isCorrect,
                hintsUsedForQuestion: hintsUsed[originalIndex] || 0
            });
        });

        const percentage = Math.round((correct / total) * 100);
        const passed = percentage >= quizData.passingScore;

        // Count total hints used
        const totalHintsUsed = Object.values(hintsUsed).reduce((sum, count) => sum + count, 0);

        // Save progress (with question responses for server analytics)
        const chapterId = elements.section.dataset.chapter;
        saveProgress(chapterId, correct, total, totalHintsUsed, questionResponses);

        // Get updated progress to show attempt count
        const progress = getChapterProgress(chapterId);
        const attemptCount = progress ? (progress.attempts || 1) : 1;

        // Update UI
        elements.scoreValue.textContent = percentage + '%';

        // Update retry button with attempt number
        if (elements.retryBtn) {
            const retryText = elements.retryBtn.querySelector('span');
            if (retryText) {
                retryText.textContent = `Try Again (Attempt ${attemptCount + 1})`;
            }
        }

        if (passed) {
            elements.resultIcon.innerHTML = `
                <svg class="result-icon result-icon-pass" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                    <polyline points="22 4 12 14.01 9 11.01"></polyline>
                </svg>
            `;
            elements.resultMessage.innerHTML = `<span class="attempt-badge">Attempt ${attemptCount}</span> Excellent work! You've passed with ${correct} out of ${total} correct.`;
            elements.section.classList.add('quiz-passed');
        } else {
            elements.resultIcon.innerHTML = `
                <svg class="result-icon result-icon-fail" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="10"></circle>
                    <line x1="15" y1="9" x2="9" y2="15"></line>
                    <line x1="9" y1="9" x2="15" y2="15"></line>
                </svg>
            `;
            elements.resultMessage.innerHTML = `<span class="attempt-badge">Attempt ${attemptCount}</span> You scored ${correct} out of ${total}. Need ${quizData.passingScore}% to pass.`;
            elements.section.classList.remove('quiz-passed');
        }

        // Show hints used info if applicable
        if (totalHintsUsed > 0) {
            const hintPenalty = Math.min(totalHintsUsed * 5, 25);
            const hintsNote = document.createElement('p');
            hintsNote.className = 'quiz-hints-note';
            hintsNote.innerHTML = `<span class="hints-count">${totalHintsUsed} hint${totalHintsUsed > 1 ? 's' : ''} used</span> <span class="hints-penalty" title="Each hint reduces your score by 5%, up to 25% maximum">(-${hintPenalty}% penalty)</span>`;
            elements.resultMessage.insertAdjacentElement('afterend', hintsNote);
        }

        // Render review (hidden by default)
        renderReview();
        elements.reviewContainer.hidden = true;

        // Render navigation CTAs
        renderNavigationCtas(passed, chapterId);

        showState('complete');
    }

    function renderNavigationCtas(passed, chapterId) {
        if (!elements.navigationCtas) return;

        const currentChapter = parseInt(chapterId, 10);
        const nextChapter = currentChapter + 1;

        // Show navigation CTAs container
        elements.navigationCtas.style.display = 'flex';

        // Show next quiz link if not the last chapter and user passed
        if (passed && nextChapter <= 20) {
            const nextChapterUrl = getNextChapterUrl(currentChapter);
            const nextChapterTitle = getNextChapterTitle(currentChapter);

            // Next Quiz link (goes directly to quiz section)
            if (elements.ctaNextQuiz && nextChapterUrl) {
                elements.ctaNextQuiz.href = nextChapterUrl + '#chapter-quiz';
                elements.ctaNextQuiz.style.display = 'flex';
                if (elements.ctaNextQuizTitle && nextChapterTitle) {
                    elements.ctaNextQuizTitle.textContent = nextChapterTitle;
                }
            }

            // Next Chapter link (goes to chapter content)
            if (elements.ctaNext && nextChapterUrl) {
                elements.ctaNext.href = nextChapterUrl;
                elements.ctaNext.style.display = 'flex';
                if (elements.ctaNextTitle && nextChapterTitle) {
                    elements.ctaNextTitle.textContent = nextChapterTitle;
                }
            }
        }
    }

    function getNextChapterUrl(currentChapter) {
        // Primary: use data attribute from Nunjucks template
        if (elements.section && elements.section.dataset.nextChapterUrl) {
            return elements.section.dataset.nextChapterUrl;
        }

        // Fallback: look for chapter navigation links on the page
        const nextLink = document.querySelector('.chapter-nav-next');
        if (nextLink) {
            return nextLink.href;
        }

        return null;
    }

    function getNextChapterTitle(currentChapter) {
        // Primary: use data attribute from Nunjucks template
        if (elements.section && elements.section.dataset.nextChapterTitle) {
            return elements.section.dataset.nextChapterTitle;
        }

        // Fallback: look for chapter navigation on the page
        const nextLink = document.querySelector('.chapter-nav-next');
        if (nextLink) {
            const titleEl = nextLink.querySelector('.chapter-nav-title');
            if (titleEl) {
                return titleEl.textContent.trim();
            }
        }
        return `Chapter ${currentChapter + 1}`;
    }

    function renderReview() {
        let reviewHtml = '<div class="quiz-review-list">';

        quizData.questions.forEach((question, originalIndex) => {
            const displayIndex = questionOrder.indexOf(originalIndex);
            const userAnswer = userAnswers[displayIndex];

            const isCorrect = checkAnswer(question, originalIndex, userAnswer);

            let correctText = '';
            let userText = '';

            switch (question.type) {
                case 'true-false':
                    correctText = question.correct ? 'True' : 'False';
                    userText = userAnswer === 0 ? 'True' : 'False';
                    break;

                case 'multiple-choice':
                case 'scenario':
                    correctText = question.options[question.correct];
                    const originalUserAnswer = getOriginalAnswerIndex(originalIndex, userAnswer);
                    userText = question.options[originalUserAnswer] || 'No answer';
                    break;

                case 'matching':
                    correctText = 'All pairs matched correctly';
                    const matchedCount = userAnswer
                        ? question.pairs.filter((_, i) => userAnswer[i] === i).length
                        : 0;
                    userText = `${matchedCount} of ${question.pairs.length} matched correctly`;
                    break;

                case 'ordering':
                    correctText = question.items.map((_, i) => question.items[question.correctOrder[i]]).join(' → ');
                    userText = userAnswer
                        ? userAnswer.map(i => question.items[i]).join(' → ')
                        : 'No answer';
                    break;

                case 'fill-blank':
                    correctText = question.answer;
                    userText = userAnswer || 'No answer';
                    break;
            }

            reviewHtml += `
                <div class="quiz-review-item ${isCorrect ? 'correct' : 'incorrect'}">
                    <div class="review-status">
                        ${isCorrect
                            ? '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg>'
                            : '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>'
                        }
                    </div>
                    <div class="review-content">
                        <p class="review-question">${question.question}</p>
                        <p class="review-answer">
                            Your answer: <span class="${isCorrect ? 'correct' : 'incorrect'}">${userText}</span>
                            ${!isCorrect ? `<br>Correct answer: <span class="correct">${correctText}</span>` : ''}
                        </p>
                        <p class="review-explanation">${question.explanation}</p>
                    </div>
                </div>
            `;
        });

        reviewHtml += '</div>';
        elements.reviewContainer.innerHTML = reviewHtml;
    }

    // ==========================================
    // EVENT HANDLERS
    // ==========================================

    function handleOptionSelect(e) {
        if (feedbackShown) return;

        const value = parseInt(e.target.value, 10);
        userAnswers[currentQuestion] = value;

        // Update selected state visually
        elements.questionContainer.querySelectorAll('.quiz-option').forEach(opt => {
            opt.classList.remove('selected');
            opt.setAttribute('aria-checked', 'false');
        });
        const selectedOption = e.target.closest('.quiz-option');
        selectedOption.classList.add('selected');
        selectedOption.setAttribute('aria-checked', 'true');

        // Update buttons
        updateButtonStates();

        // Show immediate feedback if enabled
        if (immediateFeedbackMode) {
            showImmediateFeedback();
        }
    }

    function handleMatchingSelect(e) {
        if (feedbackShown) return;

        const leftIndex = parseInt(e.target.dataset.left, 10);
        const rightIndex = e.target.value ? parseInt(e.target.value, 10) : null;

        if (!userAnswers[currentQuestion]) {
            userAnswers[currentQuestion] = {};
        }

        if (rightIndex !== null) {
            userAnswers[currentQuestion][leftIndex] = rightIndex;
        } else {
            delete userAnswers[currentQuestion][leftIndex];
        }

        // Check if all matched
        const originalIndex = getOriginalQuestionIndex(currentQuestion);
        const question = quizData.questions[originalIndex];
        const allMatched = Object.keys(userAnswers[currentQuestion]).length === question.pairs.length;

        if (allMatched) {
            updateButtonStates();
            if (immediateFeedbackMode) {
                showImmediateFeedback();
            }
        }
    }

    function handleFillBlankInput(e) {
        if (feedbackShown) return;

        userAnswers[currentQuestion] = e.target.value.trim();
        updateButtonStates();
    }

    function handleHintRequest() {
        const originalIndex = getOriginalQuestionIndex(currentQuestion);
        const question = quizData.questions[originalIndex];

        if (!question.hints) return;

        const currentLevel = currentHintLevel[originalIndex] || 0;
        if (currentLevel >= question.hints.length) return;

        // Increment hint level
        currentHintLevel[originalIndex] = currentLevel + 1;
        hintsUsed[originalIndex] = (hintsUsed[originalIndex] || 0) + 1;

        // Update hints display
        const hintsDisplay = document.getElementById(`hints-display-${originalIndex}`);
        if (hintsDisplay) {
            hintsDisplay.innerHTML = renderShownHints(originalIndex);
        }

        // Update hint button
        const hintBtn = elements.questionContainer.querySelector('.quiz-hint-btn');
        if (hintBtn) {
            const remaining = question.hints.length - currentHintLevel[originalIndex];
            hintBtn.querySelector('span').textContent =
                remaining > 0 ? `Hint (${remaining} left)` : 'Hint (none left)';
            hintBtn.disabled = remaining === 0;
        }
    }

    function handleStart() {
        // First, collect email if we don't have it
        if (shouldCollectEmail()) {
            showEmailModal(function() {
                // After email, show onboarding if needed
                if (shouldShowOnboarding()) {
                    showOnboarding(function() {
                        beginQuiz();
                    });
                } else {
                    beginQuiz();
                }
            });
        } else if (shouldShowOnboarding()) {
            // Have email, but show onboarding for first-time users
            showOnboarding(function() {
                beginQuiz();
            });
        } else {
            beginQuiz();
        }
    }

    function beginQuiz() {
        currentQuestion = 0;
        userAnswers = [];
        quizStarted = true;
        hintsUsed = {};
        currentHintLevel = {};
        feedbackShown = false;

        // Randomize quiz
        randomizeQuiz();

        showState('active');
        renderQuestion();
    }

    function handlePrev() {
        if (currentQuestion > 0 && !feedbackShown) {
            currentQuestion--;
            renderQuestion();
        }
    }

    function handleNext() {
        if (currentQuestion < quizData.questions.length - 1 && !feedbackShown) {
            if (!immediateFeedbackMode) {
                currentQuestion++;
                renderQuestion();
            } else if (userAnswers[currentQuestion] !== undefined && !feedbackShown) {
                showImmediateFeedback();
            }
        }
    }

    function handleSubmit() {
        if (!feedbackShown) {
            if (immediateFeedbackMode && userAnswers[currentQuestion] !== undefined) {
                showImmediateFeedback();
            } else {
                renderResults();
            }
        }
    }

    function handleRetry() {
        currentQuestion = 0;
        userAnswers = [];
        hintsUsed = {};
        currentHintLevel = {};
        feedbackShown = false;
        elements.section.classList.remove('quiz-passed');

        // Remove hints note if present
        const hintsNote = elements.completeState.querySelector('.quiz-hints-note');
        if (hintsNote) hintsNote.remove();

        // Re-randomize quiz
        randomizeQuiz();

        showState('active');
        renderQuestion();
    }

    function handleReviewToggle() {
        const isHidden = elements.reviewContainer.hidden;
        elements.reviewContainer.hidden = !isHidden;
        elements.reviewToggle.querySelector('span').textContent =
            isHidden ? 'Hide Answers' : 'Review Answers';
    }

    // ==========================================
    // KEYBOARD NAVIGATION
    // ==========================================

    function handleKeyboardNavigation(e) {
        if (!quizStarted) return;
        if (elements.activeState.hidden) return;

        const originalIndex = getOriginalQuestionIndex(currentQuestion);
        const question = quizData.questions[originalIndex];

        // Don't handle keys during feedback except Enter and Escape
        if (feedbackShown && e.key !== 'Enter' && e.key !== 'Escape') return;

        switch (e.key) {
            case '1':
            case '2':
            case '3':
            case '4':
                // Number keys select answer (for MC and T/F)
                if (question.type === 'multiple-choice' || question.type === 'scenario' || question.type === 'true-false') {
                    e.preventDefault();
                    selectOptionByNumber(parseInt(e.key, 10) - 1);
                }
                break;

            case 'Enter':
                e.preventDefault();
                if (feedbackShown) {
                    handleContinueAfterFeedback();
                } else if (userAnswers[currentQuestion] !== undefined) {
                    const isLast = currentQuestion === quizData.questions.length - 1;
                    if (isLast) {
                        handleSubmit();
                    } else {
                        handleNext();
                    }
                }
                break;

            case 'ArrowLeft':
            case 'Backspace':
                if (!feedbackShown) {
                    e.preventDefault();
                    handlePrev();
                }
                break;

            case 'ArrowRight':
                if (!feedbackShown && userAnswers[currentQuestion] !== undefined) {
                    e.preventDefault();
                    handleNext();
                }
                break;

            case '?':
            case '/':
                // Show hint
                e.preventDefault();
                handleHintRequest();
                break;

            case 'Escape':
                // Clear current selection or close feedback
                e.preventDefault();
                if (feedbackShown) {
                    handleContinueAfterFeedback();
                }
                break;

            case 'Tab':
                // Let Tab work naturally for accessibility
                break;

            case 'ArrowUp':
            case 'ArrowDown':
                // Navigate ordering items
                if (question.type === 'ordering') {
                    e.preventDefault();
                    handleOrderingKeyboard(e.key === 'ArrowUp' ? 'up' : 'down');
                }
                break;
        }
    }

    function selectOptionByNumber(index) {
        if (feedbackShown) return;

        const options = elements.questionContainer.querySelectorAll('.quiz-option');
        if (index >= 0 && index < options.length) {
            const input = options[index].querySelector('input');
            if (input && !input.disabled) {
                input.checked = true;
                input.dispatchEvent(new Event('change', { bubbles: true }));
            }
        }
    }

    function handleOrderingKeyboard(direction) {
        const container = elements.questionContainer.querySelector('.quiz-ordering');
        if (!container) return;

        const focused = document.activeElement;
        if (!focused || !focused.classList.contains('ordering-item')) return;

        if (direction === 'up') {
            const prev = focused.previousElementSibling;
            if (prev) {
                container.insertBefore(focused, prev);
                focused.focus();
                updateOrderingAnswer();
                renderOrderingNumbers();
            }
        } else {
            const next = focused.nextElementSibling;
            if (next) {
                container.insertBefore(next, focused);
                focused.focus();
                updateOrderingAnswer();
                renderOrderingNumbers();
            }
        }
    }

    // ==========================================
    // INITIALIZATION
    // ==========================================

    async function init() {
        if (!cacheElements()) {
            // No quiz section on this page
            return;
        }

        const chapterId = elements.section.dataset.chapter;
        quizData = await loadQuizData(chapterId);

        if (!quizData) {
            // No quiz available for this chapter
            elements.section.hidden = true;
            return;
        }

        // Bind event listeners
        elements.startBtn.addEventListener('click', handleStart);
        elements.prevBtn.addEventListener('click', handlePrev);
        elements.nextBtn.addEventListener('click', handleNext);
        elements.submitBtn.addEventListener('click', handleSubmit);
        elements.retryBtn.addEventListener('click', handleRetry);
        elements.reviewToggle.addEventListener('click', handleReviewToggle);

        // Keyboard navigation
        document.addEventListener('keydown', handleKeyboardNavigation);

        // Render initial state
        renderStartState();
    }

    // Run when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // Sync existing progress to server once on page load (if any exists)
    // This ensures offline progress eventually reaches the server
    if (typeof window !== 'undefined') {
        setTimeout(syncAllProgressToServer, 2000); // Delay to not block page load
    }

    // ==========================================
    // ACHIEVEMENT TOAST NOTIFICATIONS (Fix #3)
    // ==========================================

    const ACHIEVEMENT_INFO = {
        'first-steps': {
            title: 'First Steps',
            description: 'You completed your first quiz!',
            icon: '🎯'
        },
        'perfect-score': {
            title: 'Perfect Score',
            description: '100% on a chapter quiz — flawless.',
            icon: '💯'
        },
        'scholar': {
            title: 'Scholar',
            description: 'You\'ve mastered 10 chapters.',
            icon: '📚'
        },
        'philosopher': {
            title: 'Philosopher',
            description: 'All 20 chapters mastered. You\'ve earned the philosopher\'s crown.',
            icon: '🏛️'
        },
        'streak-master': {
            title: 'Streak Master',
            description: '7-day study streak!',
            icon: '🔥'
        }
    };

    function showAchievementToast(achievementId) {
        const info = ACHIEVEMENT_INFO[achievementId];
        if (!info) return;

        // Check if this is the philosopher achievement — show celebration instead
        if (achievementId === 'philosopher') {
            showCompletionCelebration();
            return;
        }

        const toast = document.createElement('div');
        toast.className = 'achievement-toast';
        toast.setAttribute('role', 'status');
        toast.setAttribute('aria-live', 'polite');
        toast.innerHTML = `
            <span class="achievement-toast-icon">${info.icon}</span>
            <div class="achievement-toast-content">
                <span class="achievement-toast-label">Achievement Unlocked</span>
                <span class="achievement-toast-title">${info.title}</span>
                <span class="achievement-toast-desc">${info.description}</span>
            </div>
            <button class="achievement-toast-close" aria-label="Dismiss">&times;</button>
        `;

        document.body.appendChild(toast);

        // Trigger animation
        requestAnimationFrame(function() {
            toast.classList.add('is-visible');
        });

        // Dismiss on click
        toast.querySelector('.achievement-toast-close').addEventListener('click', function() {
            dismissToast(toast);
        });

        // Auto-dismiss after 5 seconds
        setTimeout(function() {
            dismissToast(toast);
        }, 5000);
    }

    function dismissToast(toast) {
        if (!toast || !toast.parentNode) return;
        toast.classList.remove('is-visible');
        toast.classList.add('is-dismissing');
        setTimeout(function() {
            if (toast.parentNode) toast.parentNode.removeChild(toast);
        }, 300);
    }

    // Listen for achievement events
    window.addEventListener('achievementUnlocked', function(e) {
        if (e.detail && e.detail.achievementId) {
            showAchievementToast(e.detail.achievementId);
        }
    });

    // ==========================================
    // COMPLETION CELEBRATION (Fix #8)
    // ==========================================

    function showCompletionCelebration() {
        const overlay = document.createElement('div');
        overlay.className = 'completion-overlay';
        overlay.setAttribute('role', 'dialog');
        overlay.setAttribute('aria-label', 'Congratulations');
        overlay.innerHTML = `
            <div class="completion-content">
                <div class="completion-icon">🏛️</div>
                <h2 class="completion-title">THE PHILOSOPHER'S CROWN</h2>
                <p class="completion-subtitle">You've mastered all 20 chapters.</p>
                <p class="completion-message">
                    Socrates spent a lifetime examining ideas. Aristotle catalogued the art of persuasion.
                    Cicero practiced until his words could move empires. You've walked the same path they walked
                    — and earned the right to call yourself a student of rhetoric.
                </p>
                <p class="completion-quote">
                    <em>"The unexamined life is not worth living."</em> — Socrates
                </p>
                <div class="completion-actions">
                    <a href="/progress/" class="quiz-btn quiz-btn-primary">View Your Record</a>
                    <button class="quiz-btn quiz-btn-secondary completion-close">Continue</button>
                </div>
            </div>
        `;

        document.body.appendChild(overlay);

        requestAnimationFrame(function() {
            overlay.classList.add('is-visible');
        });

        overlay.querySelector('.completion-close').addEventListener('click', function() {
            overlay.classList.remove('is-visible');
            setTimeout(function() {
                if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
            }, 300);
        });

        // Close on Escape
        function handleEscape(e) {
            if (e.key === 'Escape') {
                overlay.classList.remove('is-visible');
                setTimeout(function() {
                    if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
                }, 300);
                document.removeEventListener('keydown', handleEscape);
            }
        }
        document.addEventListener('keydown', handleEscape);
    }

    // ==========================================
    // EMAIL COLLECTION MODAL
    // ==========================================

    /**
     * Check if we need to collect email
     */
    function shouldCollectEmail() {
        return !getUserEmail();
    }

    /**
     * Show email collection modal
     */
    function showEmailModal(callback) {
        const overlay = document.createElement('div');
        overlay.className = 'quiz-email-overlay';
        overlay.setAttribute('role', 'dialog');
        overlay.setAttribute('aria-label', 'Enter your email');
        overlay.innerHTML = `
            <div class="quiz-email-content">
                <h3 class="quiz-email-title">Before you begin</h3>
                <p class="quiz-email-desc">Enter your email to track your progress across all quizzes and chapters.</p>
                <form class="quiz-email-form" id="quiz-email-form">
                    <input type="email"
                           id="quiz-email-input"
                           class="quiz-email-input"
                           placeholder="your@email.com"
                           autocomplete="email"
                           required>
                    <p class="quiz-email-error" id="quiz-email-error" hidden>Please enter a valid email address</p>
                    <button type="submit" class="quiz-btn quiz-btn-primary quiz-email-submit">
                        <span>Continue to Quiz</span>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="9 18 15 12 9 6"></polyline>
                        </svg>
                    </button>
                </form>
                <p class="quiz-email-privacy">We'll never share your email or send spam. It's just for tracking your learning progress.</p>
            </div>
        `;

        document.body.appendChild(overlay);

        const input = overlay.querySelector('#quiz-email-input');
        const form = overlay.querySelector('#quiz-email-form');
        const errorEl = overlay.querySelector('#quiz-email-error');

        requestAnimationFrame(function() {
            overlay.classList.add('is-visible');
            input.focus();
        });

        form.addEventListener('submit', function(e) {
            e.preventDefault();
            const email = input.value.trim();

            if (!isValidEmail(email)) {
                errorEl.hidden = false;
                input.classList.add('is-error');
                input.focus();
                return;
            }

            // Save email
            setUserEmail(email);

            // Close modal
            overlay.classList.remove('is-visible');
            setTimeout(function() {
                if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
                if (callback) callback();
            }, 200);
        });

        // Clear error on input
        input.addEventListener('input', function() {
            errorEl.hidden = true;
            input.classList.remove('is-error');
        });
    }

    // ==========================================
    // FIRST-TIME QUIZ ONBOARDING (Fix #4)
    // ==========================================

    const ONBOARDING_KEY = 'debateGuideOnboardingSeen';

    function shouldShowOnboarding() {
        try {
            return !localStorage.getItem(ONBOARDING_KEY);
        } catch (e) {
            return false;
        }
    }

    function showOnboarding(callback) {
        const overlay = document.createElement('div');
        overlay.className = 'quiz-onboarding-overlay';
        overlay.setAttribute('role', 'dialog');
        overlay.setAttribute('aria-label', 'Quiz tips');
        overlay.innerHTML = `
            <div class="quiz-onboarding-content">
                <h3 class="quiz-onboarding-title">Quick tips before you start</h3>
                <ul class="quiz-onboarding-tips">
                    <li>
                        <kbd>1</kbd><kbd>2</kbd><kbd>3</kbd><kbd>4</kbd>
                        <span>Select answers with number keys</span>
                    </li>
                    <li>
                        <kbd>?</kbd>
                        <span>Press for hints (small score penalty)</span>
                    </li>
                    <li>
                        <kbd>Enter</kbd>
                        <span>Continue to the next question</span>
                    </li>
                    <li>
                        <span class="onboarding-tip-icon">💾</span>
                        <span>Your progress saves automatically</span>
                    </li>
                </ul>
                <a href="/how-quizzes-work/" class="quiz-onboarding-help">Learn more about quizzes →</a>
                <button class="quiz-btn quiz-btn-primary quiz-onboarding-start">Got it — Start Quiz</button>
            </div>
        `;

        document.body.appendChild(overlay);

        requestAnimationFrame(function() {
            overlay.classList.add('is-visible');
        });

        overlay.querySelector('.quiz-onboarding-start').addEventListener('click', function() {
            try {
                localStorage.setItem(ONBOARDING_KEY, '1');
            } catch (e) {}

            overlay.classList.remove('is-visible');
            setTimeout(function() {
                if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
                if (callback) callback();
            }, 200);
        });
    }

    // ==========================================
    // GLOBAL EXPORTS
    // ==========================================

    window.DebateGuideQuiz = {
        getProgress: getProgress,
        getChapterProgress: getChapterProgress,
        getAchievements: getAchievements,
        getDueReviews: getDueReviews,
        getSpacedRepetitionData: getSpacedRepetitionData,
        getAnonymousUserId: getAnonymousUserId,
        getUserEmail: getUserEmail
    };

})();

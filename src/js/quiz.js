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

    function saveProgress(chapterId, score, total, hintsUsedCount = 0) {
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
        try {
            // Pad chapter ID to match file naming
            const paddedId = String(chapterId).padStart(2, '0');
            const response = await fetch(`/quizzes/chapter-${paddedId}.json`);

            if (!response.ok) {
                console.log(`No quiz available for chapter ${chapterId}`);
                return null;
            }

            return await response.json();
        } catch (e) {
            console.error('Failed to load quiz data:', e);
            return null;
        }
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

        elements.questionCount.textContent = quizData.questions.length;
        elements.passingScore.textContent = quizData.passingScore + '%';
        elements.bestScore.textContent = progress ? progress.percentage + '%' : '—';

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

        quizData.questions.forEach((question, originalIndex) => {
            // Find the display index for this original question
            const displayIndex = questionOrder.indexOf(originalIndex);
            const userAnswer = userAnswers[displayIndex];

            if (checkAnswer(question, originalIndex, userAnswer)) {
                correct++;
            }
        });

        const percentage = Math.round((correct / total) * 100);
        const passed = percentage >= quizData.passingScore;

        // Count total hints used
        const totalHintsUsed = Object.values(hintsUsed).reduce((sum, count) => sum + count, 0);

        // Save progress
        const chapterId = elements.section.dataset.chapter;
        saveProgress(chapterId, correct, total, totalHintsUsed);

        // Update UI
        elements.scoreValue.textContent = percentage + '%';

        if (passed) {
            elements.resultIcon.innerHTML = `
                <svg class="result-icon result-icon-pass" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                    <polyline points="22 4 12 14.01 9 11.01"></polyline>
                </svg>
            `;
            elements.resultMessage.textContent = `Excellent work! You've passed the quiz with ${correct} out of ${total} correct.`;
            elements.section.classList.add('quiz-passed');
        } else {
            elements.resultIcon.innerHTML = `
                <svg class="result-icon result-icon-fail" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="10"></circle>
                    <line x1="15" y1="9" x2="9" y2="15"></line>
                    <line x1="9" y1="9" x2="15" y2="15"></line>
                </svg>
            `;
            elements.resultMessage.textContent = `You scored ${correct} out of ${total}. Review the chapter and try again!`;
            elements.section.classList.remove('quiz-passed');
        }

        // Show hints used info if applicable
        if (totalHintsUsed > 0) {
            const hintsNote = document.createElement('p');
            hintsNote.className = 'quiz-hints-note';
            hintsNote.textContent = `(${totalHintsUsed} hint${totalHintsUsed > 1 ? 's' : ''} used)`;
            elements.resultMessage.insertAdjacentElement('afterend', hintsNote);
        }

        // Render review (hidden by default)
        renderReview();
        elements.reviewContainer.hidden = true;

        showState('complete');
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

    // ==========================================
    // GLOBAL EXPORTS
    // ==========================================

    window.DebateGuideQuiz = {
        getProgress: getProgress,
        getChapterProgress: getChapterProgress,
        getAchievements: getAchievements,
        getDueReviews: getDueReviews,
        getSpacedRepetitionData: getSpacedRepetitionData
    };

})();

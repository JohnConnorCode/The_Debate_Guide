/**
 * The Debate Guide - Chapter Quiz System
 *
 * Features:
 * - Multiple choice and true/false questions
 * - Progress tracking with localStorage
 * - Score calculation and review
 * - Upgradeable to database backend
 */

(function() {
    'use strict';

    // ==========================================
    // CONFIGURATION
    // ==========================================

    const STORAGE_KEY = 'debateGuideQuizProgress';

    // ==========================================
    // STATE
    // ==========================================

    let quizData = null;
    let currentQuestion = 0;
    let userAnswers = [];
    let quizStarted = false;

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

    function saveProgress(chapterId, score, total) {
        try {
            const progress = getProgress();
            const existing = progress[chapterId];

            // Keep best score
            if (!existing || score > existing.bestScore) {
                progress[chapterId] = {
                    bestScore: score,
                    total: total,
                    percentage: Math.round((score / total) * 100),
                    completedAt: new Date().toISOString(),
                    attempts: (existing?.attempts || 0) + 1
                };
            } else {
                progress[chapterId].attempts = (existing?.attempts || 0) + 1;
            }

            localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));

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
    // QUIZ DATA LOADING
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
        const question = quizData.questions[currentQuestion];
        const total = quizData.questions.length;
        const userAnswer = userAnswers[currentQuestion];

        // Update progress
        const progressPercent = ((currentQuestion + 1) / total) * 100;
        elements.progressFill.style.width = progressPercent + '%';
        elements.progressText.textContent = `Question ${currentQuestion + 1} of ${total}`;

        // Build question HTML
        let optionsHtml = '';

        if (question.type === 'true-false') {
            optionsHtml = `
                <div class="quiz-options">
                    <label class="quiz-option ${userAnswer === 0 ? 'selected' : ''}">
                        <input type="radio" name="q${currentQuestion}" value="0" ${userAnswer === 0 ? 'checked' : ''}>
                        <span class="quiz-option-marker"></span>
                        <span class="quiz-option-text">True</span>
                    </label>
                    <label class="quiz-option ${userAnswer === 1 ? 'selected' : ''}">
                        <input type="radio" name="q${currentQuestion}" value="1" ${userAnswer === 1 ? 'checked' : ''}>
                        <span class="quiz-option-marker"></span>
                        <span class="quiz-option-text">False</span>
                    </label>
                </div>
            `;
        } else {
            optionsHtml = '<div class="quiz-options">';
            question.options.forEach((option, index) => {
                optionsHtml += `
                    <label class="quiz-option ${userAnswer === index ? 'selected' : ''}">
                        <input type="radio" name="q${currentQuestion}" value="${index}" ${userAnswer === index ? 'checked' : ''}>
                        <span class="quiz-option-marker"></span>
                        <span class="quiz-option-text">${option}</span>
                    </label>
                `;
            });
            optionsHtml += '</div>';
        }

        elements.questionContainer.innerHTML = `
            <div class="quiz-question" data-question="${currentQuestion}">
                <p class="quiz-question-text">${question.question}</p>
                ${optionsHtml}
            </div>
        `;

        // Update button states
        elements.prevBtn.disabled = currentQuestion === 0;

        const isLastQuestion = currentQuestion === total - 1;
        elements.nextBtn.hidden = isLastQuestion;
        elements.submitBtn.hidden = !isLastQuestion;

        // Enable next/submit only if answered
        const hasAnswer = userAnswers[currentQuestion] !== undefined;
        elements.nextBtn.disabled = !hasAnswer;
        elements.submitBtn.disabled = !hasAnswer;

        // Add option click handlers
        elements.questionContainer.querySelectorAll('.quiz-option input').forEach(input => {
            input.addEventListener('change', handleOptionSelect);
        });
    }

    function renderResults() {
        const total = quizData.questions.length;
        let correct = 0;

        quizData.questions.forEach((question, index) => {
            const userAnswer = userAnswers[index];
            let correctAnswer = question.correct;

            // For true-false, convert boolean to index (true=0, false=1)
            if (question.type === 'true-false') {
                correctAnswer = question.correct ? 0 : 1;
            }

            if (userAnswer === correctAnswer) {
                correct++;
            }
        });

        const percentage = Math.round((correct / total) * 100);
        const passed = percentage >= quizData.passingScore;

        // Save progress
        const chapterId = elements.section.dataset.chapter;
        saveProgress(chapterId, correct, total);

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

        // Render review (hidden by default)
        renderReview();
        elements.reviewContainer.hidden = true;

        showState('complete');
    }

    function renderReview() {
        let reviewHtml = '<div class="quiz-review-list">';

        quizData.questions.forEach((question, index) => {
            const userAnswer = userAnswers[index];
            let correctAnswer = question.correct;
            let correctText = '';

            if (question.type === 'true-false') {
                correctAnswer = question.correct ? 0 : 1;
                correctText = question.correct ? 'True' : 'False';
            } else {
                correctText = question.options[question.correct];
            }

            const isCorrect = userAnswer === correctAnswer;
            const userText = question.type === 'true-false'
                ? (userAnswer === 0 ? 'True' : 'False')
                : question.options[userAnswer];

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
        const value = parseInt(e.target.value, 10);
        userAnswers[currentQuestion] = value;

        // Update selected state visually
        elements.questionContainer.querySelectorAll('.quiz-option').forEach(opt => {
            opt.classList.remove('selected');
        });
        e.target.closest('.quiz-option').classList.add('selected');

        // Enable next/submit button
        elements.nextBtn.disabled = false;
        elements.submitBtn.disabled = false;
    }

    function handleStart() {
        currentQuestion = 0;
        userAnswers = [];
        quizStarted = true;

        showState('active');
        renderQuestion();
    }

    function handlePrev() {
        if (currentQuestion > 0) {
            currentQuestion--;
            renderQuestion();
        }
    }

    function handleNext() {
        if (currentQuestion < quizData.questions.length - 1) {
            currentQuestion++;
            renderQuestion();
        }
    }

    function handleSubmit() {
        renderResults();
    }

    function handleRetry() {
        currentQuestion = 0;
        userAnswers = [];
        elements.section.classList.remove('quiz-passed');
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
    // GLOBAL EXPORTS (for TOC progress badges)
    // ==========================================

    window.DebateGuideQuiz = {
        getProgress: getProgress,
        getChapterProgress: getChapterProgress
    };

})();

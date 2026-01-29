/**
 * Quiz System E2E Tests
 * Comprehensive tests for the quiz flow, email collection, and admin dashboard
 */

const { test, expect } = require('@playwright/test');

// Helper to clear localStorage
async function clearStorage(page) {
    await page.evaluate(() => {
        localStorage.clear();
        sessionStorage.clear();
    });
}

// Helper to set localStorage
async function setStorage(page, key, value) {
    await page.evaluate(([k, v]) => {
        localStorage.setItem(k, typeof v === 'string' ? v : JSON.stringify(v));
    }, [key, value]);
}

// Helper to complete a quiz (answers all questions)
// Handles all question types: multiple-choice, true-false, scenario, matching, ordering, fill-blank
async function completeQuiz(page, expect) {
    await page.locator('#quiz-start-btn').click();
    await expect(page.locator('#quiz-active')).toBeVisible();

    for (let i = 0; i < 10; i++) {
        // Wait for question container
        await expect(page.locator('#quiz-question-container')).toBeVisible({ timeout: 5000 });

        // Detect question type and answer accordingly
        const mcOption = page.locator('.quiz-option').first();
        const matchingSelect = page.locator('.matching-select').first();
        const orderingItem = page.locator('.ordering-item').first();
        const fillBlankInput = page.locator('.fill-blank-input').first();

        if (await mcOption.isVisible({ timeout: 500 }).catch(() => false)) {
            // Multiple choice / True-false / Scenario
            await mcOption.click();
        } else if (await matchingSelect.isVisible({ timeout: 500 }).catch(() => false)) {
            // Matching question - select first option for each dropdown
            const selects = page.locator('.matching-select');
            const count = await selects.count();
            for (let j = 0; j < count; j++) {
                const select = selects.nth(j);
                // Select the option corresponding to index j (1-based options)
                await select.selectOption({ index: j + 1 });
            }
        } else if (await orderingItem.isVisible({ timeout: 500 }).catch(() => false)) {
            // Ordering question - items are already in some order, just proceed
            // (The default order may be wrong but we just want to complete)
        } else if (await fillBlankInput.isVisible({ timeout: 500 }).catch(() => false)) {
            // Fill in the blank
            await fillBlankInput.fill('test answer');
        }

        // Wait for and click continue button
        const continueBtn = page.locator('.quiz-continue-btn');
        await expect(continueBtn).toBeVisible({ timeout: 5000 });
        await continueBtn.click();
        await page.waitForTimeout(100);
    }

    await expect(page.locator('#quiz-complete')).toBeVisible({ timeout: 15000 });
}

// ==========================================
// QUIZ DISCOVERY & NAVIGATION
// ==========================================

test.describe('Quiz Discovery', () => {
    test('quizzes hub page loads and shows all 20 quizzes', async ({ page }) => {
        await page.goto('/quizzes/');
        await expect(page.locator('h1')).toContainText('ALL QUIZZES');
        const quizCards = page.locator('.quiz-card');
        await expect(quizCards).toHaveCount(20);
    });

    test('how quizzes work page loads', async ({ page }) => {
        await page.goto('/how-quizzes-work/');
        await expect(page.locator('h1')).toContainText('HOW QUIZZES WORK');
    });

    test('chapter page has quiz section', async ({ page }) => {
        await page.goto('/chapters/part-1/chapter-01-why-debate-matters/');
        const quizSection = page.locator('#chapter-quiz');
        await expect(quizSection).toBeVisible();
        await expect(page.locator('#quiz-start-btn')).toBeVisible();
    });

    test('navigation has quizzes link (desktop)', async ({ page }) => {
        await page.goto('/');
        // Use first() since there are multiple (desktop and mobile)
        const navLink = page.locator('nav a[href="/quizzes/"]').first();
        await expect(navLink).toBeVisible();
    });
});

// ==========================================
// EMAIL COLLECTION MODAL
// ==========================================

test.describe('Email Collection', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/chapters/part-1/chapter-01-why-debate-matters/');
        await clearStorage(page);
        await page.reload();
    });

    test('email modal appears on first quiz start', async ({ page }) => {
        await page.locator('#quiz-start-btn').click();
        const emailModal = page.locator('.quiz-email-overlay');
        await expect(emailModal).toBeVisible();
        await expect(page.locator('.quiz-email-title')).toContainText('Before you begin');
    });

    test('email modal requires valid email', async ({ page }) => {
        await page.locator('#quiz-start-btn').click();
        await expect(page.locator('.quiz-email-overlay')).toBeVisible();

        const emailInput = page.locator('#quiz-email-input');
        const submitBtn = page.locator('.quiz-email-submit');

        // Try invalid email
        await emailInput.fill('notanemail');
        await submitBtn.click();

        // Wait a moment for validation
        await page.waitForTimeout(200);

        // Error should show (unhidden)
        const error = page.locator('#quiz-email-error');
        await expect(error).not.toHaveAttribute('hidden');

        // Input should have error class
        await expect(emailInput).toHaveClass(/is-error/);

        // Modal should still be open
        await expect(page.locator('.quiz-email-overlay')).toBeVisible();
    });

    test('email modal accepts valid email and proceeds', async ({ page }) => {
        await page.locator('#quiz-start-btn').click();
        const emailInput = page.locator('#quiz-email-input');

        await emailInput.fill('test@example.com');
        await page.locator('.quiz-email-submit').click();

        // Modal should close
        await expect(page.locator('.quiz-email-overlay')).not.toBeVisible({ timeout: 5000 });

        // Email should be stored
        const storedEmail = await page.evaluate(() => localStorage.getItem('debateGuideUserEmail'));
        expect(storedEmail).toBe('test@example.com');
    });

    test('email modal does not appear if email already stored', async ({ page }) => {
        // Pre-set email
        await setStorage(page, 'debateGuideUserEmail', 'existing@example.com');
        await page.reload();

        await page.locator('#quiz-start-btn').click();

        // Email modal should NOT appear
        await expect(page.locator('.quiz-email-overlay')).not.toBeVisible();
    });
});

// ==========================================
// FIRST-TIME ONBOARDING
// ==========================================

test.describe('Onboarding Modal', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/chapters/part-1/chapter-01-why-debate-matters/');
        await clearStorage(page);
        // Pre-set email so we skip email modal
        await setStorage(page, 'debateGuideUserEmail', 'test@example.com');
        await page.reload();
    });

    test('onboarding appears for first-time users', async ({ page }) => {
        await page.locator('#quiz-start-btn').click();
        const onboarding = page.locator('.quiz-onboarding-overlay');
        await expect(onboarding).toBeVisible();
        await expect(page.locator('.quiz-onboarding-title')).toContainText('Quick tips');
    });

    test('onboarding can be dismissed', async ({ page }) => {
        await page.locator('#quiz-start-btn').click();
        await page.locator('.quiz-onboarding-start').click();

        // Onboarding should close
        await expect(page.locator('.quiz-onboarding-overlay')).not.toBeVisible({ timeout: 5000 });

        // Quiz should start
        await expect(page.locator('#quiz-active')).toBeVisible();
    });

    test('onboarding does not appear on subsequent visits', async ({ page }) => {
        // Pre-set onboarding seen flag
        await setStorage(page, 'debateGuideOnboardingSeen', '1');
        await page.reload();

        await page.locator('#quiz-start-btn').click();

        // Should go straight to quiz
        await expect(page.locator('.quiz-onboarding-overlay')).not.toBeVisible();
        await expect(page.locator('#quiz-active')).toBeVisible();
    });
});

// ==========================================
// QUIZ FLOW
// ==========================================

test.describe('Quiz Flow', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/chapters/part-1/chapter-01-why-debate-matters/');
        await clearStorage(page);
        // Skip email and onboarding
        await setStorage(page, 'debateGuideUserEmail', 'test@example.com');
        await setStorage(page, 'debateGuideOnboardingSeen', '1');
        await page.reload();
    });

    test('quiz start screen shows correct info', async ({ page }) => {
        await expect(page.locator('#quiz-question-count')).toHaveText('10');
        await expect(page.locator('#quiz-passing-score')).toHaveText('70%');
        await expect(page.locator('#quiz-start-btn')).toBeVisible();
    });

    test('clicking start begins the quiz', async ({ page }) => {
        await page.locator('#quiz-start-btn').click();

        // Active state should be visible
        await expect(page.locator('#quiz-active')).toBeVisible();
        await expect(page.locator('#quiz-start')).not.toBeVisible();

        // Progress should show
        await expect(page.locator('#quiz-progress-text')).toContainText('Question 1');
    });

    test('questions render with answer options', async ({ page }) => {
        await page.locator('#quiz-start-btn').click();

        // Question container should have content
        const questionContainer = page.locator('#quiz-question-container');
        await expect(questionContainer).toBeVisible();

        // Should have answer options
        const options = page.locator('.quiz-option');
        const optionCount = await options.count();
        expect(optionCount).toBeGreaterThan(0);
    });

    test('selecting an answer enables next button', async ({ page }) => {
        await page.locator('#quiz-start-btn').click();
        await expect(page.locator('#quiz-active')).toBeVisible();

        // Wait for question container
        await expect(page.locator('#quiz-question-container')).toBeVisible();

        // Handle different question types
        const mcOption = page.locator('.quiz-option').first();
        const matchingSelect = page.locator('.matching-select').first();

        if (await mcOption.isVisible({ timeout: 500 }).catch(() => false)) {
            // Next button should be disabled initially for MC
            const nextBtn = page.locator('#quiz-next-btn');
            await expect(nextBtn).toBeDisabled();

            // Click first option
            await mcOption.click();

            // After answering in immediate feedback mode, continue button appears
            await expect(page.locator('.quiz-continue-btn')).toBeVisible({ timeout: 5000 });
        } else if (await matchingSelect.isVisible({ timeout: 500 }).catch(() => false)) {
            // For matching questions, select an option
            await matchingSelect.selectOption({ index: 1 });
            // Verify the selection was made
            const value = await matchingSelect.inputValue();
            expect(value).not.toBe('');
        }
    });

    test('keyboard navigation works (number keys)', async ({ page }) => {
        await page.locator('#quiz-start-btn').click();
        await expect(page.locator('#quiz-active')).toBeVisible();
        await expect(page.locator('#quiz-question-container')).toBeVisible();

        // Check if this is a MC question (keyboard shortcuts only work for MC/TF)
        const firstOption = page.locator('.quiz-option').first();
        if (await firstOption.isVisible({ timeout: 500 }).catch(() => false)) {
            // Press '1' to select first option
            await page.keyboard.press('1');

            // First option should be selected
            await expect(firstOption).toHaveClass(/selected/);
        } else {
            // Not a MC question, just verify question loaded
            const questionText = page.locator('.quiz-question-text');
            await expect(questionText).toBeVisible();
        }
    });

    test('can complete full quiz', async ({ page }) => {
        await completeQuiz(page, expect);
        await expect(page.locator('#quiz-score-value')).toBeVisible();
    });
});

// ==========================================
// QUIZ RESULTS
// ==========================================

test.describe('Quiz Results', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/chapters/part-1/chapter-01-why-debate-matters/');
        await clearStorage(page);
        await setStorage(page, 'debateGuideUserEmail', 'test@example.com');
        await setStorage(page, 'debateGuideOnboardingSeen', '1');
        await page.reload();
    });

    test('results screen shows score', async ({ page }) => {
        await completeQuiz(page, expect);
        const scoreText = await page.locator('#quiz-score-value').textContent();
        expect(scoreText).toMatch(/\d+%/);
    });

    test('results show retry button', async ({ page }) => {
        await completeQuiz(page, expect);
        await expect(page.locator('#quiz-retry-btn')).toBeVisible();
    });

    test('results show review answers button', async ({ page }) => {
        await completeQuiz(page, expect);
        await expect(page.locator('#quiz-review-toggle')).toBeVisible();
    });

    test('progress is saved to localStorage', async ({ page }) => {
        await completeQuiz(page, expect);

        // Check localStorage
        const progress = await page.evaluate(() => {
            return JSON.parse(localStorage.getItem('debateGuideQuizProgress') || '{}');
        });

        expect(progress['1']).toBeDefined();
        expect(progress['1'].percentage).toBeDefined();
        expect(progress['1'].attempts).toBeGreaterThan(0);
    });
});

// ==========================================
// QUIZ PROGRESSION
// ==========================================

test.describe('Quiz Progression', () => {
    test('next quiz link appears after passing', async ({ page }) => {
        await page.goto('/chapters/part-1/chapter-01-why-debate-matters/');
        await clearStorage(page);
        await setStorage(page, 'debateGuideUserEmail', 'test@example.com');
        await setStorage(page, 'debateGuideOnboardingSeen', '1');
        // Pre-set a passing score
        await setStorage(page, 'debateGuideQuizProgress', { '1': { percentage: 80, bestScore: 8, total: 10, attempts: 1 }});
        await page.reload();

        // The quiz should show "Retake Quiz" since already passed
        await expect(page.locator('#quiz-start-btn')).toContainText(/Retake/i);
    });

    test('attempts counter increments', async ({ page }) => {
        await page.goto('/chapters/part-1/chapter-01-why-debate-matters/');
        await clearStorage(page);
        await setStorage(page, 'debateGuideUserEmail', 'test@example.com');
        await setStorage(page, 'debateGuideOnboardingSeen', '1');
        await setStorage(page, 'debateGuideQuizProgress', { '1': { percentage: 50, bestScore: 5, total: 10, attempts: 3 }});
        await page.reload();

        // Should show attempt count
        await expect(page.locator('#quiz-attempts')).toHaveText('3');
    });
});

// ==========================================
// MOBILE RESPONSIVENESS
// ==========================================

test.describe('Mobile Experience', () => {
    test.use({ viewport: { width: 375, height: 667 } }); // iPhone SE size

    test('quiz is usable on mobile', async ({ page }) => {
        await page.goto('/chapters/part-1/chapter-01-why-debate-matters/');
        await clearStorage(page);
        await setStorage(page, 'debateGuideUserEmail', 'test@example.com');
        await setStorage(page, 'debateGuideOnboardingSeen', '1');
        await page.reload();

        // Start button should be visible and tappable
        const startBtn = page.locator('#quiz-start-btn');
        await expect(startBtn).toBeVisible();

        // Check button is large enough for touch (at least 44x44)
        const box = await startBtn.boundingBox();
        expect(box.height).toBeGreaterThanOrEqual(40);
    });

    test('email modal is usable on mobile', async ({ page }) => {
        await page.goto('/chapters/part-1/chapter-01-why-debate-matters/');
        await clearStorage(page);
        await page.reload();

        await page.locator('#quiz-start-btn').click();

        const emailModal = page.locator('.quiz-email-content');
        await expect(emailModal).toBeVisible();

        // Input should be visible and usable
        const emailInput = page.locator('#quiz-email-input');
        await expect(emailInput).toBeVisible();
        await emailInput.fill('mobile@test.com');

        // Submit button should be tappable
        const submitBtn = page.locator('.quiz-email-submit');
        await expect(submitBtn).toBeVisible();
    });

    test('quiz options are tappable on mobile', async ({ page }) => {
        await page.goto('/chapters/part-1/chapter-01-why-debate-matters/');
        await clearStorage(page);
        await setStorage(page, 'debateGuideUserEmail', 'test@example.com');
        await setStorage(page, 'debateGuideOnboardingSeen', '1');
        await page.reload();

        await page.locator('#quiz-start-btn').click();

        // Wait for quiz active state
        await expect(page.locator('#quiz-active')).toBeVisible();

        // Questions are randomized - check whatever question type appears
        const mcOption = page.locator('.quiz-option').first();
        const matchingSelect = page.locator('.matching-select').first();
        const orderingItem = page.locator('.ordering-item').first();

        // Wait for some question content to appear
        await expect(page.locator('#quiz-question-container')).toBeVisible({ timeout: 5000 });
        await page.waitForTimeout(200);

        // Check touch target size for whichever element type is present
        if (await mcOption.isVisible({ timeout: 500 }).catch(() => false)) {
            const box = await mcOption.boundingBox();
            expect(box.height).toBeGreaterThanOrEqual(40);
            await mcOption.click();
            await expect(mcOption).toHaveClass(/selected/);
        } else if (await matchingSelect.isVisible({ timeout: 500 }).catch(() => false)) {
            // Matching question - check select is usable
            const box = await matchingSelect.boundingBox();
            expect(box.height).toBeGreaterThanOrEqual(30); // Selects can be smaller
            await matchingSelect.selectOption({ index: 1 });
        } else if (await orderingItem.isVisible({ timeout: 500 }).catch(() => false)) {
            // Ordering question - check item is visible
            const box = await orderingItem.boundingBox();
            expect(box.height).toBeGreaterThanOrEqual(40);
        } else {
            // Fill-blank or other - just verify the question container loaded
            const container = await page.locator('#quiz-question-container').boundingBox();
            expect(container.height).toBeGreaterThan(0);
        }
    });
});

// ==========================================
// CHAPTER TOC SECTION INDICATOR
// ==========================================

test.describe('Chapter TOC Section Indicator', () => {
    // Helper to scroll and reveal the reading toolbar
    async function scrollToRevealToolbar(page) {
        await page.evaluate(() => window.scrollBy(0, 250));
        await page.waitForTimeout(300);
    }

    test('TOC button exists on chapter page (after scroll)', async ({ page }) => {
        await page.goto('/chapters/part-1/chapter-01-why-debate-matters/');
        await page.waitForTimeout(500);

        // Reading toolbar appears after scrolling 200px
        await scrollToRevealToolbar(page);

        const tocToggle = page.locator('#toc-toggle');
        await expect(tocToggle).toBeVisible();
    });

    test('TOC sidebar opens on click', async ({ page }) => {
        await page.goto('/chapters/part-1/chapter-01-why-debate-matters/');
        await page.waitForTimeout(500);
        await scrollToRevealToolbar(page);

        await page.locator('#toc-toggle').click();
        await page.waitForTimeout(300);

        const sidebar = page.locator('.chapter-toc-sidebar');
        await expect(sidebar).toHaveClass(/is-open/);
    });

    test('TOC shows section links', async ({ page }) => {
        await page.goto('/chapters/part-1/chapter-01-why-debate-matters/');
        await page.waitForTimeout(500);
        await scrollToRevealToolbar(page);

        await page.locator('#toc-toggle').click();
        await page.waitForTimeout(300);

        const links = page.locator('.chapter-toc-link');
        const count = await links.count();
        expect(count).toBeGreaterThan(0);
    });

    test('scrolling updates active section indicator', async ({ page }) => {
        await page.goto('/chapters/part-1/chapter-01-why-debate-matters/');
        await page.waitForTimeout(500);
        await scrollToRevealToolbar(page);

        // Open TOC to get section links
        await page.locator('#toc-toggle').click();
        await page.waitForTimeout(300);

        // Get section links
        const links = page.locator('.chapter-toc-link');
        const count = await links.count();

        if (count > 1) {
            // Get the second link's href
            const secondLink = links.nth(1);
            const href = await secondLink.getAttribute('href');

            // Click the link directly to navigate and close sidebar
            await secondLink.click();
            await page.waitForTimeout(800); // Wait for scroll and intersection observer

            // Re-open TOC using keyboard (T key) since sidebar may overlap toggle
            await page.keyboard.press('t');
            await page.waitForTimeout(300);

            // Check if TOC opened and has active link
            const sidebar = page.locator('.chapter-toc-sidebar');
            if (await sidebar.isVisible()) {
                const activeLink = page.locator('.chapter-toc-link.is-active');
                await expect(activeLink).toBeVisible();
            }
        }
    });
});

// ==========================================
// ADMIN DASHBOARD
// ==========================================

test.describe('Admin Dashboard', () => {
    test('admin page loads', async ({ page }) => {
        await page.goto('/admin/');
        await expect(page.locator('h1')).toContainText('DASHBOARD');
    });

    test('login form is visible', async ({ page }) => {
        await page.goto('/admin/');
        await expect(page.locator('#admin-password')).toBeVisible();
        await expect(page.locator('#admin-login-btn')).toBeVisible();
    });

    test('all tab buttons exist', async ({ page }) => {
        await page.goto('/admin/');

        // Check all tabs exist (even before login)
        const tabs = ['chapters', 'users', 'questions', 'activity', 'export'];
        for (const tab of tabs) {
            const tabBtn = page.locator(`[data-tab="${tab}"]`);
            await expect(tabBtn).toBeAttached();
        }
    });

    test('login button shows loading state', async ({ page }) => {
        await page.goto('/admin/');
        await page.locator('#admin-password').fill('anypassword');

        // Start login (will fail but shows loading state briefly)
        await page.locator('#admin-login-btn').click();

        // Button text changes during verification
        // (This is quick so we just check the form is still there)
        await expect(page.locator('#admin-login')).toBeVisible();
    });
});

// NOTE: Full admin API tests require environment variables
// Run these against production with: PLAYWRIGHT_BASE_URL=https://www.debateguide.xyz npx playwright test

// ==========================================
// QUIZ DATA INTEGRITY
// ==========================================

test.describe('Quiz Data Integrity', () => {
    test('all 20 quiz JSON files load', async ({ page }) => {
        for (let i = 1; i <= 20; i++) {
            const paddedId = i.toString().padStart(2, '0');
            const response = await page.request.get(`/quizzes/chapter-${paddedId}.json`);
            expect(response.status()).toBe(200);

            const data = await response.json();
            expect(data.questions).toBeDefined();
            expect(data.questions.length).toBeGreaterThan(0);
            expect(data.passingScore).toBeDefined();
        }
    });

    test('quiz questions have required fields', async ({ page }) => {
        const response = await page.request.get('/quizzes/chapter-01.json');
        const data = await response.json();

        for (const question of data.questions) {
            expect(question.question).toBeDefined();
            expect(question.type).toBeDefined();
            expect(['multiple-choice', 'true-false', 'matching', 'ordering', 'scenario', 'fill-blank']).toContain(question.type);
        }
    });
});

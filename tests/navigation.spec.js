const { test, expect } = require('@playwright/test');

test.describe('Navigation and Animations', () => {

  test('back button should not show black screen', async ({ page }) => {
    // Go directly to chapter page
    await page.goto('http://localhost:8080/chapters/part-1/chapter-01-why-debate-matters/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);

    // Click on chapter 2 link in nav
    await page.click('.chapter-nav-next');
    await page.waitForLoadState('networkidle');

    // Verify we're on chapter 2
    await expect(page).toHaveURL(/chapter-02/);
    await page.waitForTimeout(300);

    // Go back
    await page.goBack();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(100);

    // Check body opacity is 1 (not hidden)
    const bodyOpacity = await page.evaluate(() => {
      return window.getComputedStyle(document.body).opacity;
    });
    expect(bodyOpacity).toBe('1');

    // Check body doesn't have page-transition-exit class
    const hasExitClass = await page.evaluate(() => {
      return document.body.classList.contains('page-transition-exit');
    });
    expect(hasExitClass).toBe(false);

    // Verify hero content is visible
    const heroVisible = await page.locator('.chapter-hero').isVisible();
    expect(heroVisible).toBe(true);
  });

  test('hero elements should animate sequentially on fresh load', async ({ page }) => {
    // Track when each element becomes visible
    await page.goto('http://localhost:8080/chapters/part-1/chapter-01-why-debate-matters/');

    // Wait and capture all timings
    const timings = await page.evaluate(() => {
      return new Promise((resolve) => {
        const start = performance.now();
        const results = [];
        const heroElements = document.querySelectorAll('.chapter-hero [data-animate]');

        // Create mutation observer to track when is-visible is added
        const observer = new MutationObserver((mutations) => {
          mutations.forEach(mutation => {
            if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
              const el = mutation.target;
              if (el.classList.contains('is-visible')) {
                const index = Array.from(heroElements).indexOf(el);
                if (index >= 0 && !results.find(r => r.index === index)) {
                  results.push({ index, time: Math.round(performance.now() - start) });
                }
              }
            }
          });
        });

        heroElements.forEach(el => {
          observer.observe(el, { attributes: true, attributeFilter: ['class'] });
        });

        // Wait up to 1 second for all animations
        setTimeout(() => {
          observer.disconnect();
          resolve(results.sort((a, b) => a.index - b.index));
        }, 1000);
      });
    });

    console.log('Animation timings:', timings);

    // Should have at least 2 elements
    expect(timings.length).toBeGreaterThan(1);

    // Each element should animate after the previous (with some tolerance)
    for (let i = 1; i < timings.length; i++) {
      const gap = timings[i].time - timings[i-1].time;
      // Should be roughly 100ms apart (allow 50-150ms)
      expect(gap).toBeGreaterThanOrEqual(50);
    }
  });

  test('content elements should fade in on scroll', async ({ page }) => {
    await page.goto('http://localhost:8080/chapters/part-1/chapter-01-why-debate-matters/');
    await page.waitForLoadState('networkidle');

    // Wait for initial animations
    await page.waitForTimeout(1000);

    // Get an element that's below the fold
    const belowFoldSelector = '.chapter-content p:nth-of-type(15)';

    // Check it's not visible yet (no is-visible class)
    const initiallyVisible = await page.evaluate((sel) => {
      const el = document.querySelector(sel);
      return el ? el.classList.contains('is-visible') : null;
    }, belowFoldSelector);

    // If element exists and starts hidden
    if (initiallyVisible === false) {
      // Scroll to that element
      await page.locator(belowFoldSelector).scrollIntoViewIfNeeded();
      await page.waitForTimeout(500);

      // Now it should have is-visible
      const afterScrollVisible = await page.evaluate((sel) => {
        const el = document.querySelector(sel);
        return el ? el.classList.contains('is-visible') : null;
      }, belowFoldSelector);

      expect(afterScrollVisible).toBe(true);
    }
  });

  test('back navigation should show content immediately', async ({ page }) => {
    // First visit
    await page.goto('http://localhost:8080/chapters/part-1/chapter-01-why-debate-matters/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(800);

    // Navigate to chapter 2 via nav link
    await page.click('.chapter-nav-next');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(300);

    // Go back
    await page.goBack();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(200);

    // All hero elements should be visible
    const heroElementsVisible = await page.evaluate(() => {
      const elements = document.querySelectorAll('.chapter-hero [data-animate]');
      return Array.from(elements).every(el => el.classList.contains('is-visible'));
    });

    expect(heroElementsVisible).toBe(true);
  });

});

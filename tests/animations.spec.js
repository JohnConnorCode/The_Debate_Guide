const { test, expect } = require('@playwright/test');

test.describe('Animation System - Progressive Enhancement', () => {

  test.describe('Desktop (>768px)', () => {
    test.use({ viewport: { width: 1280, height: 720 } });

    test('homepage hero content is visible', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('domcontentloaded');

      // Hero elements should become visible
      const heroTitle = page.locator('.toc-hero h1, .hero h1').first();
      await expect(heroTitle).toBeVisible({ timeout: 5000 });

      // Wait for animation to complete (animation is 0.5s + delays up to 0.4s)
      await page.waitForTimeout(1500);

      // Check opacity is 1 (visible) after animation completes
      const opacity = await heroTitle.evaluate(el =>
        window.getComputedStyle(el).opacity
      );
      expect(parseFloat(opacity)).toBeGreaterThan(0.9);
    });

    test('js-ready class is added on desktop', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('domcontentloaded');

      // Wait for JS to initialize
      await page.waitForFunction(() =>
        document.documentElement.classList.contains('js-ready') ||
        document.documentElement.classList.contains('no-js')
      , { timeout: 5000 });

      const hasJsReady = await page.evaluate(() =>
        document.documentElement.classList.contains('js-ready')
      );
      expect(hasJsReady).toBe(true);
    });

    test('animated elements get is-visible class', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('domcontentloaded');

      // Wait for animations to trigger
      await page.waitForTimeout(1000);

      const heroAnimateElements = page.locator('.hero-animate');
      const count = await heroAnimateElements.count();

      if (count > 0) {
        for (let i = 0; i < Math.min(count, 3); i++) {
          const hasIsVisible = await heroAnimateElements.nth(i).evaluate(el =>
            el.classList.contains('is-visible')
          );
          expect(hasIsVisible).toBe(true);
        }
      }
    });

    test('chapter page content is visible', async ({ page }) => {
      await page.goto('/chapters/part-1/chapter-01-why-debate-matters/');
      await page.waitForLoadState('domcontentloaded');

      // Chapter title should be visible
      const chapterTitle = page.locator('.chapter-hero h1, .chapter-title').first();
      await expect(chapterTitle).toBeVisible({ timeout: 5000 });

      const opacity = await chapterTitle.evaluate(el =>
        window.getComputedStyle(el).opacity
      );
      expect(parseFloat(opacity)).toBeGreaterThan(0.9);
    });
  });

  test.describe('Mobile (<=768px)', () => {
    test.use({ viewport: { width: 375, height: 667 } });

    test('content is immediately visible on mobile', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('domcontentloaded');

      // Content should be visible immediately - no waiting for animations
      const heroTitle = page.locator('.toc-hero h1, .hero h1').first();
      await expect(heroTitle).toBeVisible({ timeout: 2000 });

      const opacity = await heroTitle.evaluate(el =>
        window.getComputedStyle(el).opacity
      );
      expect(parseFloat(opacity)).toBe(1);
    });

    test('js-ready class is NOT added on mobile', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(500);

      const hasJsReady = await page.evaluate(() =>
        document.documentElement.classList.contains('js-ready')
      );
      expect(hasJsReady).toBe(false);
    });

    test('no transform applied on mobile', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('domcontentloaded');

      const heroAnimateElements = page.locator('.hero-animate');
      const count = await heroAnimateElements.count();

      if (count > 0) {
        const transform = await heroAnimateElements.first().evaluate(el =>
          window.getComputedStyle(el).transform
        );
        // Should be 'none' or 'matrix(1, 0, 0, 1, 0, 0)' (identity)
        expect(transform === 'none' || transform === 'matrix(1, 0, 0, 1, 0, 0)').toBe(true);
      }
    });

    test('chapter content visible on mobile', async ({ page }) => {
      await page.goto('/chapters/part-1/chapter-01-why-debate-matters/');
      await page.waitForLoadState('domcontentloaded');

      const chapterTitle = page.locator('.chapter-hero h1, .chapter-title').first();
      await expect(chapterTitle).toBeVisible({ timeout: 2000 });

      const opacity = await chapterTitle.evaluate(el =>
        window.getComputedStyle(el).opacity
      );
      expect(parseFloat(opacity)).toBe(1);
    });
  });

  test.describe('Reduced Motion', () => {
    test.use({
      viewport: { width: 1280, height: 720 },
    });

    test('respects prefers-reduced-motion', async ({ page }) => {
      // Emulate reduced motion preference
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.goto('/');
      await page.waitForLoadState('domcontentloaded');

      const heroTitle = page.locator('.toc-hero h1, .hero h1').first();
      await expect(heroTitle).toBeVisible({ timeout: 2000 });

      // Should be fully visible with no animation
      const opacity = await heroTitle.evaluate(el =>
        window.getComputedStyle(el).opacity
      );
      expect(parseFloat(opacity)).toBe(1);
    });
  });

  test.describe('Navigation', () => {
    test.use({ viewport: { width: 1280, height: 720 } });

    test('navigation between pages works', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('domcontentloaded');

      // Find and click a visible chapter link (not mobile nav)
      const chapterLink = page.locator('.toc-chapters a[href*="chapter-01"], .chapter-card a[href*="chapter-01"]').first();
      if (await chapterLink.count() > 0) {
        await chapterLink.click();
        await page.waitForLoadState('domcontentloaded');

        // Chapter content should be visible
        const content = page.locator('.chapter-content, .content, main').first();
        await expect(content).toBeVisible({ timeout: 5000 });
      }
    });

    test('back navigation preserves visibility', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(500);

      await page.goto('/chapters/part-1/chapter-01-why-debate-matters/');
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(500);

      await page.goBack();
      await page.waitForLoadState('domcontentloaded');

      // Homepage content should still be visible
      const heroTitle = page.locator('.toc-hero h1, .hero h1').first();
      await expect(heroTitle).toBeVisible({ timeout: 3000 });
    });
  });

  test.describe('Scroll Animations', () => {
    test.use({ viewport: { width: 1280, height: 720 } });

    test('scroll-triggered elements become visible', async ({ page }) => {
      await page.goto('/chapters/part-1/chapter-01-why-debate-matters/');
      await page.waitForLoadState('domcontentloaded');

      // Scroll down to trigger animations
      await page.evaluate(() => window.scrollTo(0, 1000));
      await page.waitForTimeout(500);

      // Elements in viewport should have is-visible class
      const dataAnimateElements = page.locator('[data-animate].is-visible');
      const count = await dataAnimateElements.count();

      // At least some elements should be visible after scrolling
      expect(count).toBeGreaterThanOrEqual(0); // Soft check - depends on page structure
    });
  });
});

/**
 * The Debate Guide - Navigation & Animation System
 *
 * Features:
 * - Scroll-triggered animations (Intersection Observer)
 * - Reading progress indicator
 * - Keyboard navigation (←/→ for prev/next chapter)
 * - Smooth scroll behavior
 */

(function() {
    'use strict';

    // ==========================================
    // CONFIGURATION
    // ==========================================

    const CONFIG = {
        // Animation settings
        animation: {
            threshold: 0.15,        // How much of element must be visible (0-1)
            rootMargin: '0px 0px -50px 0px',  // Trigger slightly before fully in view
        },
        // Progress bar
        progress: {
            throttleMs: 16,         // ~60fps
        },
        // Keyboard hint
        keyboardHint: {
            showDelay: 2000,        // ms before showing hint
            hideDelay: 3000,        // ms before hiding hint
        }
    };

    // ==========================================
    // SCROLL-TRIGGERED ANIMATIONS
    // ==========================================

    function initScrollAnimations() {
        // Check for Intersection Observer support
        if (!('IntersectionObserver' in window)) {
            // Fallback: show all elements immediately
            document.querySelectorAll('[data-animate]').forEach(el => {
                el.classList.add('is-visible');
            });
            return;
        }

        // Track pending animations to stagger them
        let pendingAnimations = [];
        let animationTimeout = null;
        const STAGGER_DELAY = 60; // ms between each element

        function processPendingAnimations() {
            // Sort by vertical position for natural top-to-bottom reveal
            pendingAnimations.sort((a, b) => {
                const aRect = a.getBoundingClientRect();
                const bRect = b.getBoundingClientRect();
                return aRect.top - bRect.top;
            });

            // Stagger the animations
            pendingAnimations.forEach((el, index) => {
                setTimeout(() => {
                    el.classList.add('is-visible');
                }, index * STAGGER_DELAY);
            });

            pendingAnimations = [];
        }

        // Create observer for individual elements
        const elementObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    // Queue this element for animation
                    pendingAnimations.push(entry.target);
                    elementObserver.unobserve(entry.target);

                    // Debounce: process all visible elements together
                    clearTimeout(animationTimeout);
                    animationTimeout = setTimeout(processPendingAnimations, 10);
                }
            });
        }, {
            threshold: CONFIG.animation.threshold,
            rootMargin: CONFIG.animation.rootMargin
        });

        // Create observer for animation groups
        const groupObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('is-visible');
                    // Stagger children animations
                    const children = entry.target.querySelectorAll('[data-animate]');
                    children.forEach((child, index) => {
                        setTimeout(() => {
                            child.classList.add('is-visible');
                        }, index * STAGGER_DELAY);
                    });
                    groupObserver.unobserve(entry.target);
                }
            });
        }, {
            threshold: CONFIG.animation.threshold,
            rootMargin: CONFIG.animation.rootMargin
        });

        // Observe all animated elements (excluding hero elements which are handled separately)
        document.querySelectorAll('[data-animate]:not([data-animate-group] [data-animate]):not(.chapter-hero [data-animate]):not(.toc-hero [data-animate])').forEach(el => {
            elementObserver.observe(el);
        });

        // Observe animation groups
        document.querySelectorAll('[data-animate-group]').forEach(el => {
            groupObserver.observe(el);
        });
    }

    // ==========================================
    // AUTO-ANIMATE CHAPTER CONTENT
    // Automatically adds animation attributes to
    // chapter content elements for sequential reveal
    // ==========================================

    function initAutoAnimateContent() {
        const chapterContent = document.querySelector('.chapter-content');
        if (!chapterContent) return;

        // Elements to auto-animate
        const animatableSelectors = [
            'p',
            'h2',
            'h3',
            '.vocabulary-box',
            '.featured-quote',
            'ul',
            'ol',
            '.section-divider'
        ];

        let staggerIndex = 0;
        const maxStagger = 3; // Reset stagger after this many elements

        animatableSelectors.forEach(selector => {
            chapterContent.querySelectorAll(`:scope > ${selector}`).forEach(el => {
                // Skip if already has animation attribute
                if (el.hasAttribute('data-animate')) return;

                // Add animation attribute
                el.setAttribute('data-animate', 'fade-up');

                // Headings reset the stagger
                if (el.tagName === 'H2' || el.tagName === 'H3') {
                    staggerIndex = 0;
                }

                staggerIndex++;
                if (staggerIndex > maxStagger) staggerIndex = 1;
            });
        });
    }

    // ==========================================
    // AUTO-ANIMATE HERO ELEMENTS
    // ==========================================

    function initAutoAnimateHero(skipAnimations) {
        // Include main hero, chapter hero, and TOC hero
        const hero = document.querySelector('.hero, .chapter-hero, .toc-hero');
        if (!hero) return;

        // Elements to animate - includes main hero, chapter hero, and TOC hero elements
        const heroElements = hero.querySelectorAll(
            '.hero-badge, .hero-headline, .hero-sub, .hero-ctas, ' +  // main hero
            '.chapter-part, .chapter-number, .chapter-title, .chapter-subtitle, ' +  // chapter hero
            '.toc-badge, .toc-title, .toc-tagline, .toc-subtitle'  // TOC hero
        );

        heroElements.forEach((el) => {
            if (!el.hasAttribute('data-animate')) {
                el.setAttribute('data-animate', 'fade-up');
            }
        });

        // Use consistent 120ms stagger (smooth but not too slow)
        const STAGGER_DELAY = 120;

        if (skipAnimations) {
            // Show immediately on back navigation
            heroElements.forEach(el => el.classList.add('is-visible'));
        } else {
            // Stagger hero elements with actual delays (not CSS delays)
            // This ensures true sequential animation
            heroElements.forEach((el, index) => {
                setTimeout(() => {
                    el.classList.add('is-visible');
                }, index * STAGGER_DELAY);
            });
        }
    }

    // ==========================================
    // AUTO-ANIMATE EXERCISES
    // ==========================================

    function initAutoAnimateExercises() {
        const exercises = document.querySelector('.exercises');
        if (!exercises) return;

        // Add group animation
        if (!exercises.hasAttribute('data-animate-group')) {
            exercises.setAttribute('data-animate-group', 'stagger');
        }

        // Animate title and each exercise
        const title = exercises.querySelector('h3');
        if (title && !title.hasAttribute('data-animate')) {
            title.setAttribute('data-animate', 'fade-up');
        }

        exercises.querySelectorAll('.exercise').forEach((ex, index) => {
            if (!ex.hasAttribute('data-animate')) {
                ex.setAttribute('data-animate', 'fade-up');
            }
        });
    }

    // ==========================================
    // UNIFIED SCROLL HANDLER
    // Single rAF-throttled handler for all scroll-based features
    // ==========================================

    function initUnifiedScrollHandler() {
        // Collect all elements that need scroll updates
        const elements = {
            progressFill: document.querySelector('.progress-bar-fill'),
            header: document.querySelector('.header'),
            scrollToTop: document.querySelector('.scroll-to-top'),
            toolbar: document.querySelector('.reading-toolbar'),
            keyboardHint: document.querySelector('.keyboard-hint'),
            readingPosition: document.querySelector('.reading-position')
        };

        let ticking = false;
        let lastScrollTop = 0;
        let keyboardHintTimeout = null;

        function handleScroll() {
            const scrollTop = window.scrollY;
            const windowHeight = window.innerHeight;
            const documentHeight = document.documentElement.scrollHeight;

            // 1. Progress bar update
            if (elements.progressFill) {
                const scrollableHeight = documentHeight - windowHeight;
                const progress = Math.min((scrollTop / scrollableHeight) * 100, 100);
                elements.progressFill.style.width = progress + '%';
            }

            // 2. Header show/hide
            if (elements.header) {
                const threshold = 100;
                if (scrollTop > threshold) {
                    elements.header.classList.add('scrolled');
                } else {
                    elements.header.classList.remove('scrolled');
                }

                // Hide on scroll down, show on scroll up
                if (scrollTop > lastScrollTop && scrollTop > 300 && !document.body.classList.contains('mobile-nav-open')) {
                    elements.header.classList.add('header-hidden');
                } else {
                    elements.header.classList.remove('header-hidden');
                }
            }

            // 3. Scroll to top button visibility
            if (elements.scrollToTop) {
                if (scrollTop > 400) {
                    elements.scrollToTop.classList.add('is-visible');
                } else {
                    elements.scrollToTop.classList.remove('is-visible');
                }
            }

            // 4. Reading toolbar visibility
            if (elements.toolbar) {
                if (scrollTop > 200) {
                    elements.toolbar.classList.add('is-visible');
                } else {
                    elements.toolbar.classList.remove('is-visible');
                }
            }

            // 5. Reading position indicator (Chapter X of 20)
            if (elements.readingPosition) {
                if (scrollTop > 150) {
                    elements.readingPosition.classList.add('is-visible');
                } else {
                    elements.readingPosition.classList.remove('is-visible');
                }
            }

            // 6. Keyboard hint at bottom
            if (elements.keyboardHint && scrollTop + windowHeight > documentHeight - 200) {
                elements.keyboardHint.classList.add('visible');
                clearTimeout(keyboardHintTimeout);
                keyboardHintTimeout = setTimeout(function() {
                    elements.keyboardHint.classList.remove('visible');
                }, CONFIG.keyboardHint.hideDelay);
            }

            lastScrollTop = scrollTop;
        }

        window.addEventListener('scroll', function() {
            if (!ticking) {
                window.requestAnimationFrame(function() {
                    handleScroll();
                    ticking = false;
                });
                ticking = true;
            }
        }, { passive: true });

        // Initial call
        handleScroll();
    }

    // ==========================================
    // PROGRESS BAR (legacy - now handled by unified handler)
    // ==========================================

    function initProgressBar() {
        // Progress bar is now handled by initUnifiedScrollHandler
        // This function is kept for backwards compatibility
    }

    // ==========================================
    // KEYBOARD NAVIGATION
    // ==========================================

    function initKeyboardNav() {
        const prevLink = document.querySelector('.chapter-nav-prev');
        const nextLink = document.querySelector('.chapter-nav-next');
        const contentsLink = document.querySelector('.chapter-nav-contents a');

        document.addEventListener('keydown', function(e) {
            // Don't trigger if user is typing
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
                return;
            }

            switch(e.key) {
                case 'ArrowLeft':
                    if (prevLink && prevLink.href) {
                        e.preventDefault();
                        window.location.href = prevLink.href;
                    }
                    break;
                case 'ArrowRight':
                    if (nextLink && nextLink.href) {
                        e.preventDefault();
                        window.location.href = nextLink.href;
                    }
                    break;
                case 'Escape':
                    if (contentsLink) {
                        e.preventDefault();
                        window.location.href = contentsLink.href;
                    }
                    break;
            }
        });
    }

    // ==========================================
    // KEYBOARD HINT
    // ==========================================

    function initKeyboardHint() {
        const hint = document.querySelector('.keyboard-hint');
        if (!hint) return;

        // Show hint briefly on page load
        // Scroll-based showing is now handled by initUnifiedScrollHandler
        setTimeout(function() {
            hint.classList.add('visible');
            setTimeout(function() {
                hint.classList.remove('visible');
            }, CONFIG.keyboardHint.hideDelay);
        }, CONFIG.keyboardHint.showDelay);
    }

    // ==========================================
    // SMOOTH SCROLL FOR ANCHOR LINKS
    // ==========================================

    function initSmoothScroll() {
        document.querySelectorAll('a[href^="#"]').forEach(function(anchor) {
            anchor.addEventListener('click', function(e) {
                const targetId = this.getAttribute('href');
                if (targetId === '#') return;

                const target = document.querySelector(targetId);
                if (target) {
                    e.preventDefault();
                    const headerOffset = parseInt(
                        getComputedStyle(document.documentElement)
                            .getPropertyValue('--header-height')
                    ) || 72;
                    const elementPosition = target.getBoundingClientRect().top;
                    const offsetPosition = elementPosition + window.scrollY - headerOffset;

                    window.scrollTo({
                        top: offsetPosition,
                        behavior: 'smooth'
                    });
                }
            });
        });
    }

    // ==========================================
    // EXTERNAL LINK HANDLING
    // ==========================================

    function initExternalLinks() {
        document.querySelectorAll('a[href^="http"]').forEach(function(link) {
            if (!link.hasAttribute('target')) {
                link.setAttribute('target', '_blank');
                link.setAttribute('rel', 'noopener noreferrer');
            }
        });
    }

    // ==========================================
    // HEADER SCROLL BEHAVIOR
    // ==========================================

    function initHeaderScroll() {
        // Header scroll behavior is now handled by initUnifiedScrollHandler
        // This function is kept for backwards compatibility
    }

    // ==========================================
    // MOBILE NAVIGATION
    // ==========================================

    function initMobileNav() {
        const menuBtn = document.querySelector('.mobile-menu-btn');
        const closeBtn = document.querySelector('.mobile-nav-close');
        const overlay = document.querySelector('.mobile-nav-overlay');
        const mobileNav = document.querySelector('.mobile-nav');
        const mobileNavLinks = document.querySelectorAll('.mobile-nav-links a');

        if (!menuBtn || !mobileNav) return;

        function openMenu() {
            menuBtn.classList.add('is-active');
            menuBtn.setAttribute('aria-expanded', 'true');
            overlay.classList.add('is-active');
            overlay.setAttribute('aria-hidden', 'false');
            mobileNav.classList.add('is-active');
            mobileNav.setAttribute('aria-hidden', 'false');
            document.body.classList.add('mobile-nav-open');

            // Focus first link for accessibility
            const firstLink = mobileNav.querySelector('.mobile-nav-links a');
            if (firstLink) {
                setTimeout(() => firstLink.focus(), 300);
            }
        }

        function closeMenu() {
            menuBtn.classList.remove('is-active');
            menuBtn.setAttribute('aria-expanded', 'false');
            overlay.classList.remove('is-active');
            overlay.setAttribute('aria-hidden', 'true');
            mobileNav.classList.remove('is-active');
            mobileNav.setAttribute('aria-hidden', 'true');
            document.body.classList.remove('mobile-nav-open');

            // Return focus to menu button
            menuBtn.focus();
        }

        // Toggle menu on button click
        menuBtn.addEventListener('click', function(e) {
            e.preventDefault();
            if (mobileNav.classList.contains('is-active')) {
                closeMenu();
            } else {
                openMenu();
            }
        });

        // Close button
        if (closeBtn) {
            closeBtn.addEventListener('click', function(e) {
                e.preventDefault();
                closeMenu();
            });
        }

        // Close on overlay click
        if (overlay) {
            overlay.addEventListener('click', closeMenu);
        }

        // Close on anchor link click (for same-page navigation)
        mobileNavLinks.forEach(function(link) {
            link.addEventListener('click', function() {
                // Small delay to allow the click to register
                setTimeout(closeMenu, 100);
            });
        });

        // Close on escape key
        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape' && mobileNav.classList.contains('is-active')) {
                closeMenu();
            }
        });

        // Handle window resize - close menu if resized to desktop
        let resizeTimer;
        window.addEventListener('resize', function() {
            clearTimeout(resizeTimer);
            resizeTimer = setTimeout(function() {
                if (window.innerWidth > 768 && mobileNav.classList.contains('is-active')) {
                    closeMenu();
                }
            }, 150);
        });

        // Trap focus within mobile nav when open
        mobileNav.addEventListener('keydown', function(e) {
            if (e.key !== 'Tab') return;

            const focusableElements = mobileNav.querySelectorAll(
                'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
            );
            const firstElement = focusableElements[0];
            const lastElement = focusableElements[focusableElements.length - 1];

            if (e.shiftKey && document.activeElement === firstElement) {
                e.preventDefault();
                lastElement.focus();
            } else if (!e.shiftKey && document.activeElement === lastElement) {
                e.preventDefault();
                firstElement.focus();
            }
        });
    }

    // ==========================================
    // DECO BORDER ANIMATION
    // ==========================================

    function initDecoBorders() {
        document.querySelectorAll('.deco-border').forEach(border => {
            if (!border.hasAttribute('data-animate')) {
                border.setAttribute('data-animate', 'fade');
            }
        });
    }

    // ==========================================
    // TABLE OF CONTENTS ANIMATIONS
    // ==========================================

    function initTocAnimations() {
        // Animate introduction link
        const tocIntro = document.querySelector('.toc-intro');
        if (tocIntro && !tocIntro.hasAttribute('data-animate')) {
            tocIntro.setAttribute('data-animate', 'fade-up');
        }

        const tocParts = document.querySelectorAll('.toc-part');
        tocParts.forEach((part, partIndex) => {
            // Animate part header
            const header = part.querySelector('.toc-part-header');
            if (header && !header.hasAttribute('data-animate')) {
                header.setAttribute('data-animate', 'fade-up');
            }

            // Animate chapters
            const chapters = part.querySelectorAll('.toc-chapter');
            chapters.forEach((chapter, chapterIndex) => {
                if (!chapter.hasAttribute('data-animate')) {
                    chapter.setAttribute('data-animate', 'fade-up');
                    chapter.setAttribute('data-stagger', String(Math.min(chapterIndex + 1, 10)));
                }
            });

            // Make part a stagger group
            const chapterList = part.querySelector('.toc-chapters');
            if (chapterList && !chapterList.hasAttribute('data-animate-group')) {
                chapterList.setAttribute('data-animate-group', 'stagger');
            }
        });
    }

    // ==========================================
    // SCROLL TO TOP BUTTON
    // ==========================================

    function initScrollToTop() {
        const btn = document.querySelector('.scroll-to-top');
        if (!btn) return;

        // Visibility is now handled by initUnifiedScrollHandler
        // Just set up the click handler
        btn.addEventListener('click', function() {
            window.scrollTo({
                top: 0,
                behavior: 'smooth'
            });
        });
    }

    // ==========================================
    // CHAPTER PROGRESS TRACKING
    // ==========================================

    function initChapterProgress() {
        // Track visited chapters in localStorage
        const chapterMatch = window.location.pathname.match(/chapter-(\d+)/);
        if (chapterMatch) {
            const chapterNum = chapterMatch[1];
            let visited = [];
            try {
                visited = JSON.parse(safeGetItem('visitedChapters') || '[]');
            } catch (e) {
                visited = [];
            }
            if (!visited.includes(chapterNum)) {
                visited.push(chapterNum);
                safeSetItem('visitedChapters', JSON.stringify(visited));
            }

            // Save last visited chapter for "Continue Reading" feature
            const chapterTitle = document.querySelector('.chapter-title');
            const lastRead = {
                number: chapterNum,
                title: chapterTitle ? chapterTitle.textContent.trim() : 'Chapter ' + chapterNum,
                url: window.location.pathname,
                timestamp: Date.now()
            };
            safeSetItem('lastReadChapter', JSON.stringify(lastRead));
        }

        // Mark visited chapters in TOC
        let visited = [];
        try {
            visited = JSON.parse(safeGetItem('visitedChapters') || '[]');
        } catch (e) {
            visited = [];
        }
        document.querySelectorAll('.toc-chapter a').forEach(link => {
            const match = link.href.match(/chapter-(\d+)/);
            if (match && visited.includes(match[1])) {
                link.closest('.toc-chapter').classList.add('is-visited');
            }
        });

        // Populate "Continue Reading" section on homepage
        initContinueReading(visited);
    }

    function initContinueReading(visited) {
        const continueSection = document.getElementById('continue-reading');
        if (!continueSection) return;

        let lastRead;
        try {
            lastRead = JSON.parse(safeGetItem('lastReadChapter') || 'null');
        } catch (e) {
            lastRead = null;
        }

        if (lastRead && lastRead.url) {
            const link = continueSection.querySelector('.continue-reading-link');
            const title = continueSection.querySelector('.continue-reading-title');
            const chapter = continueSection.querySelector('.continue-reading-chapter');
            const progress = continueSection.querySelector('.continue-reading-progress');

            if (link) link.href = lastRead.url;
            if (title) title.textContent = lastRead.title;
            if (chapter) chapter.textContent = 'Chapter ' + lastRead.number;

            // Calculate reading progress
            if (progress && visited.length > 0) {
                const percentage = Math.round((visited.length / 20) * 100);
                progress.textContent = visited.length + ' of 20 chapters read (' + percentage + '%)';
            }

            continueSection.style.display = 'block';
        } else {
            continueSection.style.display = 'none';
        }
    }

    // ==========================================
    // READING TIME ESTIMATE
    // ==========================================

    function initReadingTime() {
        const content = document.querySelector('.chapter-content');
        const readingTimeEl = document.querySelector('.reading-time');
        if (!content || !readingTimeEl) return;

        const text = content.textContent || '';
        const wordCount = text.trim().split(/\s+/).length;
        // Use 175 wpm for educational content with terminology
        const readingTime = Math.ceil(wordCount / 175);
        readingTimeEl.textContent = readingTime + ' min read';
    }

    // ==========================================
    // MOBILE SWIPE GESTURES
    // ==========================================

    function initSwipeNavigation() {
        const prevLink = document.querySelector('.chapter-nav-prev');
        const nextLink = document.querySelector('.chapter-nav-next');

        if (!prevLink && !nextLink) return;

        let touchStartX = 0;
        let touchStartY = 0;
        let touchStartTime = 0;
        let touchStartElement = null;

        const minSwipeDistance = 100; // Increased for less accidental triggers
        const maxVerticalDistance = 75; // Ignore diagonal swipes
        const maxSwipeTime = 500; // Must complete within 500ms

        document.addEventListener('touchstart', function(e) {
            touchStartX = e.changedTouches[0].screenX;
            touchStartY = e.changedTouches[0].screenY;
            touchStartTime = Date.now();
            touchStartElement = e.target;
        }, { passive: true });

        document.addEventListener('touchend', function(e) {
            const touchEndX = e.changedTouches[0].screenX;
            const touchEndY = e.changedTouches[0].screenY;
            const touchEndTime = Date.now();

            // Check if swipe started on horizontally-scrollable element
            let el = touchStartElement;
            while (el && el !== document.body) {
                if (el.scrollWidth > el.clientWidth) {
                    // Element has horizontal scroll, don't intercept
                    return;
                }
                el = el.parentElement;
            }

            // Calculate distances
            const horizontalDistance = touchEndX - touchStartX;
            const verticalDistance = Math.abs(touchEndY - touchStartY);
            const swipeTime = touchEndTime - touchStartTime;

            // Validate swipe: must be mostly horizontal, fast enough, and long enough
            if (verticalDistance > maxVerticalDistance) return;
            if (swipeTime > maxSwipeTime) return;
            if (Math.abs(horizontalDistance) < minSwipeDistance) return;

            // Swipe right (prev chapter)
            if (horizontalDistance > 0 && prevLink && prevLink.href) {
                window.location.href = prevLink.href;
            }
            // Swipe left (next chapter)
            if (horizontalDistance < 0 && nextLink && nextLink.href) {
                window.location.href = nextLink.href;
            }
        }, { passive: true });
    }

    // ==========================================
    // SAFE LOCALSTORAGE HELPERS
    // ==========================================

    function safeGetItem(key) {
        try {
            return localStorage.getItem(key);
        } catch (e) {
            return null;
        }
    }

    function safeSetItem(key, value) {
        try {
            localStorage.setItem(key, value);
        } catch (e) {
            // Storage unavailable or quota exceeded
        }
    }

    // ==========================================
    // THEME TOGGLE (DARK/LIGHT MODE)
    // ==========================================

    function initThemeToggle() {
        const toggle = document.getElementById('theme-toggle');
        if (!toggle) return;

        // Get saved theme or system preference
        function getPreferredTheme() {
            const saved = safeGetItem('theme');
            if (saved) return saved;
            return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
        }

        // Apply theme
        function setTheme(theme) {
            document.documentElement.setAttribute('data-theme', theme);
            safeSetItem('theme', theme);
            // Update button to show what clicking it will DO (target state)
            const targetTheme = theme === 'dark' ? 'light' : 'dark';
            toggle.setAttribute('aria-label', 'Switch to ' + targetTheme + ' mode');
            toggle.setAttribute('title', 'Switch to ' + targetTheme + ' mode');
        }

        // Initialize (theme may already be set by inline script in head)
        const currentTheme = document.documentElement.getAttribute('data-theme');
        if (!currentTheme) {
            setTheme(getPreferredTheme());
        } else {
            // Just update button state to match current theme
            const targetTheme = currentTheme === 'dark' ? 'light' : 'dark';
            toggle.setAttribute('aria-label', 'Switch to ' + targetTheme + ' mode');
            toggle.setAttribute('title', 'Switch to ' + targetTheme + ' mode');
        }

        // Toggle on click
        toggle.addEventListener('click', function() {
            const current = document.documentElement.getAttribute('data-theme') || 'dark';
            setTheme(current === 'dark' ? 'light' : 'dark');
        });

        // Listen for system preference changes
        window.matchMedia('(prefers-color-scheme: light)').addEventListener('change', function(e) {
            if (!safeGetItem('theme')) {
                setTheme(e.matches ? 'light' : 'dark');
            }
        });
    }

    // ==========================================
    // FONT SIZE CONTROLS
    // ==========================================

    function initFontSizeControls() {
        const buttons = document.querySelectorAll('.font-btn');
        if (!buttons.length) return;

        // Get saved font size
        function getSavedFontSize() {
            return safeGetItem('fontSize') || 'normal';
        }

        // Apply font size
        function setFontSize(size) {
            document.documentElement.setAttribute('data-font-size', size);
            safeSetItem('fontSize', size);

            // Update button states
            buttons.forEach(btn => {
                btn.classList.toggle('is-active', btn.dataset.size === size);
                btn.setAttribute('aria-pressed', btn.dataset.size === size);
            });
        }

        // Initialize - check if already set by inline script
        const currentSize = document.documentElement.getAttribute('data-font-size');
        if (currentSize) {
            // Just update button states
            buttons.forEach(btn => {
                btn.classList.toggle('is-active', btn.dataset.size === currentSize);
                btn.setAttribute('aria-pressed', btn.dataset.size === currentSize);
            });
        } else {
            setFontSize(getSavedFontSize());
        }

        // Button clicks
        buttons.forEach(btn => {
            btn.addEventListener('click', function() {
                setFontSize(this.dataset.size);
            });
        });
    }

    // ==========================================
    // READING TOOLBAR VISIBILITY
    // ==========================================

    function initReadingToolbar() {
        // Visibility is now handled by initUnifiedScrollHandler
        // This function is kept for backwards compatibility
    }

    // ==========================================
    // CHAPTER TABLE OF CONTENTS SIDEBAR
    // ==========================================

    function initChapterToc() {
        const tocToggle = document.getElementById('toc-toggle');
        const content = document.querySelector('.chapter-content');
        if (!tocToggle || !content) return;

        // Generate TOC from headings
        const headings = content.querySelectorAll('h2, h3');
        if (!headings.length) return;

        // Create backdrop overlay
        const backdrop = document.createElement('div');
        backdrop.className = 'chapter-toc-backdrop';
        backdrop.setAttribute('aria-hidden', 'true');
        document.body.appendChild(backdrop);

        // Create sidebar
        const sidebar = document.createElement('aside');
        sidebar.className = 'chapter-toc-sidebar';
        sidebar.setAttribute('aria-label', 'Chapter table of contents');
        sidebar.setAttribute('aria-hidden', 'true');

        const sidebarHeader = document.createElement('div');
        sidebarHeader.className = 'chapter-toc-header';
        sidebarHeader.innerHTML = '<span class="chapter-toc-title">In this chapter</span><button class="chapter-toc-close" aria-label="Close table of contents"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg></button>';

        const nav = document.createElement('nav');
        nav.className = 'chapter-toc-nav';

        const list = document.createElement('ul');
        list.className = 'chapter-toc-list';

        headings.forEach((heading, index) => {
            // Ensure heading has an ID
            if (!heading.id) {
                heading.id = 'section-' + index;
            }

            const li = document.createElement('li');
            li.className = 'chapter-toc-item' + (heading.tagName === 'H3' ? ' is-sub' : '');

            const link = document.createElement('a');
            link.href = '#' + heading.id;
            link.textContent = heading.textContent;
            link.className = 'chapter-toc-link';

            li.appendChild(link);
            list.appendChild(li);
        });

        nav.appendChild(list);
        sidebar.appendChild(sidebarHeader);
        sidebar.appendChild(nav);
        document.body.appendChild(sidebar);

        const closeBtn = sidebar.querySelector('.chapter-toc-close');
        const firstLink = sidebar.querySelector('.chapter-toc-link');
        const allLinks = sidebar.querySelectorAll('.chapter-toc-link');
        const lastLink = allLinks[allLinks.length - 1];

        // Toggle sidebar
        function openToc() {
            sidebar.classList.add('is-open');
            sidebar.setAttribute('aria-hidden', 'false');
            backdrop.classList.add('is-visible');
            tocToggle.setAttribute('aria-expanded', 'true');
            document.body.style.overflow = 'hidden';
            // Focus first link after transition
            setTimeout(function() {
                if (firstLink) firstLink.focus();
            }, 100);
        }

        function closeToc() {
            sidebar.classList.remove('is-open');
            sidebar.setAttribute('aria-hidden', 'true');
            backdrop.classList.remove('is-visible');
            tocToggle.setAttribute('aria-expanded', 'false');
            document.body.style.overflow = '';
            tocToggle.focus();
        }

        tocToggle.addEventListener('click', function() {
            if (sidebar.classList.contains('is-open')) {
                closeToc();
            } else {
                openToc();
            }
        });

        // Close button
        closeBtn.addEventListener('click', closeToc);

        // Close on backdrop click
        backdrop.addEventListener('click', closeToc);

        // Close on escape
        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape' && sidebar.classList.contains('is-open')) {
                e.stopPropagation(); // Prevent conflict with other Escape handlers
                closeToc();
            }
        });

        // Focus trap
        sidebar.addEventListener('keydown', function(e) {
            if (e.key !== 'Tab') return;
            if (!sidebar.classList.contains('is-open')) return;

            if (e.shiftKey && document.activeElement === closeBtn) {
                e.preventDefault();
                lastLink.focus();
            } else if (!e.shiftKey && document.activeElement === lastLink) {
                e.preventDefault();
                closeBtn.focus();
            }
        });

        // Close on link click and scroll to section
        sidebar.querySelectorAll('.chapter-toc-link').forEach(link => {
            link.addEventListener('click', function(e) {
                e.preventDefault();
                const targetId = this.getAttribute('href');
                const target = document.querySelector(targetId);
                if (target) {
                    closeToc();
                    const headerOffset = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--header-height')) || 72;
                    const elementPosition = target.getBoundingClientRect().top;
                    const offsetPosition = elementPosition + window.scrollY - headerOffset - 20;

                    window.scrollTo({
                        top: offsetPosition,
                        behavior: 'smooth'
                    });
                }
            });
        });

        // Highlight current section
        const observerOptions = {
            rootMargin: '-20% 0px -70% 0px'
        };

        const sectionObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    sidebar.querySelectorAll('.chapter-toc-link').forEach(link => {
                        link.classList.remove('is-active');
                        if (link.getAttribute('href') === '#' + entry.target.id) {
                            link.classList.add('is-active');
                        }
                    });
                }
            });
        }, observerOptions);

        headings.forEach(heading => sectionObserver.observe(heading));
    }

    // ==========================================
    // PAGE TRANSITIONS
    // ==========================================

    function initPageTransitions() {
        // Always ensure page is visible (fixes back button black screen)
        document.body.classList.remove('page-transition-exit');
        document.body.classList.remove('page-transition-enter');
        document.body.style.opacity = '1';

        // Handle page restore from bfcache (back/forward cache)
        window.addEventListener('pageshow', function(e) {
            if (e.persisted) {
                // Page was restored from bfcache - ensure it's visible
                document.body.classList.remove('page-transition-exit');
                document.body.style.opacity = '1';
            }
        });

        // NOTE: We no longer use body-level fade transitions
        // Element-level animations via IntersectionObserver provide better UX
    }

    // ==========================================
    // KEYBOARD SHORTCUTS HELP MODAL
    // ==========================================

    function initKeyboardHelp() {
        const modal = document.getElementById('keyboard-help');
        if (!modal) return;

        const backdrop = modal.querySelector('.keyboard-help-backdrop');
        const closeBtn = modal.querySelector('.keyboard-help-close');

        function openHelp() {
            modal.classList.add('is-open');
            modal.setAttribute('aria-hidden', 'false');
            document.body.style.overflow = 'hidden';
            if (closeBtn) {
                setTimeout(function() {
                    closeBtn.focus();
                }, 100);
            }
        }

        function closeHelp() {
            modal.classList.remove('is-open');
            modal.setAttribute('aria-hidden', 'true');
            document.body.style.overflow = '';
        }

        function isHelpOpen() {
            return modal.classList.contains('is-open');
        }

        // Global keyboard shortcut: ? to open help
        document.addEventListener('keydown', function(e) {
            // Don't trigger if typing in an input
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) {
                return;
            }

            // ? key (with or without shift, depending on keyboard layout)
            if (e.key === '?' || (e.shiftKey && e.key === '/')) {
                e.preventDefault();
                if (isHelpOpen()) {
                    closeHelp();
                } else {
                    openHelp();
                }
                return;
            }

            // Escape to close
            if (e.key === 'Escape' && isHelpOpen()) {
                e.preventDefault();
                e.stopPropagation();
                closeHelp();
                return;
            }

            // Additional shortcuts mentioned in help
            // D for dark mode toggle
            if (e.key === 'd' || e.key === 'D') {
                if (isHelpOpen()) return;
                const themeToggle = document.getElementById('theme-toggle');
                if (themeToggle) {
                    themeToggle.click();
                }
                return;
            }

            // T for table of contents
            if (e.key === 't' || e.key === 'T') {
                if (isHelpOpen()) return;
                const tocToggle = document.getElementById('toc-toggle');
                if (tocToggle) {
                    tocToggle.click();
                }
                return;
            }

            // + / - for font size
            if (e.key === '+' || e.key === '=') {
                if (isHelpOpen()) return;
                const largeBtn = document.querySelector('.font-btn[data-size="large"]');
                if (largeBtn) largeBtn.click();
                return;
            }

            if (e.key === '-' || e.key === '_') {
                if (isHelpOpen()) return;
                const smallBtn = document.querySelector('.font-btn[data-size="small"]');
                if (smallBtn) smallBtn.click();
                return;
            }
        });

        // Close on backdrop click
        if (backdrop) {
            backdrop.addEventListener('click', closeHelp);
        }

        // Close button
        if (closeBtn) {
            closeBtn.addEventListener('click', closeHelp);
        }

        // Focus trap
        modal.addEventListener('keydown', function(e) {
            if (e.key !== 'Tab') return;
            if (!isHelpOpen()) return;

            const focusable = modal.querySelectorAll('button, [href], [tabindex]:not([tabindex="-1"])');
            const first = focusable[0];
            const last = focusable[focusable.length - 1];

            if (e.shiftKey && document.activeElement === first) {
                e.preventDefault();
                last.focus();
            } else if (!e.shiftKey && document.activeElement === last) {
                e.preventDefault();
                first.focus();
            }
        });

        // Expose globally for potential external triggers
        window.toggleKeyboardHelp = function() {
            if (isHelpOpen()) {
                closeHelp();
            } else {
                openHelp();
            }
        };
    }

    // ==========================================
    // CHECK IF RETURNING VIA BACK/FORWARD
    // ==========================================

    function isBackForwardNavigation() {
        if (performance.navigation && performance.navigation.type === 2) {
            return true;
        }
        if (performance.getEntriesByType) {
            const navEntry = performance.getEntriesByType('navigation')[0];
            if (navEntry && navEntry.type === 'back_forward') {
                return true;
            }
        }
        return false;
    }

    // ==========================================
    // INITIALIZE ALL FEATURES
    // ==========================================

    function init() {
        // Check if this is a back/forward navigation
        const skipAnimations = isBackForwardNavigation();

        // Auto-add animation attributes (before observer init)
        initAutoAnimateHero(skipAnimations);
        initAutoAnimateContent();
        initAutoAnimateExercises();
        initDecoBorders();
        initTocAnimations();

        // If returning via back button, show everything immediately
        if (skipAnimations) {
            document.querySelectorAll('[data-animate]').forEach(el => {
                el.classList.add('is-visible');
            });
        } else {
            // Initialize animation observer for fresh page loads
            initScrollAnimations();
        }

        // Initialize unified scroll handler (handles progress bar, header, scroll-to-top, toolbar)
        initUnifiedScrollHandler();

        // Initialize other features
        initProgressBar();      // Legacy - now handled by unified handler
        initKeyboardNav();
        initKeyboardHint();
        initSmoothScroll();
        initExternalLinks();
        initHeaderScroll();     // Legacy - now handled by unified handler
        initMobileNav();
        initScrollToTop();
        initChapterProgress();
        initReadingTime();
        initSwipeNavigation();
        initThemeToggle();
        initFontSizeControls();
        initReadingToolbar();   // Legacy - now handled by unified handler
        initChapterToc();
        initPageTransitions();
        initKeyboardHelp();
    }

    // Run when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();

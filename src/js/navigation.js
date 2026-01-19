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

        // Create observer for individual elements
        const elementObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('is-visible');
                    // Optionally unobserve after animation (performance)
                    elementObserver.unobserve(entry.target);
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
                    // Trigger children animations
                    entry.target.querySelectorAll('[data-animate]').forEach(child => {
                        child.classList.add('is-visible');
                    });
                    groupObserver.unobserve(entry.target);
                }
            });
        }, {
            threshold: CONFIG.animation.threshold,
            rootMargin: CONFIG.animation.rootMargin
        });

        // Observe all animated elements
        document.querySelectorAll('[data-animate]:not([data-animate-group] [data-animate])').forEach(el => {
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

    function initAutoAnimateHero() {
        const hero = document.querySelector('.chapter-hero, .toc-hero');
        if (!hero) return;

        // Elements to animate in hero
        const heroElements = hero.querySelectorAll(
            '.chapter-part, .chapter-number, .chapter-title, .chapter-subtitle, ' +
            '.toc-badge, .toc-title, .toc-subtitle'
        );

        heroElements.forEach((el, index) => {
            if (!el.hasAttribute('data-animate')) {
                el.setAttribute('data-animate', 'fade-up');
                el.setAttribute('data-stagger', String(Math.min(index + 1, 5)));
            }
        });

        // Mark hero as visible immediately (above fold)
        requestAnimationFrame(() => {
            heroElements.forEach(el => el.classList.add('is-visible'));
        });
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
    // PROGRESS BAR
    // ==========================================

    function initProgressBar() {
        const progressFill = document.querySelector('.progress-bar-fill');
        if (!progressFill) return;

        let ticking = false;

        function updateProgress() {
            const windowHeight = window.innerHeight;
            const documentHeight = document.documentElement.scrollHeight - windowHeight;
            const scrolled = window.scrollY;
            const progress = Math.min((scrolled / documentHeight) * 100, 100);
            progressFill.style.width = progress + '%';
        }

        window.addEventListener('scroll', function() {
            if (!ticking) {
                window.requestAnimationFrame(function() {
                    updateProgress();
                    ticking = false;
                });
                ticking = true;
            }
        }, { passive: true });

        // Initial update
        updateProgress();
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

        let hideTimeout;

        function showHint() {
            hint.classList.add('visible');
            clearTimeout(hideTimeout);
            hideTimeout = setTimeout(function() {
                hint.classList.remove('visible');
            }, CONFIG.keyboardHint.hideDelay);
        }

        // Show hint briefly on page load
        setTimeout(showHint, CONFIG.keyboardHint.showDelay);

        // Show hint when near bottom
        window.addEventListener('scroll', function() {
            const scrollTop = window.scrollY;
            const windowHeight = window.innerHeight;
            const documentHeight = document.documentElement.scrollHeight;

            if (scrollTop + windowHeight > documentHeight - 200) {
                showHint();
            }
        }, { passive: true });
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
        const header = document.querySelector('.header');
        if (!header) return;

        let lastScrollTop = 0;
        const threshold = 100;

        window.addEventListener('scroll', function() {
            const scrollTop = window.scrollY;

            if (scrollTop > threshold) {
                header.classList.add('scrolled');
            } else {
                header.classList.remove('scrolled');
            }

            // Optional: hide header on scroll down, show on scroll up
            // Don't hide if mobile nav is open
            if (scrollTop > lastScrollTop && scrollTop > 300 && !document.body.classList.contains('mobile-nav-open')) {
                header.classList.add('header-hidden');
            } else {
                header.classList.remove('header-hidden');
            }

            lastScrollTop = scrollTop;
        }, { passive: true });
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
    // INITIALIZE ALL FEATURES
    // ==========================================

    function init() {
        // Auto-add animation attributes (before observer init)
        initAutoAnimateHero();
        initAutoAnimateContent();
        initAutoAnimateExercises();
        initDecoBorders();
        initTocAnimations();

        // Initialize animation observer
        initScrollAnimations();

        // Initialize other features
        initProgressBar();
        initKeyboardNav();
        initKeyboardHint();
        initSmoothScroll();
        initExternalLinks();
        initHeaderScroll();
        initMobileNav();
    }

    // Run when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();

/**
 * Community Popup
 * Shows a SuperDebate promotion after 60 seconds of cumulative session time
 * Only displays once every 5 days per user
 */

(function() {
    'use strict';

    const POPUP_DELAY = 60000; // 60 seconds
    const SUPPRESS_DURATION = 5 * 24 * 60 * 60 * 1000; // 5 days in ms
    const STORAGE_KEY = 'community_popup_last_shown';
    const SESSION_TIME_KEY = 'community_popup_session_time';
    const SESSION_START_KEY = 'community_popup_session_start';

    let popup = null;
    let timeoutId = null;
    let previouslyFocused = null;
    let focusTrapHandler = null;

    /**
     * Check if popup should be shown
     */
    function shouldShowPopup() {
        try {
            const lastShown = localStorage.getItem(STORAGE_KEY);
            if (!lastShown) return true;

            const elapsed = Date.now() - parseInt(lastShown, 10);
            return elapsed >= SUPPRESS_DURATION;
        } catch (e) {
            // localStorage not available
            return false;
        }
    }

    /**
     * Record that popup was shown
     */
    function recordPopupShown() {
        try {
            localStorage.setItem(STORAGE_KEY, Date.now().toString());
        } catch (e) {
            // localStorage not available
        }
    }

    /**
     * Get cumulative session time across page navigations
     */
    function getSessionTime() {
        try {
            const accumulated = parseInt(sessionStorage.getItem(SESSION_TIME_KEY) || '0', 10);
            return accumulated;
        } catch (e) {
            return 0;
        }
    }

    /**
     * Save accumulated time when leaving page
     */
    function saveSessionTime(startTime) {
        try {
            const accumulated = parseInt(sessionStorage.getItem(SESSION_TIME_KEY) || '0', 10);
            const currentPageTime = Date.now() - startTime;
            sessionStorage.setItem(SESSION_TIME_KEY, (accumulated + currentPageTime).toString());
        } catch (e) {
            // sessionStorage not available
        }
    }

    /**
     * Create focus trap within popup
     */
    function trapFocus() {
        const focusableSelectors = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
        const focusableElements = popup.querySelectorAll(focusableSelectors);

        if (focusableElements.length === 0) return;

        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        focusTrapHandler = function(e) {
            if (e.key !== 'Tab') return;

            if (e.shiftKey) {
                // Shift + Tab
                if (document.activeElement === firstElement) {
                    e.preventDefault();
                    lastElement.focus();
                }
            } else {
                // Tab
                if (document.activeElement === lastElement) {
                    e.preventDefault();
                    firstElement.focus();
                }
            }
        };

        popup.addEventListener('keydown', focusTrapHandler);
    }

    /**
     * Remove focus trap
     */
    function removeFocusTrap() {
        if (focusTrapHandler) {
            popup.removeEventListener('keydown', focusTrapHandler);
            focusTrapHandler = null;
        }
    }

    /**
     * Show the popup with animation
     */
    function showPopup() {
        if (!popup) return;

        // Store the element that had focus before opening
        previouslyFocused = document.activeElement;

        popup.classList.add('is-visible');
        document.body.classList.add('popup-open');

        // Set up focus trap
        trapFocus();

        // Focus the close button for accessibility
        const closeBtn = popup.querySelector('.community-popup-close');
        if (closeBtn) {
            setTimeout(() => closeBtn.focus(), 300);
        }

        // Record that we showed it
        recordPopupShown();
    }

    /**
     * Hide the popup with animation
     */
    function hidePopup() {
        if (!popup) return;

        popup.classList.remove('is-visible');
        document.body.classList.remove('popup-open');

        // Remove focus trap
        removeFocusTrap();

        // Return focus to previously focused element
        if (previouslyFocused && typeof previouslyFocused.focus === 'function') {
            previouslyFocused.focus();
        }
        previouslyFocused = null;
    }

    /**
     * Initialize popup functionality
     */
    function init() {
        popup = document.getElementById('community-popup');
        if (!popup) return;

        // Check if we should show the popup
        if (!shouldShowPopup()) {
            return;
        }

        // Track page start time for session accumulation
        const pageStartTime = Date.now();

        // Set up event listeners
        const closeBtn = popup.querySelector('.community-popup-close');
        const dismissBtn = popup.querySelector('.community-popup-dismiss');
        const backdrop = popup.querySelector('.community-popup-backdrop');
        const ctaBtn = popup.querySelector('.community-popup-cta');

        if (closeBtn) {
            closeBtn.addEventListener('click', hidePopup);
        }

        if (dismissBtn) {
            dismissBtn.addEventListener('click', hidePopup);
        }

        if (backdrop) {
            backdrop.addEventListener('click', hidePopup);
        }

        // Close on CTA click (after slight delay for link to work)
        if (ctaBtn) {
            ctaBtn.addEventListener('click', function() {
                setTimeout(hidePopup, 100);
            });
        }

        // Close on Escape key
        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape' && popup.classList.contains('is-visible')) {
                hidePopup();
            }
        });

        // Calculate remaining time based on session accumulation
        const elapsedSessionTime = getSessionTime();
        const remainingTime = Math.max(0, POPUP_DELAY - elapsedSessionTime);

        // Schedule popup to appear after remaining delay
        timeoutId = setTimeout(showPopup, remainingTime);

        // Save session time when user navigates away
        window.addEventListener('beforeunload', function() {
            if (timeoutId) {
                clearTimeout(timeoutId);
            }
            saveSessionTime(pageStartTime);
        });

        // Also save on visibility change (mobile tab switching)
        document.addEventListener('visibilitychange', function() {
            if (document.visibilityState === 'hidden') {
                saveSessionTime(pageStartTime);
            }
        });
    }

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();

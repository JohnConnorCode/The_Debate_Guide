/**
 * Community Popup
 * Shows a SuperDebate promotion after 30 seconds
 * Only displays once every 5 days per user
 */

(function() {
    'use strict';

    const POPUP_DELAY = 30000; // 30 seconds
    const SUPPRESS_DURATION = 5 * 24 * 60 * 60 * 1000; // 5 days in ms
    const STORAGE_KEY = 'community_popup_last_shown';

    let popup = null;
    let timeoutId = null;

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
     * Show the popup with animation
     */
    function showPopup() {
        if (!popup) return;

        popup.classList.add('is-visible');
        document.body.classList.add('popup-open');

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

        // Schedule popup to appear after delay
        timeoutId = setTimeout(showPopup, POPUP_DELAY);

        // Cancel if user navigates away
        window.addEventListener('beforeunload', function() {
            if (timeoutId) {
                clearTimeout(timeoutId);
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

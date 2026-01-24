/**
 * The Debate Guide - Toast Notification System
 *
 * Simple, accessible toast notifications for feedback.
 * Used for quiz completion, offline mode, and service worker updates.
 */

(function() {
    'use strict';

    // Toast container element
    let container = null;

    // Default options
    const defaults = {
        duration: 5000,
        type: 'info', // info, success, error, warning
        dismissible: true,
        position: 'bottom-center'
    };

    /**
     * Initialize toast container
     */
    function init() {
        if (container) return;

        container = document.createElement('div');
        container.className = 'toast-container';
        container.setAttribute('role', 'region');
        container.setAttribute('aria-label', 'Notifications');
        container.setAttribute('aria-live', 'polite');
        document.body.appendChild(container);
    }

    /**
     * Show a toast notification
     * @param {string} message - The message to display
     * @param {Object} options - Configuration options
     * @returns {HTMLElement} The toast element
     */
    function show(message, options = {}) {
        init();

        const config = { ...defaults, ...options };

        // Create toast element
        const toast = document.createElement('div');
        toast.className = `toast toast-${config.type}`;
        toast.setAttribute('role', 'status');

        // Icon based on type
        const icons = {
            info: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>',
            success: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>',
            error: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>',
            warning: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>'
        };

        // Build toast content
        let html = `
            <span class="toast-icon">${icons[config.type] || icons.info}</span>
            <span class="toast-message">${message}</span>
        `;

        // Add action button if provided
        if (config.action) {
            html += `<button class="toast-action" type="button">${config.action.label}</button>`;
        }

        // Add dismiss button if dismissible
        if (config.dismissible) {
            html += `
                <button class="toast-dismiss" type="button" aria-label="Dismiss">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <line x1="18" y1="6" x2="6" y2="18"></line>
                        <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                </button>
            `;
        }

        toast.innerHTML = html;

        // Add event handlers
        if (config.action && config.action.onClick) {
            const actionBtn = toast.querySelector('.toast-action');
            actionBtn.addEventListener('click', () => {
                config.action.onClick();
                dismiss(toast);
            });
        }

        if (config.dismissible) {
            const dismissBtn = toast.querySelector('.toast-dismiss');
            dismissBtn.addEventListener('click', () => dismiss(toast));
        }

        // Add to container
        container.appendChild(toast);

        // Trigger animation
        requestAnimationFrame(() => {
            toast.classList.add('toast-visible');
        });

        // Auto dismiss after duration
        if (config.duration > 0) {
            setTimeout(() => dismiss(toast), config.duration);
        }

        return toast;
    }

    /**
     * Dismiss a toast
     * @param {HTMLElement} toast - The toast element to dismiss
     */
    function dismiss(toast) {
        if (!toast || !toast.parentNode) return;

        toast.classList.remove('toast-visible');
        toast.classList.add('toast-hiding');

        // Remove after animation
        toast.addEventListener('animationend', () => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        }, { once: true });
    }

    /**
     * Dismiss all toasts
     */
    function dismissAll() {
        if (!container) return;
        const toasts = container.querySelectorAll('.toast');
        toasts.forEach(toast => dismiss(toast));
    }

    // Convenience methods
    function info(message, options = {}) {
        return show(message, { ...options, type: 'info' });
    }

    function success(message, options = {}) {
        return show(message, { ...options, type: 'success' });
    }

    function error(message, options = {}) {
        return show(message, { ...options, type: 'error' });
    }

    function warning(message, options = {}) {
        return show(message, { ...options, type: 'warning' });
    }

    // Listen for offline/online events
    window.addEventListener('online', () => {
        success('You\'re back online');
    });

    window.addEventListener('offline', () => {
        warning('You\'re offline. Some features may be limited.', { duration: 8000 });
    });

    // Export global API
    window.Toast = {
        show,
        dismiss,
        dismissAll,
        info,
        success,
        error,
        warning
    };

})();

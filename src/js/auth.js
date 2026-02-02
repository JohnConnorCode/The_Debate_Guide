/**
 * The Debate Guide - Authentication Module
 * Supports Google OAuth and Email/Password login
 * Shares authentication with superdebate.org via Supabase
 */

(function() {
    'use strict';

    // Supabase client (loaded from CDN in base.njk)
    let supabase = null;

    // Storage keys
    const ANON_ID_KEY = 'debateGuideUserId';
    const USER_KEY = 'debateGuideUser';

    // ==========================================
    // INITIALIZATION
    // ==========================================

    function initSupabase() {
        if (typeof window.supabase === 'undefined') {
            console.warn('Supabase client not loaded');
            return false;
        }

        const supabaseUrl = window.SUPABASE_URL;
        const supabaseAnonKey = window.SUPABASE_ANON_KEY;

        if (!supabaseUrl || !supabaseAnonKey) {
            console.warn('Supabase credentials not configured');
            return false;
        }

        supabase = window.supabase.createClient(supabaseUrl, supabaseAnonKey);
        return true;
    }

    // ==========================================
    // AUTH STATE
    // ==========================================

    /**
     * Get current authenticated user (if any)
     */
    async function getUser() {
        if (!supabase) return null;

        try {
            const { data: { user }, error } = await supabase.auth.getUser();
            if (error || !user) return null;
            return user;
        } catch (e) {
            return null;
        }
    }

    /**
     * Get current session
     */
    async function getSession() {
        if (!supabase) return null;

        try {
            const { data: { session }, error } = await supabase.auth.getSession();
            if (error) return null;
            return session;
        } catch (e) {
            return null;
        }
    }

    /**
     * Check if user is logged in
     */
    async function isLoggedIn() {
        const user = await getUser();
        return !!user;
    }

    // ==========================================
    // LOGIN METHODS
    // ==========================================

    /**
     * Sign in with Google OAuth
     */
    async function signInWithGoogle() {
        if (!supabase) {
            return { error: { message: 'Auth not initialized' } };
        }

        const { data, error } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: window.location.origin + '/auth/callback/'
            }
        });

        return { data, error };
    }

    /**
     * Sign in with email and password
     */
    async function signInWithEmail(email, password) {
        if (!supabase) {
            return { error: { message: 'Auth not initialized' } };
        }

        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password
        });

        if (!error && data.user) {
            await linkAnonymousProgress(data.user);
        }

        return { data, error };
    }

    /**
     * Sign up with email and password
     */
    async function signUpWithEmail(email, password) {
        if (!supabase) {
            return { error: { message: 'Auth not initialized' } };
        }

        const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: {
                emailRedirectTo: window.location.origin + '/auth/callback/'
            }
        });

        return { data, error };
    }

    /**
     * Sign out
     */
    async function signOut() {
        if (!supabase) return;

        await supabase.auth.signOut();
        localStorage.removeItem(USER_KEY);
        updateAuthUI(null);
    }

    // ==========================================
    // PROGRESS LINKING
    // ==========================================

    /**
     * Link anonymous progress to authenticated account
     * Called after successful login
     */
    async function linkAnonymousProgress(user) {
        if (!user || !user.id) return;

        try {
            const anonymousId = localStorage.getItem(ANON_ID_KEY);
            if (!anonymousId) return;

            // Call API to link anonymous progress to authenticated user
            await fetch('/api/auth/link-progress', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    anonymousId,
                    userId: user.id,
                    email: user.email
                })
            });

            console.debug('Linked anonymous progress to account');
        } catch (e) {
            console.debug('Failed to link progress:', e);
        }
    }

    // ==========================================
    // UI UPDATES
    // ==========================================

    /**
     * Update UI based on auth state
     */
    function updateAuthUI(user) {
        const loginBtn = document.getElementById('auth-login-btn');
        const userMenu = document.getElementById('auth-user-menu');
        const userName = document.getElementById('auth-user-name');
        const userAvatar = document.getElementById('auth-user-avatar');
        const mobileAuthText = document.getElementById('mobile-auth-text');

        if (!loginBtn) return; // Auth UI not on this page

        if (user) {
            // Logged in
            loginBtn.style.display = 'none';
            if (userMenu) userMenu.style.display = 'flex';
            if (userName) userName.textContent = user.email?.split('@')[0] || 'User';
            if (userAvatar && user.user_metadata?.avatar_url) {
                userAvatar.src = user.user_metadata.avatar_url;
                userAvatar.style.display = 'block';
            }
            // Update mobile auth button text
            if (mobileAuthText) {
                mobileAuthText.textContent = user.email?.split('@')[0] || 'Account';
            }
        } else {
            // Logged out
            loginBtn.style.display = 'flex';
            if (userMenu) userMenu.style.display = 'none';
            // Reset mobile auth button text
            if (mobileAuthText) {
                mobileAuthText.textContent = 'Sign In';
            }
        }
    }

    // ==========================================
    // AUTH MODAL
    // ==========================================

    let authModal = null;

    function createAuthModal() {
        if (authModal) return authModal;

        const modal = document.createElement('div');
        modal.id = 'auth-modal';
        modal.className = 'auth-modal';
        modal.setAttribute('aria-hidden', 'true');
        modal.innerHTML = `
            <div class="auth-backdrop"></div>
            <div class="auth-container" role="dialog" aria-labelledby="auth-title">
                <button class="auth-close" aria-label="Close">&times;</button>
                <h2 id="auth-title">Sign In</h2>
                <p class="auth-subtitle">Sync your progress across devices</p>

                <button class="auth-google-btn" id="auth-google-btn">
                    <svg viewBox="0 0 24 24" width="20" height="20">
                        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                    </svg>
                    Continue with Google
                </button>

                <div class="auth-divider"><span>or</span></div>

                <form id="auth-email-form" class="auth-form">
                    <div class="auth-tabs">
                        <button type="button" class="auth-tab active" data-tab="signin">Sign In</button>
                        <button type="button" class="auth-tab" data-tab="signup">Sign Up</button>
                    </div>

                    <input type="email" id="auth-email" placeholder="Email" required autocomplete="email">
                    <input type="password" id="auth-password" placeholder="Password" required autocomplete="current-password" minlength="6">

                    <button type="submit" class="auth-submit-btn" id="auth-submit-btn">Sign In</button>

                    <p class="auth-error" id="auth-error" hidden></p>
                </form>

                <p class="auth-footer">
                    Your progress syncs with <a href="https://superdebate.org" target="_blank">superdebate.org</a>
                </p>
            </div>
        `;

        document.body.appendChild(modal);
        authModal = modal;

        // Bind events
        modal.querySelector('.auth-backdrop').addEventListener('click', closeAuthModal);
        modal.querySelector('.auth-close').addEventListener('click', closeAuthModal);
        modal.querySelector('#auth-google-btn').addEventListener('click', handleGoogleLogin);
        modal.querySelector('#auth-email-form').addEventListener('submit', handleEmailSubmit);

        // Tab switching
        modal.querySelectorAll('.auth-tab').forEach(tab => {
            tab.addEventListener('click', (e) => {
                modal.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
                e.target.classList.add('active');
                const isSignup = e.target.dataset.tab === 'signup';
                modal.querySelector('#auth-submit-btn').textContent = isSignup ? 'Sign Up' : 'Sign In';
                modal.querySelector('#auth-password').autocomplete = isSignup ? 'new-password' : 'current-password';
            });
        });

        // Escape key
        modal.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') closeAuthModal();
        });

        return modal;
    }

    function openAuthModal() {
        const modal = createAuthModal();
        modal.classList.add('is-open');
        modal.setAttribute('aria-hidden', 'false');
        document.body.style.overflow = 'hidden';
        modal.querySelector('#auth-email').focus();
    }

    function closeAuthModal() {
        if (!authModal) return;
        authModal.classList.remove('is-open');
        authModal.setAttribute('aria-hidden', 'true');
        document.body.style.overflow = '';
        // Clear form
        authModal.querySelector('#auth-email').value = '';
        authModal.querySelector('#auth-password').value = '';
        authModal.querySelector('#auth-error').hidden = true;
    }

    function showAuthError(message) {
        const errorEl = authModal.querySelector('#auth-error');
        errorEl.textContent = message;
        errorEl.hidden = false;
    }

    async function handleGoogleLogin() {
        const { error } = await signInWithGoogle();
        if (error) {
            showAuthError(error.message);
        }
        // OAuth will redirect, no need to close modal
    }

    async function handleEmailSubmit(e) {
        e.preventDefault();

        const email = authModal.querySelector('#auth-email').value.trim();
        const password = authModal.querySelector('#auth-password').value;
        const isSignup = authModal.querySelector('.auth-tab.active').dataset.tab === 'signup';

        const submitBtn = authModal.querySelector('#auth-submit-btn');
        submitBtn.disabled = true;
        submitBtn.textContent = isSignup ? 'Creating account...' : 'Signing in...';

        let result;
        if (isSignup) {
            result = await signUpWithEmail(email, password);
            if (!result.error) {
                showAuthError('Check your email to confirm your account.');
                submitBtn.disabled = false;
                submitBtn.textContent = 'Sign Up';
                return;
            }
        } else {
            result = await signInWithEmail(email, password);
        }

        submitBtn.disabled = false;
        submitBtn.textContent = isSignup ? 'Sign Up' : 'Sign In';

        if (result.error) {
            showAuthError(result.error.message);
        } else {
            closeAuthModal();
            updateAuthUI(result.data.user);
            window.dispatchEvent(new CustomEvent('authStateChanged', { detail: { user: result.data.user } }));
        }
    }

    // ==========================================
    // INITIALIZATION
    // ==========================================

    async function init() {
        const supabaseAvailable = initSupabase();

        if (!supabaseAvailable) {
            console.debug('Auth: Supabase not available, running in anonymous mode');
        }

        // Check for existing session (only if Supabase available)
        const user = supabaseAvailable ? await getUser() : null;
        updateAuthUI(user);

        if (user) {
            // Link any anonymous progress
            await linkAnonymousProgress(user);
        }

        // Listen for auth state changes (only if Supabase available)
        if (supabaseAvailable && supabase) {
            supabase.auth.onAuthStateChange((event, session) => {
                const user = session?.user || null;
                updateAuthUI(user);

                if (event === 'SIGNED_IN' && user) {
                    linkAnonymousProgress(user);
                }

                window.dispatchEvent(new CustomEvent('authStateChanged', { detail: { user, event } }));
            });
        }

        // Bind login button (if exists)
        const loginBtn = document.getElementById('auth-login-btn');
        if (loginBtn) {
            loginBtn.addEventListener('click', openAuthModal);
        }

        // Bind logout button (if exists)
        const logoutBtn = document.getElementById('auth-logout-btn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', signOut);
        }

        // Mobile auth button
        const mobileAuthBtn = document.getElementById('mobile-auth-btn');
        if (mobileAuthBtn) {
            mobileAuthBtn.addEventListener('click', () => {
                // Close mobile nav first
                document.querySelector('.mobile-nav')?.classList.remove('is-active');
                document.querySelector('.mobile-nav-overlay')?.classList.remove('is-active');
                document.body.classList.remove('mobile-nav-open');
                // Then show auth modal
                openAuthModal();
            });
        }
    }

    // Run when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // Expose public API
    window.DebateGuideAuth = {
        getUser,
        getSession,
        isLoggedIn,
        signInWithGoogle,
        signInWithEmail,
        signUpWithEmail,
        signOut,
        openAuthModal,
        closeAuthModal
    };

})();

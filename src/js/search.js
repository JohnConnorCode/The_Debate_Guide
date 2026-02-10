/**
 * The Debate Guide - Client-Side Search
 *
 * Simple search implementation that indexes chapters and vocabulary.
 * Search index is dynamically loaded from /search-index.json (built by Eleventy).
 */

(function() {
    'use strict';

    // Search data - loaded dynamically
    let searchData = [];
    let isLoaded = false;
    let loadPromise = null;

    // DOM elements
    let modal, input, results, backdrop, closeBtn;

    // Focus management
    let previouslyFocused = null;
    let focusTrapHandler = null;

    // ==========================================
    // SEARCH INDEX LOADING
    // ==========================================

    // Additional keywords for pages (enables finding pages by related terms)
    const pageKeywords = {
        '/author/': 'John Connor founder CEO SuperDebate Chicago debate coach South Side biography author',
        '/about/': 'SuperDebate mission story about community civic discourse debate club founder John Connor',
        '/faq/': 'questions help how frequently asked FAQ support',
        '/learning-paths/': 'beginner advanced intermediate path track curriculum guided',
        '/quizzes/': 'quiz test knowledge assessment score practice',
        '/how-quizzes-work/': 'quiz scoring rules how to help',
        '/quick-tactics/': 'tactics tips techniques strategies quick actionable',
        '/debate-prep/': 'preparation practice debate tournament ready',
        '/live-response/': 'live practice real-time response training',
        '/progress/': 'reading progress track chapters completion',
        '/glossary/': 'vocabulary terms definitions Greek rhetoric glossary',
        '/resources/': 'books reading list bibliography materials further study',
        '/superdebate-appendix/': 'SuperDebate platform appendix supplementary',
        '/superdebate-format/': 'SuperDebate format rules structure competition tournament',
        '/introduction/': 'introduction beginning start agora rhetoric persuasion',
        '/privacy/': 'privacy data policy personal information',
        '/terms/': 'terms service conditions legal agreement'
    };

    // Vocabulary terms (static, always available)
    const vocabularyData = [
        {
            title: "Rhetoric",
            url: "/glossary/",
            type: "vocabulary",
            part: "Glossary",
            excerpt: "The art of persuasive speaking and writing.",
            keywords: "persuasion language communication Greek Aristotle"
        },
        {
            title: "Ethos",
            url: "/chapters/part-2/chapter-05-ethos/",
            type: "vocabulary",
            part: "Glossary",
            excerpt: "Appeal based on the credibility and character of the speaker.",
            keywords: "credibility character trust authority speaker"
        },
        {
            title: "Pathos",
            url: "/chapters/part-2/chapter-07-pathos/",
            type: "vocabulary",
            part: "Glossary",
            excerpt: "Appeal to the audience's emotions.",
            keywords: "emotion feeling audience empathy passion"
        },
        {
            title: "Logos",
            url: "/chapters/part-2/chapter-09-logos/",
            type: "vocabulary",
            part: "Glossary",
            excerpt: "Appeal based on logic and reason.",
            keywords: "logic reason evidence proof argument rational"
        },
        {
            title: "Kairos",
            url: "/chapters/part-1/chapter-04-kairos/",
            type: "vocabulary",
            part: "Glossary",
            excerpt: "The opportune moment for speech or action.",
            keywords: "timing opportunity moment context situational"
        },
        {
            title: "Enthymeme",
            url: "/chapters/part-2/chapter-11-argument-structures/",
            type: "vocabulary",
            part: "Glossary",
            excerpt: "A rhetorical syllogism with an implied premise.",
            keywords: "syllogism premise implied assumption argument structure"
        },
        {
            title: "Elenchus",
            url: "/chapters/part-3/chapter-14-the-socratic-method/",
            type: "vocabulary",
            part: "Glossary",
            excerpt: "Socratic method of refutation through questioning.",
            keywords: "Socrates questioning cross-examination refutation dialectic"
        },
        {
            title: "Aporia",
            url: "/chapters/part-3/chapter-14-the-socratic-method/",
            type: "vocabulary",
            part: "Glossary",
            excerpt: "A state of puzzlement or impasse in argument.",
            keywords: "puzzlement impasse confusion doubt Socrates"
        },
        {
            title: "Prolepsis",
            url: "/chapters/part-3/chapter-12-refutation/",
            type: "vocabulary",
            part: "Glossary",
            excerpt: "Anticipating and addressing objections before they're raised.",
            keywords: "anticipate objection preempt counterargument"
        },
        {
            title: "Stasis",
            url: "/glossary/",
            type: "vocabulary",
            part: "Glossary",
            excerpt: "The central point of disagreement in an argument.",
            keywords: "disagreement issue point contention conflict"
        },
        {
            title: "Topos",
            url: "/glossary/",
            type: "vocabulary",
            part: "Glossary",
            excerpt: "A commonplace or standard argument pattern.",
            keywords: "commonplace pattern template strategy topoi"
        }
    ];

    // Load search index from JSON file
    function loadSearchIndex() {
        if (loadPromise) return loadPromise;

        loadPromise = fetch('/search-index.json')
            .then(response => {
                if (!response.ok) throw new Error('Failed to load search index');
                return response.json();
            })
            .then(data => {
                // Transform loaded data to match expected format
                const chapterData = data.map(item => ({
                    title: item.title,
                    url: item.url,
                    type: item.type || 'chapter',
                    part: item.partTitle ? (item.part ? 'Part ' + item.part + ': ' + item.partTitle : item.partTitle) : '',
                    excerpt: item.subtitle || '',
                    keywords: pageKeywords[item.url] || ''
                }));

                // Combine chapter data with vocabulary
                searchData = [...chapterData, ...vocabularyData];
                isLoaded = true;
                hideSearchLoading();
                return searchData;
            })
            .catch(err => {
                console.warn('Search index load failed, using vocabulary only:', err);
                searchData = vocabularyData;
                isLoaded = true;
                hideSearchLoading();
                return searchData;
            });

        return loadPromise;
    }

    function showSearchLoading() {
        if (!results) return;
        results.innerHTML = `
            <div class="search-loading" role="status" aria-live="polite">
                <div class="search-loading-spinner"></div>
                <span>Loading search index...</span>
            </div>
        `;
    }

    function hideSearchLoading() {
        if (!results) return;
        const loader = results.querySelector('.search-loading');
        if (loader) {
            results.innerHTML = `
                <div class="search-empty">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="opacity: 0.4; margin-bottom: 8px;">
                        <circle cx="11" cy="11" r="8"></circle>
                        <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                    </svg>
                    <p>Search chapters, vocabulary, pages & more</p>
                </div>`;
        }
    }

    // ==========================================
    // SEARCH FUNCTIONS
    // ==========================================

    function normalizeText(text) {
        return text.toLowerCase().trim();
    }

    function search(query) {
        if (!query || query.length < 2) {
            return [];
        }

        const normalizedQuery = normalizeText(query);
        const queryWords = normalizedQuery.split(/\s+/);

        return searchData
            .map(item => {
                const normalTitle = normalizeText(item.title);
                const normalExcerpt = normalizeText(item.excerpt);
                const normalPart = item.part ? normalizeText(item.part) : '';
                const normalKeywords = item.keywords ? normalizeText(item.keywords) : '';

                const titleMatch = normalTitle.includes(normalizedQuery);
                const excerptMatch = normalExcerpt.includes(normalizedQuery);
                const partMatch = normalPart.includes(normalizedQuery);
                const keywordMatch = normalKeywords.includes(normalizedQuery);

                // Word-based matching for better relevance
                const wordMatches = queryWords.filter(word =>
                    normalTitle.includes(word) ||
                    normalExcerpt.includes(word) ||
                    normalKeywords.includes(word)
                ).length;

                // Calculate score
                let score = 0;
                if (normalTitle === normalizedQuery) score += 20;
                if (titleMatch) score += 10;
                if (keywordMatch) score += 5;
                if (excerptMatch) score += 3;
                if (partMatch) score += 2;
                score += wordMatches * 2;

                return { ...item, score };
            })
            .filter(item => item.score > 0)
            .sort((a, b) => b.score - a.score)
            .slice(0, 12);
    }

    // ==========================================
    // UI FUNCTIONS
    // ==========================================

    function openSearch() {
        if (!modal) return;

        // Store the element that had focus before opening
        previouslyFocused = document.activeElement;

        modal.classList.add('is-open');
        modal.setAttribute('aria-hidden', 'false');
        document.body.style.overflow = 'hidden';

        // Show loading state if search index not loaded
        if (!isLoaded) {
            showSearchLoading();
            loadSearchIndex();
        }

        // Set up focus trap
        setupFocusTrap();

        setTimeout(() => {
            input.focus();
        }, 100);
    }

    function closeSearch() {
        if (!modal) return;

        modal.classList.remove('is-open');
        modal.setAttribute('aria-hidden', 'true');
        document.body.style.overflow = '';
        input.value = '';
        renderResults([]);

        // Remove focus trap
        removeFocusTrap();

        // Restore focus to previously focused element
        if (previouslyFocused && typeof previouslyFocused.focus === 'function') {
            previouslyFocused.focus();
        }
        previouslyFocused = null;
    }

    function setupFocusTrap() {
        const focusableSelectors = 'input, button, [href], [tabindex]:not([tabindex="-1"])';
        const container = modal.querySelector('.search-container');

        focusTrapHandler = function(e) {
            if (e.key !== 'Tab') return;

            const focusableElements = container.querySelectorAll(focusableSelectors);
            const visibleElements = Array.from(focusableElements).filter(el => {
                return el.offsetParent !== null && !el.disabled;
            });

            if (visibleElements.length === 0) return;

            const firstElement = visibleElements[0];
            const lastElement = visibleElements[visibleElements.length - 1];

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

        modal.addEventListener('keydown', focusTrapHandler);
    }

    function removeFocusTrap() {
        if (focusTrapHandler) {
            modal.removeEventListener('keydown', focusTrapHandler);
            focusTrapHandler = null;
        }
    }

    // Human-readable type labels
    const typeLabels = {
        'chapter': 'Chapter',
        'introduction': 'Introduction',
        'vocabulary': 'Vocabulary',
        'reference': 'Reference',
        'feature': 'Feature',
        'page': 'Page'
    };

    function getTypeLabel(type) {
        return typeLabels[type] || type;
    }

    function renderResults(items) {
        if (!results) return;

        if (items.length === 0) {
            if (input.value.length >= 2) {
                results.innerHTML = `
                    <div class="search-empty search-no-results">
                        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="opacity: 0.3; margin-bottom: 8px;">
                            <circle cx="11" cy="11" r="8"></circle>
                            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                            <line x1="8" y1="8" x2="14" y2="14" stroke-width="2"></line>
                        </svg>
                        <p>No results for "<strong>${escapeHtml(input.value)}</strong>"</p>
                        <p class="search-empty-hint">Try different keywords or browse the table of contents</p>
                    </div>`;
            } else {
                results.innerHTML = `
                    <div class="search-empty">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="opacity: 0.4; margin-bottom: 8px;">
                            <circle cx="11" cy="11" r="8"></circle>
                            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                        </svg>
                        <p>Search chapters, vocabulary, pages & more</p>
                    </div>`;
            }
            return;
        }

        const html = items.map((item, index) => {
            const label = getTypeLabel(item.type);
            return `
            <a href="${item.url}" class="search-result${index === 0 ? ' is-active' : ''}" data-index="${index}">
                <div class="search-result-meta">
                    <span class="search-result-type search-type-${item.type}">${label}</span>
                    ${item.part ? `<span class="search-result-part">${item.part}</span>` : ''}
                </div>
                <span class="search-result-title">${highlightMatch(item.title, input.value)}</span>
                <p class="search-result-excerpt">${highlightMatch(item.excerpt, input.value)}</p>
            </a>`;
        }).join('');

        results.innerHTML = html;
    }

    function escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    function highlightMatch(text, query) {
        if (!query) return text;

        const regex = new RegExp(`(${escapeRegex(query)})`, 'gi');
        return text.replace(regex, '<mark>$1</mark>');
    }

    function escapeRegex(str) {
        return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    function navigateResults(direction) {
        const resultElements = results.querySelectorAll('.search-result');
        if (!resultElements.length) return;

        const currentActive = results.querySelector('.search-result.is-active');
        let currentIndex = currentActive ? parseInt(currentActive.dataset.index) : -1;

        // Remove current active
        if (currentActive) {
            currentActive.classList.remove('is-active');
        }

        // Calculate new index
        if (direction === 'down') {
            currentIndex = currentIndex < resultElements.length - 1 ? currentIndex + 1 : 0;
        } else {
            currentIndex = currentIndex > 0 ? currentIndex - 1 : resultElements.length - 1;
        }

        // Set new active
        const newActive = resultElements[currentIndex];
        if (newActive) {
            newActive.classList.add('is-active');
            newActive.scrollIntoView({ block: 'nearest' });
        }
    }

    function selectResult() {
        const activeResult = results.querySelector('.search-result.is-active');
        if (activeResult) {
            window.location.href = activeResult.href;
        }
    }

    // ==========================================
    // EVENT HANDLERS
    // ==========================================

    function handleInput(e) {
        const query = e.target.value;
        const searchResults = search(query);
        renderResults(searchResults);
    }

    function handleKeydown(e) {
        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                navigateResults('down');
                break;
            case 'ArrowUp':
                e.preventDefault();
                navigateResults('up');
                break;
            case 'Enter':
                e.preventDefault();
                selectResult();
                break;
            case 'Escape':
                e.preventDefault();
                closeSearch();
                break;
        }
    }

    function handleGlobalKeydown(e) {
        // Open search with / key (when not in input)
        if (e.key === '/' && !e.target.matches('input, textarea')) {
            e.preventDefault();
            openSearch();
        }

        // Also support Ctrl/Cmd + K
        if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
            e.preventDefault();
            openSearch();
        }
    }

    // ==========================================
    // INITIALIZATION
    // ==========================================

    function init() {
        modal = document.getElementById('search-modal');
        if (!modal) return;

        input = document.getElementById('search-input');
        results = document.getElementById('search-results');
        backdrop = modal.querySelector('.search-backdrop');
        closeBtn = modal.querySelector('.search-close');

        // Preload search index for faster first search
        loadSearchIndex();

        // Search trigger button in header (if exists)
        const searchTrigger = document.getElementById('search-trigger');
        if (searchTrigger) {
            searchTrigger.addEventListener('click', openSearch);
        }

        // Mobile search trigger
        const mobileSearchTrigger = document.getElementById('mobile-search-trigger');
        if (mobileSearchTrigger) {
            mobileSearchTrigger.addEventListener('click', function() {
                // Close mobile nav first
                const mobileNav = document.querySelector('.mobile-nav');
                const menuBtn = document.querySelector('.mobile-menu-btn');
                const overlay = document.querySelector('.mobile-nav-overlay');
                if (mobileNav && mobileNav.classList.contains('is-active')) {
                    menuBtn.classList.remove('is-active');
                    menuBtn.setAttribute('aria-expanded', 'false');
                    overlay.classList.remove('is-active');
                    overlay.setAttribute('aria-hidden', 'true');
                    mobileNav.classList.remove('is-active');
                    mobileNav.setAttribute('aria-hidden', 'true');
                    document.body.classList.remove('mobile-nav-open');
                }
                // Then open search
                setTimeout(openSearch, 100);
            });
        }

        // Input events
        input.addEventListener('input', handleInput);
        input.addEventListener('keydown', handleKeydown);

        // Close events
        backdrop.addEventListener('click', closeSearch);
        closeBtn.addEventListener('click', closeSearch);

        // Global keyboard shortcut
        document.addEventListener('keydown', handleGlobalKeydown);

        // Result click (for mouse users)
        results.addEventListener('click', function(e) {
            const result = e.target.closest('.search-result');
            if (result) {
                // Let the link work naturally
            }
        });

        // Hover to highlight
        results.addEventListener('mouseover', function(e) {
            const result = e.target.closest('.search-result');
            if (result) {
                results.querySelectorAll('.search-result').forEach(r => r.classList.remove('is-active'));
                result.classList.add('is-active');
            }
        });

        // Expose toggleSearch for external use (e.g., 404 page)
        window.toggleSearch = function() {
            if (modal.classList.contains('is-open')) {
                closeSearch();
            } else {
                openSearch();
            }
        };
    }

    // Run when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();

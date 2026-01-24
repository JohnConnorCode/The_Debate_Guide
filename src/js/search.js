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

    // ==========================================
    // SEARCH INDEX LOADING
    // ==========================================

    // Vocabulary terms (static, always available)
    const vocabularyData = [
        {
            title: "Rhetoric",
            url: "/glossary/",
            type: "vocabulary",
            part: "Glossary",
            excerpt: "The art of persuasive speaking and writing."
        },
        {
            title: "Ethos",
            url: "/chapters/part-2/chapter-05-ethos/",
            type: "vocabulary",
            part: "Glossary",
            excerpt: "Appeal based on the credibility and character of the speaker."
        },
        {
            title: "Pathos",
            url: "/chapters/part-2/chapter-07-pathos/",
            type: "vocabulary",
            part: "Glossary",
            excerpt: "Appeal to the audience's emotions."
        },
        {
            title: "Logos",
            url: "/chapters/part-2/chapter-09-logos/",
            type: "vocabulary",
            part: "Glossary",
            excerpt: "Appeal based on logic and reason."
        },
        {
            title: "Kairos",
            url: "/chapters/part-1/chapter-04-kairos/",
            type: "vocabulary",
            part: "Glossary",
            excerpt: "The opportune moment for speech or action."
        },
        {
            title: "Enthymeme",
            url: "/chapters/part-2/chapter-11-argument-structures/",
            type: "vocabulary",
            part: "Glossary",
            excerpt: "A rhetorical syllogism with an implied premise."
        },
        {
            title: "Elenchus",
            url: "/chapters/part-3/chapter-14-the-socratic-method/",
            type: "vocabulary",
            part: "Glossary",
            excerpt: "Socratic method of refutation through questioning."
        },
        {
            title: "Aporia",
            url: "/chapters/part-3/chapter-14-the-socratic-method/",
            type: "vocabulary",
            part: "Glossary",
            excerpt: "A state of puzzlement or impasse in argument."
        },
        {
            title: "Prolepsis",
            url: "/chapters/part-3/chapter-12-refutation/",
            type: "vocabulary",
            part: "Glossary",
            excerpt: "Anticipating and addressing objections before they're raised."
        },
        {
            title: "Stasis",
            url: "/glossary/",
            type: "vocabulary",
            part: "Glossary",
            excerpt: "The central point of disagreement in an argument."
        },
        {
            title: "Topos",
            url: "/glossary/",
            type: "vocabulary",
            part: "Glossary",
            excerpt: "A commonplace or standard argument pattern."
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
                    part: item.partTitle ? 'Part ' + item.part + ': ' + item.partTitle : item.partTitle,
                    excerpt: item.subtitle || ''
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
            results.innerHTML = '<div class="search-empty"><p>Start typing to search...</p></div>';
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
                const titleMatch = normalizeText(item.title).includes(normalizedQuery);
                const excerptMatch = normalizeText(item.excerpt).includes(normalizedQuery);
                const partMatch = item.part && normalizeText(item.part).includes(normalizedQuery);

                // Word-based matching for better relevance
                const wordMatches = queryWords.filter(word =>
                    normalizeText(item.title).includes(word) ||
                    normalizeText(item.excerpt).includes(word)
                ).length;

                // Calculate score
                let score = 0;
                if (titleMatch) score += 10;
                if (excerptMatch) score += 3;
                if (partMatch) score += 2;
                score += wordMatches * 2;

                // Exact title match gets highest priority
                if (normalizeText(item.title) === normalizedQuery) {
                    score += 20;
                }

                return { ...item, score };
            })
            .filter(item => item.score > 0)
            .sort((a, b) => b.score - a.score)
            .slice(0, 10);
    }

    // ==========================================
    // UI FUNCTIONS
    // ==========================================

    function openSearch() {
        if (!modal) return;

        modal.classList.add('is-open');
        modal.setAttribute('aria-hidden', 'false');
        document.body.style.overflow = 'hidden';

        // Show loading state if search index not loaded
        if (!isLoaded) {
            showSearchLoading();
            loadSearchIndex();
        }

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
    }

    function renderResults(items) {
        if (!results) return;

        if (items.length === 0) {
            if (input.value.length >= 2) {
                results.innerHTML = '<div class="search-empty"><p>No results found</p></div>';
            } else {
                results.innerHTML = '<div class="search-empty"><p>Start typing to search...</p></div>';
            }
            return;
        }

        const html = items.map((item, index) => `
            <a href="${item.url}" class="search-result${index === 0 ? ' is-active' : ''}" data-index="${index}">
                <span class="search-result-type">${item.type}</span>
                <span class="search-result-title">${highlightMatch(item.title, input.value)}</span>
                ${item.part ? `<span class="search-result-part">${item.part}</span>` : ''}
                <p class="search-result-excerpt">${highlightMatch(item.excerpt, input.value)}</p>
            </a>
        `).join('');

        results.innerHTML = html;
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

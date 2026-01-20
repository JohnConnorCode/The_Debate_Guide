/**
 * The Debate Guide - Client-Side Search
 *
 * Simple search implementation that indexes chapters and vocabulary.
 * For larger sites, consider Pagefind or Lunr.js.
 */

(function() {
    'use strict';

    // Search index - populated from chapters
    let searchIndex = [];
    let isIndexed = false;

    // DOM elements
    let modal, input, results, backdrop, closeBtn;

    // ==========================================
    // SEARCH INDEX BUILDING
    // ==========================================

    // Static search data - built from chapters at build time
    // This will be populated by Eleventy during build
    const searchData = [
        {
            title: "Introduction: The Lost Art",
            url: "/introduction/",
            type: "chapter",
            part: "Introduction",
            excerpt: "Master the ancient art of persuasion that built democracies, swayed empires, and shaped the modern world."
        },
        {
            title: "Why Debate Matters",
            url: "/chapters/part-1/chapter-01-why-debate-matters/",
            type: "chapter",
            part: "Part I: Foundations",
            excerpt: "The first skill of civilization. Understanding why structured argument shapes clear thinking."
        },
        {
            title: "The Greek Inheritance",
            url: "/chapters/part-1/chapter-02-the-greek-inheritance/",
            type: "chapter",
            part: "Part I: Foundations",
            excerpt: "The 2,500-year-old toolkit for persuasion, developed in ancient Athens."
        },
        {
            title: "The Rhetoric Triangle",
            url: "/chapters/part-1/chapter-03-the-rhetoric-triangle/",
            type: "chapter",
            part: "Part I: Foundations",
            excerpt: "Ethos, pathos, logos - the three pillars of persuasive speech."
        },
        {
            title: "Kairos: The Right Moment",
            url: "/chapters/part-1/chapter-04-kairos/",
            type: "chapter",
            part: "Part I: Foundations",
            excerpt: "Timing is everything. Learning to seize the opportune moment."
        },
        {
            title: "Ethos: The Art of Credibility",
            url: "/chapters/part-2/chapter-05-ethos/",
            type: "chapter",
            part: "Part II: The Three Appeals",
            excerpt: "Building trust and authority through character and competence."
        },
        {
            title: "Building Your Ethos",
            url: "/chapters/part-2/chapter-06-building-ethos/",
            type: "chapter",
            part: "Part II: The Three Appeals",
            excerpt: "Practical techniques for establishing credibility before you speak."
        },
        {
            title: "Pathos: Emotional Connection",
            url: "/chapters/part-2/chapter-07-pathos/",
            type: "chapter",
            part: "Part II: The Three Appeals",
            excerpt: "Moving hearts as well as minds through emotional resonance."
        },
        {
            title: "The Ethical Use of Emotion",
            url: "/chapters/part-2/chapter-08-ethical-emotion/",
            type: "chapter",
            part: "Part II: The Three Appeals",
            excerpt: "When emotional appeals illuminate versus when they manipulate."
        },
        {
            title: "Logos: The Power of Reason",
            url: "/chapters/part-2/chapter-09-logos/",
            type: "chapter",
            part: "Part II: The Three Appeals",
            excerpt: "Constructing logical arguments that withstand scrutiny."
        },
        {
            title: "Evidence and Examples",
            url: "/chapters/part-2/chapter-10-evidence/",
            type: "chapter",
            part: "Part II: The Three Appeals",
            excerpt: "Finding and presenting proof that supports your claims."
        },
        {
            title: "Argument Structures",
            url: "/chapters/part-2/chapter-11-argument-structures/",
            type: "chapter",
            part: "Part II: The Three Appeals",
            excerpt: "Organizing reasoning for maximum impact and clarity."
        },
        {
            title: "Refutation",
            url: "/chapters/part-3/chapter-12-refutation/",
            type: "chapter",
            part: "Part III: Advanced Techniques",
            excerpt: "Dismantling opposing arguments while maintaining respect."
        },
        {
            title: "Logical Fallacies",
            url: "/chapters/part-3/chapter-13-fallacies/",
            type: "chapter",
            part: "Part III: Advanced Techniques",
            excerpt: "Recognizing and avoiding flawed reasoning patterns."
        },
        {
            title: "The Socratic Method",
            url: "/chapters/part-3/chapter-14-the-socratic-method/",
            type: "chapter",
            part: "Part III: Advanced Techniques",
            excerpt: "The art of questioning that reveals truth through dialogue."
        },
        {
            title: "Steelmanning",
            url: "/chapters/part-3/chapter-15-steelmanning/",
            type: "chapter",
            part: "Part III: Advanced Techniques",
            excerpt: "Strengthening opposing arguments to strengthen your own."
        },
        {
            title: "Concession and Pivot",
            url: "/chapters/part-3/chapter-16-concession/",
            type: "chapter",
            part: "Part III: Advanced Techniques",
            excerpt: "Strategic agreement as a path to stronger positions."
        },
        {
            title: "The Classroom Debate",
            url: "/chapters/part-4/chapter-17-classroom/",
            type: "chapter",
            part: "Part IV: Practical Application",
            excerpt: "Applying rhetorical skills in academic settings."
        },
        {
            title: "Digital Discourse",
            url: "/chapters/part-4/chapter-18-digital/",
            type: "chapter",
            part: "Part IV: Practical Application",
            excerpt: "Rhetoric in the age of social media and online discussion."
        },
        {
            title: "Public Speaking",
            url: "/chapters/part-4/chapter-19-public-speaking/",
            type: "chapter",
            part: "Part IV: Practical Application",
            excerpt: "From prepared speeches to impromptu addresses."
        },
        {
            title: "The Philosopher's Victory",
            url: "/chapters/part-4/chapter-20-victory/",
            type: "chapter",
            part: "Part IV: Practical Application",
            excerpt: "Winning arguments while winning minds - the ultimate goal."
        },
        // Vocabulary terms
        {
            title: "Rhetoric",
            url: "/chapters/part-1/chapter-03-the-rhetoric-triangle/",
            type: "vocabulary",
            excerpt: "The art of persuasive speaking and writing."
        },
        {
            title: "Ethos",
            url: "/chapters/part-2/chapter-05-ethos/",
            type: "vocabulary",
            excerpt: "Appeal based on the credibility and character of the speaker."
        },
        {
            title: "Pathos",
            url: "/chapters/part-2/chapter-07-pathos/",
            type: "vocabulary",
            excerpt: "Appeal to the audience's emotions."
        },
        {
            title: "Logos",
            url: "/chapters/part-2/chapter-09-logos/",
            type: "vocabulary",
            excerpt: "Appeal based on logic and reason."
        },
        {
            title: "Kairos",
            url: "/chapters/part-1/chapter-04-kairos/",
            type: "vocabulary",
            excerpt: "The opportune moment for speech or action."
        },
        {
            title: "Enthymeme",
            url: "/chapters/part-2/chapter-11-argument-structures/",
            type: "vocabulary",
            excerpt: "A rhetorical syllogism with an implied premise."
        },
        {
            title: "Elenchus",
            url: "/chapters/part-3/chapter-14-the-socratic-method/",
            type: "vocabulary",
            excerpt: "Socratic method of refutation through questioning."
        },
        {
            title: "Aporia",
            url: "/chapters/part-3/chapter-14-the-socratic-method/",
            type: "vocabulary",
            excerpt: "A state of puzzlement or impasse in argument."
        },
        {
            title: "Prolepsis",
            url: "/chapters/part-3/chapter-12-refutation/",
            type: "vocabulary",
            excerpt: "Anticipating and addressing objections before they're raised."
        }
    ];

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

        // Search trigger button in header (if exists)
        const searchTrigger = document.getElementById('search-trigger');
        if (searchTrigger) {
            searchTrigger.addEventListener('click', openSearch);
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
    }

    // Run when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();

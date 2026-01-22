/**
 * Chapter Illustrations
 * Interactive Art Deco visualizations for each chapter
 */

(function() {
    'use strict';

    // Check for reduced motion preference
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // Configuration for each chapter's illustration
    const chapterConfigs = {
        '01': {
            name: 'Voice Waves',
            create: createVoiceWaves
        },
        '02': {
            name: 'Temple Columns',
            create: createTempleColumns
        },
        '03': {
            name: 'Rhetorical Triangle',
            create: createRhetoricalTriangle
        },
        '04': {
            name: 'Moment Clock',
            create: createMomentClock
        },
        '05': {
            name: 'Trust Shield',
            create: createTrustShield
        },
        '06': {
            name: 'Character Path',
            create: createCharacterPath
        },
        '07': {
            name: 'Heart Ripples',
            create: createHeartRipples
        },
        '08': {
            name: 'Emotions Grid',
            create: createEmotionsGrid
        },
        '09': {
            name: 'Logic Chain',
            create: createLogicChain
        },
        '10': {
            name: 'Balance Scales',
            create: createBalanceScales
        },
        '11': {
            name: 'Rising Blocks',
            create: createRisingBlocks
        },
        '12': {
            name: 'Crossing Swords',
            create: createCrossingSwords
        },
        '13': {
            name: 'Cracking Ice',
            create: createCrackingIce
        },
        '14': {
            name: 'Question Cascade',
            create: createQuestionCascade
        },
        '15': {
            name: 'Forge & Anvil',
            create: createForgeAnvil
        },
        '16': {
            name: 'Conference Table',
            create: createConferenceTable
        },
        '17': {
            name: 'Chalkboard',
            create: createChalkboard
        },
        '18': {
            name: 'Network Nodes',
            create: createNetworkNodes
        },
        '19': {
            name: 'Voting Columns',
            create: createVotingColumns
        },
        '20': {
            name: 'Laurel Crown',
            create: createLaurelCrown
        }
    };

    // Initialize on DOM ready
    document.addEventListener('DOMContentLoaded', function() {
        initializeIllustrations();
    });

    /**
     * Main initialization function
     */
    function initializeIllustrations() {
        const placeholders = document.querySelectorAll('.image-placeholder[data-chapter]');

        placeholders.forEach(function(placeholder) {
            const chapter = placeholder.dataset.chapter;
            const config = chapterConfigs[chapter];

            if (config && config.create) {
                config.create(placeholder);

                // Set up intersection observer for scroll-triggered animations
                if (!prefersReducedMotion) {
                    setupScrollTrigger(placeholder);
                }
            }
        });
    }

    /**
     * Set up intersection observer for scroll-triggered animations
     */
    function setupScrollTrigger(element) {
        const observer = new IntersectionObserver(function(entries) {
            entries.forEach(function(entry) {
                if (entry.isIntersecting) {
                    entry.target.classList.add('is-visible');
                }
            });
        }, {
            threshold: 0.3
        });

        observer.observe(element);
    }

    // ==========================================
    // CHAPTER CREATION FUNCTIONS
    // ==========================================

    /**
     * Chapter 01: Voice Waves
     */
    function createVoiceWaves(container) {
        const wrapper = document.createElement('div');
        wrapper.className = 'ch01-waves';

        // Create expanding wave rings
        for (let i = 0; i < 8; i++) {
            const wave = document.createElement('div');
            wave.className = 'ch01-wave';
            wrapper.appendChild(wave);
        }

        // Create central speaker
        const speaker = document.createElement('div');
        speaker.className = 'ch01-speaker';
        wrapper.appendChild(speaker);

        container.appendChild(wrapper);
    }

    /**
     * Chapter 02: Temple Columns
     */
    function createTempleColumns(container) {
        const temple = document.createElement('div');
        temple.className = 'ch02-temple';

        // Three columns
        for (let i = 0; i < 3; i++) {
            const column = document.createElement('div');
            column.className = 'ch02-column';
            temple.appendChild(column);
        }

        // Floating particles
        const particles = document.createElement('div');
        particles.className = 'ch02-particles';
        for (let i = 0; i < 5; i++) {
            const particle = document.createElement('div');
            particle.className = 'ch02-particle';
            particles.appendChild(particle);
        }

        container.appendChild(particles);
        container.appendChild(temple);
    }

    /**
     * Chapter 03: Rhetorical Triangle
     */
    function createRhetoricalTriangle(container) {
        const triangleContainer = document.createElement('div');
        triangleContainer.className = 'ch03-triangle-container';

        const triangle = document.createElement('div');
        triangle.className = 'ch03-triangle';

        // Triangle edges (3 sides)
        for (let i = 0; i < 3; i++) {
            const edge = document.createElement('div');
            edge.className = 'ch03-edge';
            triangle.appendChild(edge);
        }

        // Vertex dots (at the 3 corners)
        for (let i = 0; i < 3; i++) {
            const dot = document.createElement('div');
            dot.className = 'ch03-vertex-dot';
            triangle.appendChild(dot);
        }

        // Vertex labels
        const labels = [
            { class: 'ch03-label--ethos', text: 'Ethos' },
            { class: 'ch03-label--pathos', text: 'Pathos' },
            { class: 'ch03-label--logos', text: 'Logos' }
        ];

        labels.forEach(function(l) {
            const label = document.createElement('span');
            label.className = 'ch03-label ' + l.class;
            label.textContent = l.text;
            triangle.appendChild(label);
        });

        triangleContainer.appendChild(triangle);
        container.appendChild(triangleContainer);
    }

    /**
     * Chapter 04: Moment Clock (Kairos)
     */
    function createMomentClock(container) {
        const clock = document.createElement('div');
        clock.className = 'ch04-clock';

        const face = document.createElement('div');
        face.className = 'ch04-face';

        // Hour markers
        for (let i = 0; i < 12; i++) {
            const marker = document.createElement('div');
            marker.className = 'ch04-marker';
            face.appendChild(marker);
        }

        // Sweet spot
        const sweetSpot = document.createElement('div');
        sweetSpot.className = 'ch04-sweet-spot';
        face.appendChild(sweetSpot);

        // Main hand
        const hand = document.createElement('div');
        hand.className = 'ch04-hand';
        face.appendChild(hand);

        // Trailing afterimages
        for (let i = 0; i < 3; i++) {
            const trail = document.createElement('div');
            trail.className = 'ch04-trail';
            face.appendChild(trail);
        }

        // Center dot
        const center = document.createElement('div');
        center.className = 'ch04-center';
        face.appendChild(center);

        clock.appendChild(face);
        container.appendChild(clock);
    }

    /**
     * Chapter 05: Trust Shield (Ethos)
     */
    function createTrustShield(container) {
        const shieldContainer = document.createElement('div');
        shieldContainer.className = 'ch05-shield-container';

        // Radiating rings (behind shield)
        for (let i = 0; i < 4; i++) {
            const ring = document.createElement('div');
            ring.className = 'ch05-ring';
            shieldContainer.appendChild(ring);
        }

        // Shield
        const shield = document.createElement('div');
        shield.className = 'ch05-shield';

        // Greek letter Eta
        const eta = document.createElement('span');
        eta.className = 'ch05-eta';
        eta.textContent = 'H';
        shield.appendChild(eta);

        shieldContainer.appendChild(shield);
        container.appendChild(shieldContainer);
    }

    /**
     * Chapter 06: Character Path
     */
    function createCharacterPath(container) {
        const pathContainer = document.createElement('div');
        pathContainer.className = 'ch06-path-container';

        // Footprints
        for (let i = 0; i < 7; i++) {
            const footprint = document.createElement('div');
            footprint.className = 'ch06-footprint';
            pathContainer.appendChild(footprint);
        }

        // Destination glow
        const destination = document.createElement('div');
        destination.className = 'ch06-destination';
        pathContainer.appendChild(destination);

        container.appendChild(pathContainer);
    }

    /**
     * Chapter 07: Heart Ripples (Pathos)
     */
    function createHeartRipples(container) {
        const heartContainer = document.createElement('div');
        heartContainer.className = 'ch07-heart-container';

        // Ripples (behind heart)
        for (let i = 0; i < 5; i++) {
            const ripple = document.createElement('div');
            ripple.className = 'ch07-ripple';
            heartContainer.appendChild(ripple);
        }

        // Central heart
        const heart = document.createElement('div');
        heart.className = 'ch07-heart';
        heartContainer.appendChild(heart);

        container.appendChild(heartContainer);
    }

    /**
     * Chapter 08: Emotions Grid
     */
    function createEmotionsGrid(container) {
        const grid = document.createElement('div');
        grid.className = 'ch08-grid';

        const emotions = [
            'anger', 'fear', 'joy',
            'sadness', 'disgust', 'surprise',
            'trust', 'anticipation', 'contempt'
        ];

        emotions.forEach(function(emotion) {
            const cell = document.createElement('div');
            cell.className = 'ch08-cell';
            cell.dataset.emotion = emotion;
            grid.appendChild(cell);
        });

        container.appendChild(grid);
    }

    /**
     * Chapter 09: Logic Chain (Logos)
     */
    function createLogicChain(container) {
        const chain = document.createElement('div');
        chain.className = 'ch09-chain';

        const labels = ['A', 'B', 'C'];

        labels.forEach(function(label, index) {
            // Add connector before node (except first)
            if (index > 0) {
                const connector = document.createElement('div');
                connector.className = 'ch09-connector';
                chain.appendChild(connector);
            }

            // Node
            const node = document.createElement('div');
            node.className = 'ch09-node';

            const nodeLabel = document.createElement('span');
            nodeLabel.className = 'ch09-node-label';
            nodeLabel.textContent = label;
            node.appendChild(nodeLabel);

            chain.appendChild(node);
        });

        container.appendChild(chain);
    }

    /**
     * Chapter 10: Balance Scales
     */
    function createBalanceScales(container) {
        const scales = document.createElement('div');
        scales.className = 'ch10-scales';

        // Pillar
        const pillar = document.createElement('div');
        pillar.className = 'ch10-pillar';
        scales.appendChild(pillar);

        // Beam
        const beam = document.createElement('div');
        beam.className = 'ch10-beam';
        scales.appendChild(beam);

        // Chains
        const chainLeft = document.createElement('div');
        chainLeft.className = 'ch10-chain ch10-chain-left';
        scales.appendChild(chainLeft);

        const chainRight = document.createElement('div');
        chainRight.className = 'ch10-chain ch10-chain-right';
        scales.appendChild(chainRight);

        // Pans
        const panLeft = document.createElement('div');
        panLeft.className = 'ch10-pan ch10-pan-left';
        scales.appendChild(panLeft);

        const panRight = document.createElement('div');
        panRight.className = 'ch10-pan ch10-pan-right';
        scales.appendChild(panRight);

        // Evidence particles
        for (let i = 0; i < 3; i++) {
            const evidence = document.createElement('div');
            evidence.className = 'ch10-evidence';
            scales.appendChild(evidence);
        }

        container.appendChild(scales);
    }

    /**
     * Chapter 11: Rising Blocks
     */
    function createRisingBlocks(container) {
        const blocks = document.createElement('div');
        blocks.className = 'ch11-blocks';

        // Create stack of blocks
        for (let i = 0; i < 6; i++) {
            const block = document.createElement('div');
            block.className = 'ch11-block';
            block.style.setProperty('--delay', i * 0.15 + 's');
            blocks.appendChild(block);
        }

        container.appendChild(blocks);
    }

    /**
     * Chapter 12: Crossing Swords
     */
    function createCrossingSwords(container) {
        const arena = document.createElement('div');
        arena.className = 'ch12-arena';

        // Left sword
        const swordLeft = document.createElement('div');
        swordLeft.className = 'ch12-sword ch12-sword-left';
        arena.appendChild(swordLeft);

        // Right sword
        const swordRight = document.createElement('div');
        swordRight.className = 'ch12-sword ch12-sword-right';
        arena.appendChild(swordRight);

        // Sparks container
        const sparks = document.createElement('div');
        sparks.className = 'ch12-sparks';
        for (let i = 0; i < 8; i++) {
            const spark = document.createElement('div');
            spark.className = 'ch12-spark';
            sparks.appendChild(spark);
        }
        arena.appendChild(sparks);

        container.appendChild(arena);
    }

    /**
     * Chapter 13: Cracking Ice
     */
    function createCrackingIce(container) {
        const ice = document.createElement('div');
        ice.className = 'ch13-ice';

        // Create crack lines
        for (let i = 0; i < 5; i++) {
            const crack = document.createElement('div');
            crack.className = 'ch13-crack';
            crack.style.setProperty('--delay', i * 0.3 + 's');
            ice.appendChild(crack);
        }

        // Danger zones
        for (let i = 0; i < 3; i++) {
            const zone = document.createElement('div');
            zone.className = 'ch13-danger-zone';
            ice.appendChild(zone);
        }

        container.appendChild(ice);
    }

    /**
     * Chapter 14: Question Cascade
     */
    function createQuestionCascade(container) {
        const cascade = document.createElement('div');
        cascade.className = 'ch14-cascade';

        // Create falling question marks
        for (let i = 0; i < 12; i++) {
            const question = document.createElement('div');
            question.className = 'ch14-question';
            question.textContent = '?';
            question.style.setProperty('--delay', (i * 0.25) + 's');
            question.style.setProperty('--x', (Math.random() * 80 + 10) + '%');
            cascade.appendChild(question);
        }

        container.appendChild(cascade);
    }

    /**
     * Chapter 15: Forge & Anvil
     */
    function createForgeAnvil(container) {
        const forge = document.createElement('div');
        forge.className = 'ch15-forge';

        // Anvil
        const anvil = document.createElement('div');
        anvil.className = 'ch15-anvil';
        forge.appendChild(anvil);

        // Metal piece being forged
        const metal = document.createElement('div');
        metal.className = 'ch15-metal';
        forge.appendChild(metal);

        // Hammer
        const hammer = document.createElement('div');
        hammer.className = 'ch15-hammer';
        forge.appendChild(hammer);

        // Sparks
        const sparks = document.createElement('div');
        sparks.className = 'ch15-sparks';
        for (let i = 0; i < 10; i++) {
            const spark = document.createElement('div');
            spark.className = 'ch15-spark';
            sparks.appendChild(spark);
        }
        forge.appendChild(sparks);

        container.appendChild(forge);
    }

    /**
     * Chapter 16: Conference Table
     */
    function createConferenceTable(container) {
        const room = document.createElement('div');
        room.className = 'ch16-room';

        // Table
        const table = document.createElement('div');
        table.className = 'ch16-table';
        room.appendChild(table);

        // Seats around table
        const positions = 6;
        for (let i = 0; i < positions; i++) {
            const seat = document.createElement('div');
            seat.className = 'ch16-seat';
            seat.style.setProperty('--angle', (i * 360 / positions) + 'deg');

            // Speech indicator
            const speech = document.createElement('div');
            speech.className = 'ch16-speech';
            seat.appendChild(speech);

            room.appendChild(seat);
        }

        container.appendChild(room);
    }

    /**
     * Chapter 17: Chalkboard
     */
    function createChalkboard(container) {
        const board = document.createElement('div');
        board.className = 'ch17-board';

        // Chalk marks/equations
        const lines = ['E = mc', 'Q.E.D.', '∴', 'A → B'];
        lines.forEach(function(text, i) {
            const line = document.createElement('div');
            line.className = 'ch17-chalk-line';
            line.textContent = text;
            line.style.setProperty('--delay', i * 0.5 + 's');
            board.appendChild(line);
        });

        // Eraser
        const eraser = document.createElement('div');
        eraser.className = 'ch17-eraser';
        board.appendChild(eraser);

        container.appendChild(board);
    }

    /**
     * Chapter 18: Network Nodes
     */
    function createNetworkNodes(container) {
        const network = document.createElement('div');
        network.className = 'ch18-network';

        // Create nodes (connections rendered via CSS pseudo-elements)
        for (let i = 0; i < 7; i++) {
            const node = document.createElement('div');
            node.className = 'ch18-node';
            network.appendChild(node);
        }

        // Data packets traveling between nodes
        for (let i = 0; i < 3; i++) {
            const packet = document.createElement('div');
            packet.className = 'ch18-packet';
            packet.style.setProperty('--delay', i * 1 + 's');
            network.appendChild(packet);
        }

        container.appendChild(network);
    }

    /**
     * Chapter 19: Voting Columns
     */
    function createVotingColumns(container) {
        const chart = document.createElement('div');
        chart.className = 'ch19-chart';

        // Rising pillars
        const heights = [60, 85, 45, 70, 90];
        heights.forEach(function(height, i) {
            const pillar = document.createElement('div');
            pillar.className = 'ch19-pillar';
            pillar.style.setProperty('--height', height + '%');
            pillar.style.setProperty('--delay', i * 0.2 + 's');
            chart.appendChild(pillar);
        });

        // Floating ballot symbols
        for (let i = 0; i < 5; i++) {
            const ballot = document.createElement('div');
            ballot.className = 'ch19-ballot';
            ballot.textContent = '✓';
            ballot.style.setProperty('--delay', i * 0.4 + 's');
            chart.appendChild(ballot);
        }

        container.appendChild(chart);
    }

    /**
     * Chapter 20: Laurel Crown
     */
    function createLaurelCrown(container) {
        const crown = document.createElement('div');
        crown.className = 'ch20-crown';

        // Left laurel branch
        const leftBranch = document.createElement('div');
        leftBranch.className = 'ch20-branch ch20-branch-left';
        for (let i = 0; i < 6; i++) {
            const leaf = document.createElement('div');
            leaf.className = 'ch20-leaf';
            leaf.style.setProperty('--index', i);
            leftBranch.appendChild(leaf);
        }
        crown.appendChild(leftBranch);

        // Right laurel branch
        const rightBranch = document.createElement('div');
        rightBranch.className = 'ch20-branch ch20-branch-right';
        for (let i = 0; i < 6; i++) {
            const leaf = document.createElement('div');
            leaf.className = 'ch20-leaf';
            leaf.style.setProperty('--index', i);
            rightBranch.appendChild(leaf);
        }
        crown.appendChild(rightBranch);

        // Owl in center
        const owl = document.createElement('div');
        owl.className = 'ch20-owl';

        // Owl eyes
        const eyeLeft = document.createElement('div');
        eyeLeft.className = 'ch20-eye ch20-eye-left';
        owl.appendChild(eyeLeft);

        const eyeRight = document.createElement('div');
        eyeRight.className = 'ch20-eye ch20-eye-right';
        owl.appendChild(eyeRight);

        crown.appendChild(owl);

        container.appendChild(crown);
    }

})();

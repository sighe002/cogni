/* Computer opponent. Stateless: decides from the public knowledge grid only (it never peeks at ship positions). */
(function (root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory(require('./engine.js'));
    } else {
        root.BattleshipAI = factory(root.BattleshipEngine);
    }
})(typeof self !== 'undefined' ? self : this, function (Engine) {
    'use strict';

    const N = Engine.BOARD_SIZE;
    const DIRS = [[-1, 0], [1, 0], [0, -1], [0, 1]];

    const DIFFICULTIES = Object.freeze({
        beginner: 'Beginner',
        veteran: 'Veteran',
        admiral: 'Admiral'
    });

    function pick(list, rng) {
        return list[Math.floor(rng() * list.length)];
    }

    function unshotCells(grid) {
        const cells = [];
        for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) if (grid[r][c] === null) cells.push([r, c]);
        return cells;
    }

    function isOpen(grid, r, c) {
        return Engine.inBounds(r, c) && grid[r][c] === null;
    }

    function openHits(grid) {
        const hits = [];
        for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) if (grid[r][c] === 'hit') hits.push([r, c]);
        return hits;
    }

    /** Hunt/target: extend lines of hits first, then any neighbour of a hit. */
    function targetCandidates(grid) {
        const hits = openHits(grid);
        const line = new Set();
        const adjacent = new Set();
        for (const [r, c] of hits) {
            for (const [dr, dc] of DIRS) {
                if (isOpen(grid, r + dr, c + dc)) adjacent.add((r + dr) * N + (c + dc));
                if (Engine.inBounds(r - dr, c - dc) && grid[r - dr][c - dc] === 'hit') {
                    let k = 1;
                    while (Engine.inBounds(r + dr * k, c + dc * k) && grid[r + dr * k][c + dc * k] === 'hit') k++;
                    if (isOpen(grid, r + dr * k, c + dc * k)) line.add((r + dr * k) * N + (c + dc * k));
                }
            }
        }
        const chosen = line.size ? line : adjacent;
        return [...chosen].map(k => [Math.floor(k / N), k % N]);
    }

    /** Count, for every open cell, how many legal placements of the remaining ships cover it. */
    function probabilityMap(grid, remaining) {
        const density = Array.from({ length: N }, () => Array(N).fill(0));
        const targeting = openHits(grid).length > 0;
        for (const size of remaining) {
            for (const horizontal of [true, false]) {
                for (let r = 0; r < N; r++) {
                    for (let c = 0; c < N; c++) {
                        const cells = Engine.shipCells(r, c, size, horizontal);
                        let hits = 0;
                        let legal = true;
                        for (const [cr, cc] of cells) {
                            if (!Engine.inBounds(cr, cc)) { legal = false; break; }
                            const v = grid[cr][cc];
                            if (v === 'miss' || v === 'sunk') { legal = false; break; }
                            if (v === 'hit') hits++;
                        }
                        if (!legal || (targeting && hits === 0)) continue;
                        const weight = targeting ? Math.pow(20, hits) : 1;
                        for (const [cr, cc] of cells) if (grid[cr][cc] === null) density[cr][cc] += weight;
                    }
                }
            }
        }
        return density;
    }

    function bestFromMap(grid, density, rng) {
        let best = 0;
        let options = [];
        for (let r = 0; r < N; r++) {
            for (let c = 0; c < N; c++) {
                if (grid[r][c] !== null) continue;
                if (density[r][c] > best) { best = density[r][c]; options = [[r, c]]; }
                else if (density[r][c] === best && best > 0) options.push([r, c]);
            }
        }
        return options.length ? pick(options, rng) : null;
    }

    /**
     * Choose the next shot. `knowledge` = Engine.getKnowledge(opponentBoard).
     * Always returns an un-fired [row, col] while any exist, otherwise null.
     */
    function chooseShot(difficulty, knowledge, rng) {
        const random = rng || Math.random;
        const { grid, remaining } = knowledge;
        const open = unshotCells(grid);
        if (!open.length) return null;

        if (difficulty === 'beginner') {
            const targets = targetCandidates(grid);
            if (targets.length && random() < 0.5) return pick(targets, random);
            return pick(open, random);
        }

        if (difficulty === 'veteran') {
            const targets = targetCandidates(grid);
            if (targets.length) return pick(targets, random);
            const smallest = remaining.length ? Math.min(...remaining) : 1;
            const parity = open.filter(([r, c]) => (r + c) % smallest === 0);
            return pick(parity.length ? parity : open, random);
        }

        const shot = bestFromMap(grid, probabilityMap(grid, remaining), random);
        return shot || pick(open, random);
    }

    return { DIFFICULTIES, chooseShot, probabilityMap, targetCandidates };
});

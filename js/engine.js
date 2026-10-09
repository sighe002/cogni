/* Battleship core rules. Pure logic, no DOM: usable in the browser and in Node tests. */
(function (root, factory) {
    if (typeof module === 'object' && module.exports) module.exports = factory();
    else root.BattleshipEngine = factory();
})(typeof self !== 'undefined' ? self : this, function () {
    'use strict';

    const BOARD_SIZE = 10;
    const FLEET = Object.freeze([
        Object.freeze({ name: 'Carrier', size: 5 }),
        Object.freeze({ name: 'Battleship', size: 4 }),
        Object.freeze({ name: 'Cruiser', size: 3 }),
        Object.freeze({ name: 'Submarine', size: 3 }),
        Object.freeze({ name: 'Destroyer', size: 2 })
    ]);
    const ROW_LABELS = 'ABCDEFGHIJ';

    function makeGrid(fill) {
        return Array.from({ length: BOARD_SIZE }, () => Array(BOARD_SIZE).fill(fill));
    }

    function createBoard() {
        return {
            ships: [],
            shipAt: makeGrid(-1),
            shots: makeGrid(null)
        };
    }

    function inBounds(r, c) {
        return Number.isInteger(r) && Number.isInteger(c) &&
            r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE;
    }

    function shipCells(r, c, size, horizontal) {
        const cells = [];
        for (let i = 0; i < size; i++) {
            cells.push(horizontal ? [r, c + i] : [r + i, c]);
        }
        return cells;
    }

    function canPlace(board, r, c, size, horizontal) {
        return shipCells(r, c, size, horizontal)
            .every(([cr, cc]) => inBounds(cr, cc) && board.shipAt[cr][cc] === -1);
    }

    function placeShip(board, def, r, c, horizontal) {
        if (board.ships.some(s => s.name === def.name)) return null;
        if (!canPlace(board, r, c, def.size, horizontal)) return null;
        const ship = {
            name: def.name,
            size: def.size,
            cells: shipCells(r, c, def.size, horizontal),
            hits: 0
        };
        const index = board.ships.length;
        board.ships.push(ship);
        ship.cells.forEach(([cr, cc]) => { board.shipAt[cr][cc] = index; });
        return ship;
    }

    function clearShips(board) {
        board.ships = [];
        board.shipAt = makeGrid(-1);
    }

    function placeFleetRandomly(board, rng) {
        const random = rng || Math.random;
        clearShips(board);
        for (const def of FLEET) {
            const options = [];
            for (const horizontal of [true, false]) {
                for (let r = 0; r < BOARD_SIZE; r++) {
                    for (let c = 0; c < BOARD_SIZE; c++) {
                        if (canPlace(board, r, c, def.size, horizontal)) options.push([r, c, horizontal]);
                    }
                }
            }
            const [r, c, horizontal] = options[Math.floor(random() * options.length)];
            placeShip(board, def, r, c, horizontal);
        }
        return board;
    }

    function isFleetComplete(board) {
        return board.ships.length === FLEET.length;
    }

    function isSunk(ship) {
        return ship.hits >= ship.size;
    }

    /**
     * Fire at a cell. Returns { result, ship } where result is one of
     * 'miss' | 'hit' | 'sunk' | 'repeat' | 'invalid'.
     */
    function fireAt(board, r, c) {
        if (!inBounds(r, c)) return { result: 'invalid', ship: null };
        if (board.shots[r][c] !== null) return { result: 'repeat', ship: null };
        const index = board.shipAt[r][c];
        if (index === -1) {
            board.shots[r][c] = 'miss';
            return { result: 'miss', ship: null };
        }
        board.shots[r][c] = 'hit';
        const ship = board.ships[index];
        ship.hits++;
        return { result: isSunk(ship) ? 'sunk' : 'hit', ship };
    }

    function allSunk(board) {
        return board.ships.length > 0 && board.ships.every(isSunk);
    }

    /**
     * What an opponent legitimately knows about this board: hits, misses,
     * cells of ships that were announced sunk, and sizes of ships still afloat.
     */
    function getKnowledge(board) {
        const grid = board.shots.map(row => row.slice());
        const remaining = [];
        board.ships.forEach(ship => {
            if (isSunk(ship)) ship.cells.forEach(([r, c]) => { grid[r][c] = 'sunk'; });
            else remaining.push(ship.size);
        });
        return { grid, remaining };
    }

    function coordLabel(r, c) {
        return ROW_LABELS[r] + (c + 1);
    }

    return {
        BOARD_SIZE, FLEET, ROW_LABELS,
        createBoard, inBounds, shipCells, canPlace, placeShip, clearShips,
        placeFleetRandomly, isFleetComplete, isSunk, fireAt, allSunk,
        getKnowledge, coordLabel
    };
});

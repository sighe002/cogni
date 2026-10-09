const test = require('node:test');
const assert = require('node:assert');
const E = require('../js/engine.js');

function seeded(seed) {
    let s = seed >>> 0;
    return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 2 ** 32; };
}

test('random fleet: 5 ships, no overlaps, in bounds, 17 cells', () => {
    for (let i = 0; i < 500; i++) {
        const b = E.placeFleetRandomly(E.createBoard(), seeded(i));
        assert.strictEqual(b.ships.length, 5);
        const seen = new Set();
        for (const ship of b.ships) {
            assert.strictEqual(ship.cells.length, ship.size);
            for (const [r, c] of ship.cells) {
                assert.ok(E.inBounds(r, c));
                const key = r * 10 + c;
                assert.ok(!seen.has(key), 'overlap');
                seen.add(key);
            }
        }
        assert.strictEqual(seen.size, 17);
    }
});

test('placeFleetRandomly can be re-run on a used board without leftovers', () => {
    const b = E.createBoard();
    E.placeFleetRandomly(b, seeded(1));
    E.placeFleetRandomly(b, seeded(2));
    const occupied = b.shipAt.flat().filter(v => v !== -1).length;
    assert.strictEqual(occupied, 17);
});

test('placeShip rejects out of bounds, overlap and duplicates', () => {
    const b = E.createBoard();
    assert.strictEqual(E.placeShip(b, E.FLEET[0], 0, 6, true), null);
    assert.strictEqual(E.placeShip(b, E.FLEET[0], 6, 0, false), null);
    assert.ok(E.placeShip(b, E.FLEET[0], 0, 5, true));
    assert.strictEqual(E.placeShip(b, E.FLEET[1], 0, 9, false), null, 'overlap');
    assert.strictEqual(E.placeShip(b, E.FLEET[0], 5, 0, true), null, 'duplicate');
    assert.ok(E.placeShip(b, E.FLEET[1], 1, 9, false));
});

test('fireAt: miss, hit, sunk, repeat, invalid', () => {
    const b = E.createBoard();
    E.placeShip(b, E.FLEET[4], 0, 0, true);
    assert.strictEqual(E.fireAt(b, 5, 5).result, 'miss');
    assert.strictEqual(E.fireAt(b, 5, 5).result, 'repeat');
    assert.strictEqual(E.fireAt(b, 0, 0).result, 'hit');
    assert.strictEqual(E.fireAt(b, 0, 0).result, 'repeat');
    assert.strictEqual(b.ships[0].hits, 1, 'repeat must not double count');
    const last = E.fireAt(b, 0, 1);
    assert.strictEqual(last.result, 'sunk');
    assert.strictEqual(last.ship.name, 'Destroyer');
    assert.ok(E.allSunk(b));
    assert.strictEqual(E.fireAt(b, -1, 3).result, 'invalid');
    assert.strictEqual(E.fireAt(b, 10, 0).result, 'invalid');
});

test('allSunk is false for an empty board', () => {
    assert.strictEqual(E.allSunk(E.createBoard()), false);
});

test('getKnowledge never leaks un-hit ship cells', () => {
    const b = E.placeFleetRandomly(E.createBoard(), seeded(7));
    const k = E.getKnowledge(b);
    assert.ok(k.grid.flat().every(v => v === null));
    assert.deepStrictEqual(k.remaining.sort(), [2, 3, 3, 4, 5]);
    const ship = b.ships[4];
    ship.cells.forEach(([r, c]) => E.fireAt(b, r, c));
    const k2 = E.getKnowledge(b);
    ship.cells.forEach(([r, c]) => assert.strictEqual(k2.grid[r][c], 'sunk'));
    assert.strictEqual(k2.remaining.length, 4);
});

test('coordLabel', () => {
    assert.strictEqual(E.coordLabel(0, 0), 'A1');
    assert.strictEqual(E.coordLabel(9, 9), 'J10');
});

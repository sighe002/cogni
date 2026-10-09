const test = require('node:test');
const assert = require('node:assert');
const E = require('../js/engine.js');
const AI = require('../js/ai.js');

function seeded(seed) {
    let s = seed >>> 0;
    return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 2 ** 32; };
}

function playOut(difficulty, seed) {
    const rng = seeded(seed);
    const b = E.placeFleetRandomly(E.createBoard(), rng);
    let shots = 0;
    while (!E.allSunk(b)) {
        const shot = AI.chooseShot(difficulty, E.getKnowledge(b), rng);
        assert.ok(shot, 'AI returned no shot while ships remain');
        const { result } = E.fireAt(b, shot[0], shot[1]);
        assert.notStrictEqual(result, 'repeat', `${difficulty} fired twice at the same cell`);
        assert.notStrictEqual(result, 'invalid');
        shots++;
        assert.ok(shots <= 100);
    }
    return shots;
}

for (const difficulty of Object.keys(AI.DIFFICULTIES)) {
    test(`${difficulty} AI always finishes without repeating a cell`, () => {
        for (let seed = 1; seed <= 150; seed++) playOut(difficulty, seed);
    });
}

test('harder AIs need fewer shots on average', () => {
    const avg = d => {
        let total = 0;
        for (let seed = 1; seed <= 150; seed++) total += playOut(d, seed);
        return total / 150;
    };
    const beginner = avg('beginner');
    const veteran = avg('veteran');
    const admiral = avg('admiral');
    console.log({ beginner, veteran, admiral });
    assert.ok(veteran < beginner);
    assert.ok(admiral < veteran);
});

test('AI follows up a lone hit on an adjacent cell', () => {
    const b = E.createBoard();
    E.placeShip(b, E.FLEET[0], 4, 2, true);
    E.fireAt(b, 4, 4);
    const k = E.getKnowledge(b);
    for (const d of ['veteran', 'admiral']) {
        const [r, c] = AI.chooseShot(d, k, seeded(3));
        assert.strictEqual(Math.abs(r - 4) + Math.abs(c - 4), 1, d);
    }
});

test('AI extends a line of hits', () => {
    const b = E.createBoard();
    E.placeShip(b, E.FLEET[0], 4, 2, true);
    E.fireAt(b, 4, 4);
    E.fireAt(b, 4, 5);
    const k = E.getKnowledge(b);
    for (const d of ['veteran', 'admiral']) {
        const [r, c] = AI.chooseShot(d, k, seeded(5));
        assert.strictEqual(r, 4, d);
        assert.ok(c === 3 || c === 6, d);
    }
});

test('AI ignores cells next to sunk ships once nothing is left to chase', () => {
    const b = E.createBoard();
    E.placeShip(b, E.FLEET[4], 0, 0, true);
    E.placeShip(b, E.FLEET[0], 9, 0, true);
    E.fireAt(b, 0, 0);
    E.fireAt(b, 0, 1);
    const k = E.getKnowledge(b);
    assert.deepStrictEqual(AI.targetCandidates(k.grid), []);
});

test('chooseShot returns null when the board is full', () => {
    const grid = Array.from({ length: 10 }, () => Array(10).fill('miss'));
    assert.strictEqual(AI.chooseShot('admiral', { grid, remaining: [] }), null);
});

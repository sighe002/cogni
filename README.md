# Retro Battleship vs AI

A DOS-style Battleship game you play in the browser against a computer opponent.
Plain HTML/CSS/JavaScript: no build step, no dependencies.

## How to play

1. **Deploy your fleet** - click your grid to place each ship (hover shows a green/red preview).
   Press **R** (or right-click) to rotate, **A** for a random fleet, **C** to clear.
2. Pick an AI level by clicking the middle console box (**D**): Beginner, Veteran or Admiral.
3. Press **Start Battle** (or Enter) and click *Enemy Waters* to fire. You and the computer alternate shots.
4. Sink all 5 enemy ships (Carrier 5, Battleship 4, Cruiser 3, Submarine 3, Destroyer 2) before it sinks yours.

Other controls: **N** new game, **H** hint (3 per game), **S** sound on/off, **E** surrender.

## AI levels

| Level | Strategy |
|-------|----------|
| Beginner | Random shots; follows up on a hit only half the time. |
| Veteran | Hunt/target: checkerboard (parity) search, then works along a line of hits until the ship sinks. |
| Admiral | Probability density: for every open cell counts how many placements of the remaining ships fit there (hits weighted heavily) and fires at the most likely cell. |

The AI only sees what a human opponent would: its own hits/misses, which ships have been sunk, and the sizes of ships still afloat. It never reads your ship positions.

In 150 simulated games each, the average shots needed to sink a fleet are roughly Beginner ~63, Veteran ~50, Admiral ~45.

## Run locally

```bash
python3 -m http.server 8080   # then open http://localhost:8080
```

## Tests

Game rules and AI are pure modules, tested with Node's built-in test runner (Node 18+):

```bash
node --test tests/
```

## Project layout

```
index.html        markup
style.css         retro DOS / CRT styling
js/engine.js      board, placement, firing, win detection (no DOM)
js/ai.js          computer opponent (no DOM)
js/sound.js       8-bit sound effects via Web Audio
js/main.js        UI controller
tests/            unit tests for engine + AI
Debugging_Report.md  bugs found and how they were fixed
```

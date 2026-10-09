# Battleship Debugging Report

How the game was debugged: code review of the first draft, unit tests for the rules and the AI
(`node --test tests/`, including 450 simulated full games), and scripted browser play-throughs
(Playwright driving Chrome: manual placement, full games, restart mid-turn, mobile viewport, console errors).

## Bugs found in the first draft

### 1. "New" during the computer's turn gave the AI a free shot on the new board
* **Issue:** After the player fired, the AI move was scheduled with `setTimeout(aiTurn, 800)` and never cancelled. Pressing New within that window started a fresh game, then the old timer fired: the AI shot at the brand-new fleet before the player had moved.
* **Fix:** The timer handle is stored and cleared on New/game over, and every scheduled AI turn carries a `gameId` that must match the current game before it runs.

### 2. AI kept shooting around ships it had already sunk, and could recurse
* **Issue:** Every hit pushed its 4 neighbours onto `aiTargets`, but the queue was never pruned when a ship sank, so the AI wasted turns next to wrecks. Stale/duplicate targets were handled by calling `aiTurn()` recursively, and "already fired" was detected by reading CSS classes from the DOM.
* **Fix:** Game state now lives in a DOM-free engine (`js/engine.js`) with a shots grid. The AI (`js/ai.js`) is stateless: each turn it decides from the public knowledge grid (hit / miss / sunk + remaining ship sizes), so sunk ships are ignored automatically and it can only pick un-fired cells. Unit tests play 450 full games and assert the AI never repeats a cell and always finishes.

### 3. Hint, Sound and Exit buttons did nothing
* **Issue:** Only the New button had a click handler; the other three were decoration. The underlined hotkeys (N/H/S/E) were not wired either.
* **Fix:** Hint highlights the most probable enemy cell (3 per game), Sound toggles 8-bit Web Audio effects (saved in localStorage), Exit asks to surrender and reveals the enemy fleet. All hotkeys work.

### 4. Retro font never loaded
* **Issue:** `fonts.googleapis.com/css2?family=Courier+Prime:bold` is not valid css2 API syntax, so the request failed and the page fell back to Courier New.
* **Fix:** Use `family=Courier+Prime:wght@700` (plus Press Start 2P / VT323 for the title and terminal text).

### 5. Player's own shot result was overwritten before it could be read
* **Issue:** The status line showed "PLAYER SCORED A HIT!" and 800 ms later the AI's move replaced it, so it was easy to miss whether your shot hit.
* **Fix:** Added a battle log (last 6 events from both sides), per-fleet status panels with hit pips and struck-through sunk ships, and distinct hit vs. sunk cell styling.

### 6. No way to place your own ships; "Beginner" box was static
* **Issue:** The player's fleet was always random and the difficulty label could not be changed.
* **Fix:** Added a placement phase with live preview, rotate, random and clear. The difficulty box cycles Beginner / Veteran / Admiral (locked once a battle starts).

### 7. Random placement used an unbounded retry loop
* **Issue:** `while (!placed)` kept rolling random coordinates until one fit.
* **Fix:** `placeFleetRandomly` enumerates every legal placement for the ship and picks one, so it always terminates. Tests check 500 random fleets for overlaps, bounds and the 17-cell total.

### 8. Boards overflowed on phones
* **Issue:** Fixed 32 px cells and fixed-width header rows did not fit narrow screens.
* **Fix:** Cell and label sizes use `clamp()` CSS variables and labels are part of the board grid; verified no horizontal scroll at 390 px wide.

## Bugs found while testing the rebuild

### 9. Placement preview wrapped onto the next row
* **Issue:** Hovering A8 with the Carrier (horizontal) highlighted 5 red cells instead of 3. The preview keyed cells as `row * 10 + col`, so the off-board cell (A, 11) collided with (B, 1) and lit up cells on row B. Caught by the Playwright check that counts preview cells.
* **Fix:** Drop out-of-bounds cells before building the preview key set.

### 10. Console error on every load
* **Issue:** The browser requested `/favicon.ico`, which returned 404.
* **Fix:** Added an inline SVG favicon. The scripted play-through now finishes with zero console errors.

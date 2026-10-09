# Battleship Debugging Report

During the development of the Battleship web application via AI tooling, I encountered and resolved several logical and state management bugs to ensure a stable, playable game.

### 1. Bug: Ship Overlap During Generation
* **The Issue:** The initial random placement logic allowed ships to generate on top of each other, resulting in missing fleet cells and breaking the total hit-count required to win.
* **The Fix:** I implemented an `isValidPlacement` function that checks the full proposed length of the ship before placement. If any cell in the `[row][col]` array contains a value other than `0`, the validation fails, and the loop rerolls the coordinates until a completely empty path is found.

### 2. Bug: AI Redundant Targeting 
* **The Issue:** The AI would occasionally waste turns firing at coordinates it had already attacked (both hits and misses), leading to infinite loops or wasted turns.
* **The Fix:** I updated the `aiTurn` function to strictly check the DOM state (`classList.contains('hit')` or `'miss'`) of the cell before firing. If the cell was already interacted with, the AI recursively calls `aiTurn()` to generate a new coordinate.

### 3. Bug: "Dumb" AI Opponent
* **The Issue:** A purely random AI made the game too easy and unengaging, as it would hit a ship but then randomly fire at the other side of the board on the next turn.
* **The Fix:** I implemented a "Hunt and Target" queue. When the AI registers a `"hit"`, it pushes the four adjacent coordinates (up, down, left, right) into an `aiTargets` array (checking bounds). On subsequent turns, if `aiTargets` is not empty, the AI pops a coordinate from this array instead of generating a random one, effectively hunting the rest of the ship.
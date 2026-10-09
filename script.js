const BOARD_SIZE = 10;
const SHIPS = [
    { name: 'Carrier', size: 5 },
    { name: 'Battleship', size: 4 },
    { name: 'Cruiser', size: 3 },
    { name: 'Submarine', size: 3 },
    { name: 'Destroyer', size: 2 }
];

let playerBoard = [];
let aiBoard = [];
let isPlayerTurn = true;
let gameOver = false;
let aiTargets = []; // For smart AI hunting

function initBoard() {
    return Array.from({ length: BOARD_SIZE }, () => Array(BOARD_SIZE).fill(0));
}

function placeShipsRandomly(board) {
    let shipsSunkState = {};
    SHIPS.forEach(ship => {
        let placed = false;
        while (!placed) {
            const isHorizontal = Math.random() > 0.5;
            const row = Math.floor(Math.random() * BOARD_SIZE);
            const col = Math.floor(Math.random() * BOARD_SIZE);
            
            if (isValidPlacement(board, row, col, ship.size, isHorizontal)) {
                let coords = [];
                for (let i = 0; i < ship.size; i++) {
                    if (isHorizontal) {
                        board[row][col + i] = ship.name;
                        coords.push(`${row},${col+i}`);
                    } else {
                        board[row + i][col] = ship.name;
                        coords.push(`${row+i},${col}`);
                    }
                }
                shipsSunkState[ship.name] = { hits: 0, size: ship.size, coords };
                placed = true;
            }
        }
    });
    return shipsSunkState;
}

function isValidPlacement(board, row, col, size, isHorizontal) {
    if (isHorizontal) {
        if (col + size > BOARD_SIZE) return false;
        for (let i = 0; i < size; i++) if (board[row][col + i] !== 0) return false;
    } else {
        if (row + size > BOARD_SIZE) return false;
        for (let i = 0; i < size; i++) if (board[row + i][col] !== 0) return false;
    }
    return true;
}

function renderBoard(elementId, boardData, isAI, clickHandler) {
    const boardElement = document.getElementById(elementId);
    boardElement.innerHTML = '';
    for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
            const cell = document.createElement('div');
            cell.classList.add('cell');
            cell.dataset.r = r;
            cell.dataset.c = c;
            
            if (!isAI && boardData[r][c] !== 0) cell.classList.add('ship');
            if (isAI && clickHandler) cell.addEventListener('click', () => clickHandler(r, c));
            
            boardElement.appendChild(cell);
        }
    }
}

let playerShipsState, aiShipsState;

function startGame() {
    playerBoard = initBoard();
    aiBoard = initBoard();
    playerShipsState = placeShipsRandomly(playerBoard);
    aiShipsState = placeShipsRandomly(aiBoard);
    aiTargets = [];
    isPlayerTurn = true;
    gameOver = false;
    document.getElementById('status-message').innerText = "Click on the Enemy Fleet to fire!";
    document.getElementById('turn-display').innerText = "Your Turn";
    
    renderBoard('player-board', playerBoard, false);
    renderBoard('ai-board', aiBoard, true, handlePlayerAttack);
}

function handlePlayerAttack(r, c) {
    if (!isPlayerTurn || gameOver) return;
    const cellElement = document.querySelector(`#ai-board .cell[data-r="${r}"][data-c="${c}"]`);
    if (cellElement.classList.contains('hit') || cellElement.classList.contains('miss')) return;

    processAttack(aiBoard, r, c, cellElement, aiShipsState, "Player");
    
    if (!gameOver) {
        isPlayerTurn = false;
        document.getElementById('turn-display').innerText = "AI's Turn...";
        setTimeout(aiTurn, 800);
    }
}

function aiTurn() {
    if (gameOver) return;
    let r, c;
    
    // Smart AI: Hunt if targets exist, otherwise random
    if (aiTargets.length > 0) {
        const target = aiTargets.pop();
        r = target.r;
        c = target.c;
    } else {
        do {
            r = Math.floor(Math.random() * BOARD_SIZE);
            c = Math.floor(Math.random() * BOARD_SIZE);
        } while (document.querySelector(`#player-board .cell[data-r="${r}"][data-c="${c}"]`).classList.contains('hit') || 
                 document.querySelector(`#player-board .cell[data-r="${r}"][data-c="${c}"]`).classList.contains('miss'));
    }

    const cellElement = document.querySelector(`#player-board .cell[data-r="${r}"][data-c="${c}"]`);
    if (cellElement.classList.contains('hit') || cellElement.classList.contains('miss')) {
        return aiTurn(); // Retry if we randomly picked an already hit cell during target pop
    }

    const hitResult = processAttack(playerBoard, r, c, cellElement, playerShipsState, "AI");
    
    if (hitResult === "hit") {
        // Add adjacent cells to targets
        const adjacent = [{r: r-1, c}, {r: r+1, c}, {r, c: c-1}, {r, c: c+1}];
        adjacent.forEach(adj => {
            if (adj.r >= 0 && adj.r < BOARD_SIZE && adj.c >= 0 && adj.c < BOARD_SIZE) {
                aiTargets.push(adj);
            }
        });
    }

    if (!gameOver) {
        isPlayerTurn = true;
        document.getElementById('turn-display').innerText = "Your Turn";
    }
}

function processAttack(board, r, c, cellElement, shipsState, attacker) {
    if (board[r][c] !== 0) {
        cellElement.classList.add('hit');
        const shipName = board[r][c];
        shipsState[shipName].hits++;
        
        if (shipsState[shipName].hits === shipsState[shipName].size) {
            document.getElementById('status-message').innerText = `${attacker} sunk a ${shipName}!`;
            checkWinCondition(shipsState, attacker);
        } else {
            document.getElementById('status-message').innerText = `${attacker} scored a hit!`;
        }
        return "hit";
    } else {
        cellElement.classList.add('miss');
        document.getElementById('status-message').innerText = `${attacker} missed.`;
        return "miss";
    }
}

function checkWinCondition(shipsState, attacker) {
    const allSunk = Object.values(shipsState).every(ship => ship.hits === ship.size);
    if (allSunk) {
        document.getElementById('status-message').innerText = `${attacker} WINS THE GAME!`;
        document.getElementById('turn-display').innerText = "Game Over";
        gameOver = true;
    }
}

document.getElementById('restart-btn').addEventListener('click', startGame);
startGame();
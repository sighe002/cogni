/* UI controller: wires the engine + AI to the DOM. */
(function () {
    'use strict';
    const E = window.BattleshipEngine;
    const AI = window.BattleshipAI;
    const Sound = window.RetroSound;

    const AI_DELAY_MS = 750;
    const MAX_HINTS = 3;
    const LOG_LIMIT = 6;
    const DIFFICULTY_ORDER = Object.keys(AI.DIFFICULTIES);
    const DIFFICULTY_KEY = 'battleship.difficulty';

    const $ = id => document.getElementById(id);
    const el = {
        playerBoard: $('player-board'), aiBoard: $('ai-board'),
        playerFleet: $('player-fleet'), aiFleet: $('ai-fleet'),
        turn: $('turn-display'), status: $('status-message'), log: $('battle-log'), stats: $('stats'),
        playerLight: $('player-light'), aiLight: $('ai-light'),
        difficultyBtn: $('difficulty-btn'), difficultyLabel: $('difficulty-label'),
        placementPanel: $('placement-panel'), placementText: $('placement-text'),
        rotateBtn: $('rotate-btn'), randomBtn: $('random-btn'), clearBtn: $('clear-btn'), startBtn: $('start-btn'),
        newBtn: $('new-btn'), hintBtn: $('hint-btn'), soundBtn: $('sound-btn'), exitBtn: $('exit-btn'),
        modal: $('modal'), modalTitle: $('modal-title'), modalBody: $('modal-body'), modalButtons: $('modal-buttons')
    };

    const state = {
        gameId: 0,
        phase: 'placement', // placement | player | ai | over
        player: null,
        enemy: null,
        difficulty: loadDifficulty(),
        horizontal: true,
        hover: null,
        aiTimer: null,
        hint: null,
        hintsLeft: MAX_HINTS,
        lastPlayerShot: null,
        lastAiShot: null,
        stats: null
    };
    const cellEls = { player: [], enemy: [] };

    function loadDifficulty() {
        try {
            const saved = localStorage.getItem(DIFFICULTY_KEY);
            if (DIFFICULTY_ORDER.includes(saved)) return saved;
        } catch (e) { /* ignore */ }
        return 'veteran';
    }

    // ---------- board construction ----------
    function buildBoard(container, key, onClick) {
        container.innerHTML = '';
        cellEls[key] = [];
        container.appendChild(labelDiv('', 'corner'));
        for (let c = 0; c < E.BOARD_SIZE; c++) container.appendChild(labelDiv(String(c + 1), 'col-label'));
        for (let r = 0; r < E.BOARD_SIZE; r++) {
            container.appendChild(labelDiv(E.ROW_LABELS[r], 'row-label'));
            const row = [];
            for (let c = 0; c < E.BOARD_SIZE; c++) {
                const cell = document.createElement('button');
                cell.type = 'button';
                cell.className = 'cell';
                cell.setAttribute('aria-label', E.coordLabel(r, c));
                cell.addEventListener('click', () => onClick(r, c));
                if (key === 'player') {
                    cell.addEventListener('mouseenter', () => { state.hover = [r, c]; render(); });
                    cell.addEventListener('focus', () => { state.hover = [r, c]; render(); });
                }
                container.appendChild(cell);
                row.push(cell);
            }
            cellEls[key].push(row);
        }
    }

    function labelDiv(text, cls) {
        const d = document.createElement('div');
        d.className = 'coord ' + cls;
        d.textContent = text;
        return d;
    }

    // ---------- messaging ----------
    function setStatus(text) {
        el.status.textContent = text;
    }

    function addLog(text, cls) {
        const li = document.createElement('li');
        li.textContent = text;
        if (cls) li.className = cls;
        el.log.prepend(li);
        while (el.log.children.length > LOG_LIMIT) el.log.lastChild.remove();
    }

    function placementPrompt() {
        const def = E.FLEET[state.player.ships.length];
        if (!def) return 'FLEET READY! PRESS START BATTLE (ENTER).';
        const dir = state.horizontal ? 'HORIZONTAL' : 'VERTICAL';
        return `PLACE YOUR ${def.name.toUpperCase()} (${def.size}) - ${dir}. R TO ROTATE.`;
    }

    // ---------- game flow ----------
    function newGame() {
        clearTimeout(state.aiTimer);
        state.aiTimer = null;
        state.gameId++;
        closeModal();
        state.phase = 'placement';
        state.player = E.createBoard();
        state.enemy = E.placeFleetRandomly(E.createBoard());
        state.horizontal = true;
        state.hover = null;
        state.hint = null;
        state.hintsLeft = MAX_HINTS;
        state.lastPlayerShot = null;
        state.lastAiShot = null;
        state.stats = { shots: 0, hits: 0, aiShots: 0, aiHits: 0 };
        el.log.innerHTML = '';
        setStatus('DEPLOY YOUR FLEET: CLICK YOUR GRID TO PLACE SHIPS, OR PRESS RANDOM.');
        render();
    }

    function requestNewGame() {
        if (state.phase === 'player' || state.phase === 'ai') {
            openModal('NEW GAME?', 'The current battle will be abandoned.', [
                { label: 'Yes', key: 'y', action: newGame },
                { label: 'No', key: 'n', action: closeModal }
            ]);
        } else {
            newGame();
        }
    }

    function placeAt(r, c) {
        if (state.phase !== 'placement') return;
        const def = E.FLEET[state.player.ships.length];
        if (!def) { setStatus(placementPrompt()); return; }
        if (!E.placeShip(state.player, def, r, c, state.horizontal)) {
            Sound.play('error');
            setStatus(`YOUR ${def.name.toUpperCase()} WON'T FIT AT ${E.coordLabel(r, c)}. TRY ANOTHER SPOT OR ROTATE.`);
            return;
        }
        Sound.play('place');
        setStatus(placementPrompt());
        render();
    }

    function rotate() {
        if (state.phase !== 'placement') return;
        state.horizontal = !state.horizontal;
        setStatus(placementPrompt());
        render();
    }

    function randomFleet() {
        if (state.phase !== 'placement') return;
        E.placeFleetRandomly(state.player);
        Sound.play('place');
        setStatus(placementPrompt());
        render();
    }

    function clearFleet() {
        if (state.phase !== 'placement') return;
        E.clearShips(state.player);
        setStatus(placementPrompt());
        render();
    }

    function startBattle() {
        if (state.phase !== 'placement') return;
        if (!E.isFleetComplete(state.player)) {
            Sound.play('error');
            setStatus('PLACE ALL 5 SHIPS BEFORE STARTING. ' + placementPrompt());
            return;
        }
        state.phase = 'player';
        state.hover = null;
        Sound.play('place');
        setStatus('BATTLE STATIONS! CLICK ENEMY WATERS TO FIRE.');
        addLog(`Battle started vs ${AI.DIFFICULTIES[state.difficulty]} AI.`);
        render();
    }

    function fireAtEnemy(r, c) {
        if (state.phase === 'placement') {
            setStatus('DEPLOY YOUR FLEET FIRST. ' + placementPrompt());
            return;
        }
        if (state.phase !== 'player') return;
        const outcome = E.fireAt(state.enemy, r, c);
        if (outcome.result === 'repeat' || outcome.result === 'invalid') {
            Sound.play('error');
            setStatus(`YOU ALREADY FIRED AT ${E.coordLabel(r, c)}. PICK ANOTHER TARGET.`);
            return;
        }
        state.hint = null;
        state.lastPlayerShot = [r, c];
        state.stats.shots++;
        if (outcome.result !== 'miss') state.stats.hits++;
        announce(true, r, c, outcome);

        if (E.allSunk(state.enemy)) { endGame(true); return; }
        state.phase = 'ai';
        render();
        const id = state.gameId;
        state.aiTimer = setTimeout(() => aiTurn(id), AI_DELAY_MS);
    }

    function aiTurn(id) {
        if (id !== state.gameId || state.phase !== 'ai') return;
        state.aiTimer = null;
        const shot = AI.chooseShot(state.difficulty, E.getKnowledge(state.player));
        if (!shot) { endGame(true); return; }
        const [r, c] = shot;
        const outcome = E.fireAt(state.player, r, c);
        state.lastAiShot = [r, c];
        state.stats.aiShots++;
        if (outcome.result !== 'miss') state.stats.aiHits++;
        announce(false, r, c, outcome);

        if (E.allSunk(state.player)) { endGame(false); return; }
        state.phase = 'player';
        render();
    }

    function announce(isPlayer, r, c, outcome) {
        const at = E.coordLabel(r, c);
        const who = isPlayer ? 'YOU' : 'COMPUTER';
        let text;
        if (outcome.result === 'miss') text = `${who} FIRED AT ${at}: MISS.`;
        else if (outcome.result === 'hit') text = `${who} FIRED AT ${at}: HIT!`;
        else text = isPlayer
            ? `${at}: YOU SANK THE ENEMY ${outcome.ship.name.toUpperCase()}!`
            : `${at}: THE COMPUTER SANK YOUR ${outcome.ship.name.toUpperCase()}!`;
        Sound.play(outcome.result === 'sunk' ? 'sunk' : outcome.result);
        setStatus(text);
        addLog(text, (isPlayer ? 'log-player ' : 'log-ai ') + 'log-' + outcome.result);
    }

    function endGame(playerWon, surrendered) {
        clearTimeout(state.aiTimer);
        state.aiTimer = null;
        state.phase = 'over';
        state.hint = null;
        render();
        Sound.play(playerWon ? 'win' : 'lose');
        const s = state.stats;
        const acc = s.shots ? Math.round((s.hits / s.shots) * 100) : 0;
        const title = playerWon ? 'VICTORY!' : (surrendered ? 'SURRENDERED' : 'DEFEAT');
        const line = playerWon
            ? 'You sank the entire enemy fleet!'
            : (surrendered ? 'You abandoned ship. The enemy fleet is revealed.' : 'The computer sank your entire fleet.');
        const text = `${line}\nShots: ${s.shots}  Hits: ${s.hits}  Accuracy: ${acc}%\nComputer shots: ${s.aiShots}`;
        setStatus(`${title} PRESS N FOR A NEW GAME.`);
        addLog(title, playerWon ? 'log-sunk log-player' : 'log-sunk log-ai');
        openModal(title, text, [
            { label: 'Play Again', key: 'n', action: newGame },
            { label: 'View Board', key: 'v', action: closeModal }
        ]);
    }

    function useHint() {
        if (state.phase !== 'player') {
            Sound.play('error');
            setStatus(state.phase === 'placement' ? 'HINTS ARE AVAILABLE ONCE THE BATTLE STARTS.' : 'HINTS ARE ONLY AVAILABLE ON YOUR TURN.');
            return;
        }
        if (state.hintsLeft <= 0) {
            Sound.play('error');
            setStatus('NO HINTS LEFT THIS GAME.');
            return;
        }
        const shot = AI.chooseShot('admiral', E.getKnowledge(state.enemy));
        if (!shot) return;
        state.hint = shot;
        state.hintsLeft--;
        Sound.play('click');
        setStatus(`INTEL SUGGESTS FIRING AT ${E.coordLabel(shot[0], shot[1])}.`);
        render();
    }

    function toggleSound() {
        Sound.setEnabled(!Sound.isEnabled());
        Sound.play('click');
        setStatus(`SOUND ${Sound.isEnabled() ? 'ON' : 'OFF'}.`);
        render();
    }

    function requestExit() {
        if (state.phase === 'player' || state.phase === 'ai') {
            openModal('SURRENDER?', 'Abandon ship and reveal the enemy fleet?', [
                { label: 'Yes', key: 'y', action: () => { closeModal(); endGame(false, true); } },
                { label: 'No', key: 'n', action: closeModal }
            ]);
        } else {
            setStatus(state.phase === 'over' ? 'GAME OVER. PRESS N FOR A NEW GAME.' : 'NO BATTLE IN PROGRESS. DEPLOY YOUR FLEET TO BEGIN.');
        }
    }

    function cycleDifficulty() {
        if (state.phase !== 'placement') {
            Sound.play('error');
            setStatus('DIFFICULTY IS LOCKED DURING A BATTLE. PRESS N FOR A NEW GAME.');
            return;
        }
        const i = DIFFICULTY_ORDER.indexOf(state.difficulty);
        state.difficulty = DIFFICULTY_ORDER[(i + 1) % DIFFICULTY_ORDER.length];
        try { localStorage.setItem(DIFFICULTY_KEY, state.difficulty); } catch (e) { /* ignore */ }
        Sound.play('click');
        setStatus(`AI DIFFICULTY: ${AI.DIFFICULTIES[state.difficulty].toUpperCase()}.`);
        render();
    }

    // ---------- modal ----------
    let modalActions = [];
    function openModal(title, body, buttons) {
        el.modalTitle.textContent = title;
        el.modalBody.textContent = body;
        el.modalButtons.innerHTML = '';
        modalActions = buttons;
        buttons.forEach((b, i) => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'classic-btn small';
            btn.textContent = b.label;
            btn.addEventListener('click', b.action);
            el.modalButtons.appendChild(btn);
            if (i === 0) setTimeout(() => btn.focus(), 0);
        });
        el.modal.classList.remove('hidden');
    }

    function closeModal() {
        el.modal.classList.add('hidden');
        modalActions = [];
    }

    function modalOpen() {
        return !el.modal.classList.contains('hidden');
    }

    // ---------- rendering ----------
    function sameCell(a, r, c) {
        return a && a[0] === r && a[1] === c;
    }

    function previewCells() {
        if (state.phase !== 'placement' || !state.hover) return null;
        const def = E.FLEET[state.player.ships.length];
        if (!def) return null;
        const [r, c] = state.hover;
        const ok = E.canPlace(state.player, r, c, def.size, state.horizontal);
        const keys = new Set(E.shipCells(r, c, def.size, state.horizontal)
            .filter(([a, b]) => E.inBounds(a, b))
            .map(([a, b]) => a * E.BOARD_SIZE + b));
        return { ok, keys };
    }

    function renderBoard(key, board, isEnemy) {
        const preview = isEnemy ? null : previewCells();
        const last = isEnemy ? state.lastPlayerShot : state.lastAiShot;
        for (let r = 0; r < E.BOARD_SIZE; r++) {
            for (let c = 0; c < E.BOARD_SIZE; c++) {
                const cell = cellEls[key][r][c];
                const shipIndex = board.shipAt[r][c];
                const ship = shipIndex === -1 ? null : board.ships[shipIndex];
                const shot = board.shots[r][c];
                const sunk = ship && E.isSunk(ship);
                const cls = ['cell'];
                if (ship && (!isEnemy || sunk || state.phase === 'over')) cls.push('ship');
                if (isEnemy && ship && !shot && state.phase === 'over') cls.push('revealed');
                if (shot === 'miss') cls.push('miss');
                if (shot === 'hit') cls.push(sunk ? 'sunk' : 'hit');
                if (sameCell(last, r, c)) cls.push('last-shot');
                if (isEnemy && sameCell(state.hint, r, c)) cls.push('hint');
                if (preview && preview.keys.has(r * E.BOARD_SIZE + c)) cls.push(preview.ok ? 'preview-ok' : 'preview-bad');
                cell.className = cls.join(' ');
                let label = E.coordLabel(r, c);
                if (shot === 'miss') label += ' miss';
                else if (shot === 'hit') label += sunk ? ' sunk' : ' hit';
                else if (ship && !isEnemy) label += ' ' + ship.name;
                cell.setAttribute('aria-label', label);
            }
        }
    }

    function renderFleet(list, board, isEnemy) {
        list.innerHTML = '';
        E.FLEET.forEach(def => {
            const ship = board.ships.find(s => s.name === def.name);
            const li = document.createElement('li');
            const sunk = ship && E.isSunk(ship);
            if (sunk) li.classList.add('sunk');
            if (!isEnemy && !ship) li.classList.add('pending');
            const pips = document.createElement('span');
            pips.className = 'pips';
            for (let i = 0; i < def.size; i++) {
                const p = document.createElement('i');
                if (!isEnemy && ship && i < ship.hits) p.className = 'pip-hit';
                if (sunk) p.className = 'pip-hit';
                pips.appendChild(p);
            }
            const name = document.createElement('span');
            name.textContent = def.name;
            li.append(name, pips);
            list.appendChild(li);
        });
    }

    function render() {
        renderBoard('player', state.player, false);
        renderBoard('enemy', state.enemy, true);
        renderFleet(el.playerFleet, state.player, false);
        renderFleet(el.aiFleet, state.enemy, true);

        const turnText = {
            placement: 'DEPLOY YOUR FLEET',
            player: 'YOUR TURN',
            ai: "COMPUTER'S TURN...",
            over: 'GAME OVER'
        };
        el.turn.textContent = turnText[state.phase];
        el.turn.dataset.phase = state.phase;
        el.playerLight.classList.toggle('on', state.phase === 'player' || state.phase === 'placement');
        el.aiLight.classList.toggle('on', state.phase === 'ai');
        el.aiBoard.classList.toggle('locked', state.phase !== 'player');
        el.playerBoard.classList.toggle('placing', state.phase === 'placement');

        el.difficultyLabel.textContent = AI.DIFFICULTIES[state.difficulty];
        el.difficultyBtn.classList.toggle('locked', state.phase !== 'placement');

        el.placementPanel.classList.toggle('hidden', state.phase !== 'placement');
        if (state.phase === 'placement') {
            el.placementText.textContent = placementPrompt();
            el.startBtn.disabled = !E.isFleetComplete(state.player);
            el.rotateBtn.innerHTML = `<u>R</u>otate: ${state.horizontal ? 'Horiz' : 'Vert'}`;
        }

        el.hintBtn.innerHTML = `<u>H</u>int (${state.hintsLeft})`;
        el.soundBtn.innerHTML = `<u>S</u>ound: ${Sound.isEnabled() ? 'On' : 'Off'}`;

        const s = state.stats;
        const acc = s.shots ? Math.round((s.hits / s.shots) * 100) : 0;
        el.stats.innerHTML =
            `<div>YOUR SHOTS <b>${s.shots}</b></div><div>HITS <b>${s.hits}</b></div>` +
            `<div>ACCURACY <b>${acc}%</b></div><div>CPU SHOTS <b>${s.aiShots}</b></div>`;
    }

    // ---------- input ----------
    function onKey(e) {
        if (e.ctrlKey || e.metaKey || e.altKey) return;
        const key = e.key.toLowerCase();
        if (modalOpen()) {
            const match = modalActions.find(b => b.key === key);
            if (match) { e.preventDefault(); match.action(); }
            else if (key === 'escape') { e.preventDefault(); closeModal(); }
            return;
        }
        const isButton = e.target && e.target.tagName === 'BUTTON';
        const actions = {
            r: rotate, a: randomFleet, c: clearFleet, d: cycleDifficulty,
            n: requestNewGame, h: useHint, s: toggleSound, e: requestExit
        };
        if (actions[key]) { e.preventDefault(); actions[key](); }
        else if (key === 'enter' && !isButton && state.phase === 'placement') { e.preventDefault(); startBattle(); }
    }

    function init() {
        buildBoard(el.playerBoard, 'player', placeAt);
        buildBoard(el.aiBoard, 'enemy', fireAtEnemy);
        el.playerBoard.addEventListener('mouseleave', () => { state.hover = null; render(); });
        el.playerBoard.addEventListener('contextmenu', e => {
            if (state.phase === 'placement') { e.preventDefault(); rotate(); }
        });
        el.rotateBtn.addEventListener('click', rotate);
        el.randomBtn.addEventListener('click', randomFleet);
        el.clearBtn.addEventListener('click', clearFleet);
        el.startBtn.addEventListener('click', startBattle);
        el.newBtn.addEventListener('click', requestNewGame);
        el.hintBtn.addEventListener('click', useHint);
        el.soundBtn.addEventListener('click', toggleSound);
        el.exitBtn.addEventListener('click', requestExit);
        el.difficultyBtn.addEventListener('click', cycleDifficulty);
        el.modal.addEventListener('click', e => { if (e.target === el.modal) closeModal(); });
        document.addEventListener('keydown', onKey);
        newGame();
    }

    init();
})();

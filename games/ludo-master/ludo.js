const players = ['green', 'yellow', 'blue', 'red'];
let activePlayers = ['green', 'yellow', 'blue', 'red'];
const playerNames = { 'green': 'সবুজ', 'yellow': 'হলুদ', 'blue': 'নীল', 'red': 'লাল' };

let currentPlayerIndex = 0;
let gameState = 'waiting_for_mode'; // waiting_for_mode, waiting_for_roll, rolling, waiting_for_move, moving
let isOnlineMode = false;
let myColor = null;
let currentRoomId = null;
let db = null;
let hasGameStarted = false;
let myPlayerId = localStorage.getItem('ludoPlayerName');
if (myPlayerId) {
    // Fix for older names that might have # saved in localStorage
    myPlayerId = myPlayerId.replace('#', '-');
    localStorage.setItem('ludoPlayerName', myPlayerId);
}

let turnTimer = null;
let turnTimeLeft = 15;
let currentDiceValue = null;

const isBot = {
    'green': false,
    'yellow': false,
    'blue': false,
    'red': false
};

window.customAlert = function(msg, reloadOnClose = false) {
    let modal = document.getElementById('custom-alert-modal');
    if (modal) {
        document.getElementById('custom-alert-msg').innerText = msg;
        modal.style.display = 'flex';
        let btn = modal.querySelector('button');
        btn.onclick = () => {
            modal.style.display = 'none';
            if (reloadOnClose) location.reload();
        };
    } else {
        alert(msg);
        if (reloadOnClose) location.reload();
    }
};

const tokenPositions = {
    'green': [-1, -1, -1, -1],
    'yellow': [-1, -1, -1, -1],
    'blue': [-1, -1, -1, -1],
    'red': [-1, -1, -1, -1]
};

const homePositions = {
    'green': [ [13.3, 13.3], [26.6, 13.3], [13.3, 26.6], [26.6, 26.6] ],
    'yellow': [ [73.3, 13.3], [86.6, 13.3], [73.3, 26.6], [86.6, 26.6] ],
    'blue': [ [73.3, 73.3], [86.6, 73.3], [73.3, 86.6], [86.6, 86.6] ],
    'red': [ [13.3, 73.3], [26.6, 73.3], [13.3, 86.6], [26.6, 86.6] ]
};

const globalPath = [
    [1, 6], [2, 6], [3, 6], [4, 6], [5, 6], // left arm
    [6, 5], [6, 4], [6, 3], [6, 2], [6, 1], [6, 0], // top up
    [7, 0], [8, 0], // top right
    [8, 1], [8, 2], [8, 3], [8, 4], [8, 5], // top down
    [9, 6], [10, 6], [11, 6], [12, 6], [13, 6], [14, 6], // right arm
    [14, 7], [14, 8], // right down
    [13, 8], [12, 8], [11, 8], [10, 8], [9, 8], // right left
    [8, 9], [8, 10], [8, 11], [8, 12], [8, 13], [8, 14], // bottom down
    [7, 14], [6, 14], // bottom left
    [6, 13], [6, 12], [6, 11], [6, 10], [6, 9], // bottom up
    [5, 8], [4, 8], [3, 8], [2, 8], [1, 8], [0, 8], // left arm
    [0, 7], [0, 6] // left up
];

const playerPathMap = {
    'green': { startIdx: 0, homeStretch: [[1, 7], [2, 7], [3, 7], [4, 7], [5, 7], [7, 7]] },
    'yellow': { startIdx: 13, homeStretch: [[7, 1], [7, 2], [7, 3], [7, 4], [7, 5], [7, 7]] },
    'blue': { startIdx: 26, homeStretch: [[13, 7], [12, 7], [11, 7], [10, 7], [9, 7], [7, 7]] },
    'red': { startIdx: 39, homeStretch: [[7, 13], [7, 12], [7, 11], [7, 10], [7, 9], [7, 7]] }
};

const safeCells = [
    [1, 6], [6, 2], [8, 1], [12, 6], [13, 8], [8, 12], [6, 13], [2, 8]
];

function isSafeZone(c, r) {
    return safeCells.some(cell => cell[0] === c && cell[1] === r);
}

function getPos(c, r) {
    return [(c + 0.5) * (100 / 15), (r + 0.5) * (100 / 15)];
}

function getCell(color, pos) {
    if (pos >= 0 && pos <= 50) return globalPath[(playerPathMap[color].startIdx + pos) % 52];
    if (pos >= 51 && pos <= 56) return playerPathMap[color].homeStretch[pos - 51];
    return null;
}

const board = document.getElementById('ludo-board');
const rollBtns = {
    'green': document.getElementById('panel-green'),
    'yellow': document.getElementById('panel-yellow'),
    'blue': document.getElementById('panel-blue'),
    'red': document.getElementById('panel-red')
};
const dice3D = {
    'green': document.getElementById('main-dice'),
    'yellow': document.getElementById('main-dice'),
    'blue': document.getElementById('main-dice'),
    'red': document.getElementById('main-dice')
};
const diceRotations = { 'green': {x:0, y:0}, 'yellow': {x:0, y:0}, 'blue': {x:0, y:0}, 'red': {x:0, y:0} };

// ----------------- ANIMATION HELPERS -----------------
function showFloatingEmoji(emoji, x, y) {
    let el = document.createElement('div');
    el.innerText = emoji;
    el.className = 'floating-emoji';
    el.style.left = x + '%';
    el.style.top = y + '%';
    board.appendChild(el);
    setTimeout(() => el.remove(), 2000);
}

function showWinScreen(color, customMessage = "অভিনন্দন!") {
    let currentName = document.getElementById('name-' + color).innerText || playerNames[color];
    let el = document.createElement('div');
    el.className = 'win-overlay';
    
    el.innerHTML = `
        <div class="trophy">🏆</div>
        <h1 style="color: #fff">${currentName} প্রথম হয়েছে!</h1>
        <p style="color: #ffcccc; font-size: 24px; margin-top: -10px;">${customMessage}</p>
        <button onclick="location.reload()" style="margin-top:20px; padding: 15px 30px; font-size:20px; cursor:pointer; border-radius:10px; border:none; background:#fff; color:#000; font-weight:bold; font-family: 'Hind Siliguri', sans-serif;">আবার খেলুন</button>
    `;
    document.body.appendChild(el);
    
    if (customMessage.includes('ডিসকানেক্ট')) {
        setTimeout(() => location.reload(), 3000);
    }

    // Confetti generator
    for(let i=0; i<80; i++) {
        let conf = document.createElement('div');
        conf.className = 'confetti';
        conf.style.left = Math.random() * 100 + 'vw';
        conf.style.animationDuration = (Math.random() * 2 + 2) + 's';
        conf.style.animationDelay = (Math.random() * 2) + 's';
        conf.style.backgroundColor = `hsl(${Math.random() * 360}, 100%, 50%)`;
        document.body.appendChild(conf);
    }
}
// -----------------------------------------------------

function createTokens() {
    players.forEach(color => {
        homePositions[color].forEach((pos, i) => {
            let token = document.createElement('div');
            token.className = `token ${color}`;
            token.id = `${color}-${i}`;
            board.appendChild(token);
        });
    });
    updateAllTokenPositions();
}

function updateAllTokenPositions() {
    let cellCounts = {};
    let tokenMeta = [];
    
    players.forEach(color => {
        tokenPositions[color].forEach((pos, i) => {
            if (pos === 56) {
                tokenMeta.push({color, i, pos: [-100, -100], scale: 1}); // Hide finished
                return;
            }
            if (pos === -1) {
                tokenMeta.push({color, i, pos: homePositions[color][i], scale: 1});
            } else {
                let cell = getCell(color, pos);
                let key = `${cell[0]},${cell[1]}`;
                if (!cellCounts[key]) cellCounts[key] = [];
                cellCounts[key].push({color, i});
            }
        });
    });

    for (let key in cellCounts) {
        let list = cellCounts[key];
        let [c, r] = key.split(',').map(Number);
        let baseCoords = getPos(c, r);
        
        if (list.length === 1) {
            tokenMeta.push({color: list[0].color, i: list[0].i, pos: baseCoords, scale: 1});
        } else {
            list.forEach((t, idx) => {
                let offsetX = idx % 2 === 0 ? -1.5 : 1.5;
                let offsetY = idx < 2 ? -1.5 : 1.5;
                tokenMeta.push({
                    color: t.color, i: t.i, 
                    pos: [baseCoords[0] + offsetX, baseCoords[1] + offsetY], 
                    scale: 0.8
                });
            });
        }
    }

    tokenMeta.forEach(meta => {
        let el = document.getElementById(`${meta.color}-${meta.i}`);
        if (meta.pos[0] === -100 || !activePlayers.includes(meta.color)) {
            el.style.display = 'none';
        } else {
            el.style.display = 'block';
            el.style.left = meta.pos[0] + '%';
            el.style.top = meta.pos[1] + '%';
            el.style.transform = `translate(-50%, -50%) scale(${meta.scale})`;
        }
    });
}

function startTurnTimer() {
    stopTurnTimer();
    if (!isOnlineMode) return;
    
    let timerContainer = document.getElementById('turn-timer-container');
    let timerSpan = document.getElementById('turn-timer');
    if (timerContainer && timerSpan) {
        timerContainer.style.display = 'block';
        turnTimeLeft = 15;
        timerSpan.innerText = turnTimeLeft + 's';
        
        turnTimer = setInterval(() => {
            turnTimeLeft--;
            timerSpan.innerText = turnTimeLeft + 's';
            
            if (turnTimeLeft <= 0) {
                stopTurnTimer();
                handleTurnTimeout();
            }
        }, 1000);
    }
}

function stopTurnTimer() {
    if (turnTimer) {
        clearInterval(turnTimer);
        turnTimer = null;
    }
    let timerContainer = document.getElementById('turn-timer-container');
    if (timerContainer) {
        timerContainer.style.display = 'none';
    }
}

function handleTurnTimeout() {
    if (!isOnlineMode || !currentRoomId) return;
    
    let currentColor = players[currentPlayerIndex];
    let isMaster = false;
    
    // Check if I am the master client (first human player)
    db.ref('rooms/' + currentRoomId + '/players').once('value').then(snap => {
        let p = snap.val() || {};
        let currentOnlinePlayers = Object.keys(p);
        let firstHuman = currentOnlinePlayers.find(c => p[c] !== 'bot');
        if (myColor === firstHuman) {
            isMaster = true;
        }
        
        // Auto-play if I am the current player OR if I am the master and the current player didn't play
        if (myColor === currentColor || isMaster) {
            window.isForcedAutoMove = true;
            if (gameState === 'waiting_for_roll') {
                rollDice(currentColor, true); // true indicates auto-roll
            } else if (gameState === 'waiting_for_move') {
                // Pick a move like a bot
                let validMoves = evaluateValidMoves(currentColor, currentDiceValue || 1);
                if (validMoves.length > 0) {
                    botMove(currentColor, validMoves, currentDiceValue || 1);
                } else {
                    switchTurn();
                    syncGameState();
                }
            }
        }
    });
}

function updateTurnVisuals() {
    stopTurnTimer();
    gameState = 'waiting_for_roll';
    players.forEach(color => {
        if(rollBtns[color]) {
            rollBtns[color].classList.remove('active', 'active-turn', 'has-result', 'remote-turn');
        }
    });

    let currentColor = players[currentPlayerIndex];
    if(rollBtns[currentColor]) {
        rollBtns[currentColor].classList.add('active-turn');
    }
    
    const activeDiceArea = document.getElementById('active-dice-area');
    const turnIndicator = document.getElementById('turn-indicator');
    
    if (activeDiceArea) {
        activeDiceArea.className = 'active-dice-area waiting'; 
        if (!isBot[currentColor] && (!isOnlineMode || currentColor === myColor)) {
            activeDiceArea.classList.add('active-' + currentColor);
        }
    }
    
    if (turnIndicator) {
        let currentName = document.getElementById('name-' + currentColor).innerText || playerNames[currentColor];
        
        let colorHex = { 'green': '#2ecc71', 'yellow': '#f1c40f', 'blue': '#3498db', 'red': '#e74c3c' }[currentColor];
        
        if (!isBot[currentColor] && (!isOnlineMode || currentColor === myColor) && (currentName === "আপনি" || currentName === myPlayerId || currentName === "খেলোয়াড়১" && currentColor === 'green')) {
            turnIndicator.innerText = "আপনার পালা";
        } else {
            turnIndicator.innerText = currentName + " এর পালা";
        }
        
        turnIndicator.style.color = colorHex;
        turnIndicator.style.textShadow = `0 0 5px ${colorHex}`;
        turnIndicator.style.opacity = '1';
    }

    if (isBot[currentColor]) {
        // Auto roll for bot after short delay
        setTimeout(() => {
            if (gameState === 'waiting_for_roll') {
                rollDice(currentColor);
            }
        }, 800);
    } else {
        startTurnTimer();
    }
}

function switchTurn() {
    do {
        currentPlayerIndex = (currentPlayerIndex + 1) % players.length;
    } while (!activePlayers.includes(players[currentPlayerIndex]));
    updateTurnVisuals();
}

function evaluateValidMoves(color, diceValue) {
    let validMoves = [];
    tokenPositions[color].forEach((pos, i) => {
        if (pos === -1) {
            if (diceValue === 6) validMoves.push(i);
        } else if (pos >= 0) {
            if (pos + diceValue <= 56) validMoves.push(i);
        }
    });
    return validMoves;
}

function setupTokenClicks(color, validMoves, diceValue) {
    let allValidAreInBase = validMoves.every(i => tokenPositions[color][i] === -1);
    
    if (validMoves.length === 1 || (allValidAreInBase && validMoves.length > 0)) {
        // Auto move if there is only one choice, or if all choices are just deploying a new token (which are identical)
        gameState = 'moving';
        setTimeout(() => moveToken(color, validMoves[0], diceValue), 300);
    } else {
        gameState = 'waiting_for_move';
        startTurnTimer();
        validMoves.forEach(i => {
            let el = document.getElementById(`${color}-${i}`);
            el.classList.add('clickable');
            
            // Named handler for proper cleanup
            function tokenClickHandler(e) {
                e.preventDefault();
                e.stopPropagation();
                moveToken(color, i, diceValue);
            }
            
            el.onclick = tokenClickHandler;
            el.ontouchstart = tokenClickHandler;
            el._tokenHandler = tokenClickHandler; 
        });
    }
}

function moveToken(color, i, diceValue) {
    stopTurnTimer();
    gameState = 'moving';
    document.querySelectorAll('.token').forEach(t => {
        t.classList.remove('clickable');
        t.onclick = null;
        t.ontouchstart = null;
        delete t._tokenHandler;
    });

    let currentPos = tokenPositions[color][i];
    let targetPos = currentPos === -1 ? 0 : currentPos + diceValue;
    let currentStep = currentPos;
    
    let interval = setInterval(() => {
        if (currentStep === -1) currentStep = 0;
        else currentStep++;
        
        tokenPositions[color][i] = currentStep;
        updateAllTokenPositions();
        
        if (currentStep === targetPos) {
            clearInterval(interval);
            handleMoveEnd(color, i, diceValue);
        }
    }, 250);
}

function handleMoveEnd(color, i, diceValue) {
    let finalPos = tokenPositions[color][i];
    let extraTurn = false;
    let captured = false;
    let finalCoords = [-1, -1];
    
    if (finalPos === 56) {
        extraTurn = true;
        // Animation for reaching home
        showFloatingEmoji('⭐', 50, 50);
    } else {
        let finalCell = getCell(color, finalPos);
        finalCoords = getPos(finalCell[0], finalCell[1]);
        
        if (!isSafeZone(finalCell[0], finalCell[1])) {
            players.forEach(oppColor => {
                if (oppColor !== color) {
                    tokenPositions[oppColor].forEach((oppPos, oppI) => {
                        if (oppPos >= 0 && oppPos <= 50) {
                            let oppCell = getCell(oppColor, oppPos);
                            if (oppCell[0] === finalCell[0] && oppCell[1] === finalCell[1]) {
                                tokenPositions[oppColor][oppI] = -1; // Captured!
                                captured = true;
                            }
                        }
                    });
                }
            });
        }
    }

    if (captured) {
        updateAllTokenPositions();
        extraTurn = true;
        // Animation for sad face
        showFloatingEmoji('😭', finalCoords[0], finalCoords[1]);
    }
    
    if (diceValue === 6) extraTurn = true;

    if (tokenPositions[color].every(p => p === 56)) {
        // Winning animation
        showWinScreen(color);
        return; // Game over for this player
    }

    if (extraTurn) {
        updateTurnVisuals(); // stay on current player
        rollBtns[color].classList.remove('has-result'); // Hide previous result, show blank dice
    } else {
        switchTurn();
    }
    
    if (isOnlineMode && (myColor === color || isBot[color] || window.isForcedAutoMove)) {
        syncGameState();
        window.isForcedAutoMove = false;
    }
}

function syncGameState() {
    if (isOnlineMode && currentRoomId) {
        db.ref('rooms/' + currentRoomId + '/gameState').update({
            currentPlayerIndex: currentPlayerIndex,
            tokenPositions: tokenPositions
        });
    }
}

function getDiceRotation(value, color) {
    let extraX = (Math.floor(Math.random() * 3) + 2) * 360;
    let extraY = (Math.floor(Math.random() * 3) + 2) * 360;
    let rotX = Math.floor(diceRotations[color].x / 360) * 360 + extraX;
    let rotY = Math.floor(diceRotations[color].y / 360) * 360 + extraY;

    switch(value) {
        case 1: break; case 6: rotX += 180; break;
        case 3: rotY -= 90; break; case 4: rotY += 90; break;
        case 2: rotX -= 90; break; case 5: rotX += 90; break;
    }
    diceRotations[color].x = rotX; diceRotations[color].y = rotY;
    return `translateZ(-30px) rotateX(${rotX}deg) rotateY(${rotY}deg)`;
}

function rollDice(color, isAuto = false) {
    if (color !== players[currentPlayerIndex] || gameState !== 'waiting_for_roll') return;

    stopTurnTimer();
    gameState = 'rolling';
    rollBtns[color].classList.add('rolling', 'has-result');
    const activeDiceArea = document.getElementById('active-dice-area');
    if(activeDiceArea) {
        activeDiceArea.classList.remove('waiting');
        activeDiceArea.classList.add('rolling');
        document.getElementById('dice-visual').innerHTML = '🎲';
    }
    
    // Increased probability for rolling a 6
    let allInBase = tokenPositions[color].every(pos => pos === -1);
    let chanceForSix = allInBase ? 0.35 : 0.20; // 35% chance if all tokens are stuck in base
    
    let diceValue;
    if (Math.random() < chanceForSix) {
        diceValue = 6;
    } else {
        diceValue = Math.floor(Math.random() * 5) + 1;
    }
    currentDiceValue = diceValue;

    if (isOnlineMode && (myColor === color || isBot[color] || isAuto)) {
        db.ref('rooms/' + currentRoomId + '/lastRoll').set({
            color: color,
            value: diceValue,
            timestamp: Date.now()
        });
    }

    setTimeout(() => {
        rollBtns[color].classList.remove('rolling');
        const activeDiceArea = document.getElementById('active-dice-area');
        if(activeDiceArea) activeDiceArea.classList.remove('rolling');
        document.getElementById('dice-visual').innerHTML = `<div class="dice-result-badge">${diceValue}</div>`;
        
        let validMoves = evaluateValidMoves(color, diceValue);
        
        if (validMoves.length === 0) {
            setTimeout(() => {
                switchTurn();
                if (isOnlineMode && (myColor === color || isBot[color])) syncGameState();
            }, 1000);
        } else {
            if (isBot[color]) {
                // AI picks move
                setTimeout(() => botMove(color, validMoves, diceValue), 600);
            } else {
                setupTokenClicks(color, validMoves, diceValue);
            }
        }
    }, 1200); // matches CSS animation duration
}

function botMove(color, validMoves, diceValue) {
    let bestMove = validMoves[0];
    let bestScore = -1;

    validMoves.forEach(i => {
        let currentPos = tokenPositions[color][i];
        let targetPos = currentPos === -1 ? 0 : currentPos + diceValue;
        let score = 0;

        if (targetPos === 56) score = 100; // Priority 1: Home
        else if (currentPos === -1) score = 80; // Priority 2: Deploy
        else {
            let targetCell = getCell(color, targetPos);
            if (targetCell) {
                // Priority 3: Capture
                if (!isSafeZone(targetCell[0], targetCell[1])) {
                    let canCapture = false;
                    players.forEach(oppColor => {
                        if (oppColor !== color) {
                            tokenPositions[oppColor].forEach(oppPos => {
                                if (oppPos >= 0 && oppPos <= 50) {
                                    let oppCell = getCell(oppColor, oppPos);
                                    if (oppCell[0] === targetCell[0] && oppCell[1] === targetCell[1]) {
                                        canCapture = true;
                                    }
                                }
                            });
                        }
                    });
                    if (canCapture) score = 90;
                }
            }
            if (score === 0) {
                // Priority 4: Advance furthest
                score = currentPos;
            }
        }

        if (score > bestScore) {
            bestScore = score;
            bestMove = i;
        }
    });

    moveToken(color, bestMove, diceValue);
}

players.forEach(color => {
    rollBtns[color].addEventListener('click', () => {
        if (!isBot[color]) {
            if(isOnlineMode && color !== myColor) {
                showWrongTurn();
                return;
            }
            rollDice(color);
        }
    });
});

createTokens();
// Initial reset removed
function showWrongTurn() {
    let popup = document.getElementById('wrong-turn-popup');
    if (popup) {
        popup.style.display = 'block';
        
        // Remove animation and force reflow to allow re-triggering animation on consecutive clicks
        popup.style.animation = 'none';
        popup.offsetHeight; 
        popup.style.animation = 'wrongShake 0.4s';
        
        if ('speechSynthesis' in window) {
            window.speechSynthesis.cancel(); // Stop previous if spamming
            let msg = new SpeechSynthesisUtterance("No no no");
            msg.rate = 1.3;
            msg.pitch = 1.2;
            window.speechSynthesis.speak(msg);
        }
        
        setTimeout(() => {
            popup.style.display = 'none';
        }, 1500);
    }
}

// Initialize/reset game state
function initGame() {
    // Reset all token positions to home
    players.forEach(color => {
        for (let i = 0; i < 4; i++) {
            tokenPositions[color][i] = -1;
        }
    });

    // Reset current player to the first active player
    currentPlayerIndex = players.indexOf(activePlayers[0]);

    // Reset game state
    gameState = 'waiting_for_roll';
    hasGameStarted = true;

    // Make sure all panels are visible for active players and hidden for inactive
    players.forEach(color => {
        if (activePlayers.includes(color)) {
            document.getElementById('panel-' + color).style.visibility = 'visible';
        } else {
            document.getElementById('panel-' + color).style.visibility = 'hidden';
        }
    });

    // Update token display
    updateAllTokenPositions();
}

// Mode selection logic
if(document.getElementById('btn-manual')) document.getElementById('btn-manual').onclick = () => {
    document.getElementById('player-count-modal').style.display = 'flex';
};

window.startManualGame = function(count) {
    document.getElementById('player-count-modal').style.display = 'none';
    
    if (count === 2) {
        activePlayers = ['green', 'blue'];
        document.getElementById('name-green').innerText = "সবুজ";
        document.getElementById('name-yellow').innerText = "";
        document.getElementById('name-blue').innerText = "নীল";
        document.getElementById('name-red').innerText = "";
    } else if (count === 3) {
        activePlayers = ['green', 'yellow', 'red'];
        document.getElementById('name-green').innerText = "সবুজ";
        document.getElementById('name-yellow').innerText = "হলুদ";
        document.getElementById('name-blue').innerText = "";
        document.getElementById('name-red').innerText = "লাল";
    } else {
        activePlayers = ['green', 'yellow', 'blue', 'red'];
        document.getElementById('name-green').innerText = "সবুজ";
        document.getElementById('name-yellow').innerText = "হলুদ";
        document.getElementById('name-blue').innerText = "নীল";
        document.getElementById('name-red').innerText = "লাল";
    }
    
    // Hide panels for inactive players
    ['green', 'yellow', 'blue', 'red'].forEach(color => {
        let panel = document.getElementById('panel-' + color);
        if (panel) {
            panel.style.visibility = activePlayers.includes(color) ? 'visible' : 'hidden';
        }
    });
    
    navigateTo('screen-game');
    initGame();
    updateTurnVisuals();
};

if(document.getElementById('btn-robot')) document.getElementById('btn-robot').onclick = () => {
    activePlayers = ['green', 'blue'];
    isBot['blue'] = true;
    
    document.getElementById('name-green').innerText = "আপনি";
    document.getElementById('name-blue').innerText = "রোবট";
    document.getElementById('name-yellow').innerText = "";
    document.getElementById('name-red').innerText = "";
    
    // Hide inactive panels
    document.getElementById('panel-yellow').style.visibility = 'hidden';
    document.getElementById('panel-red').style.visibility = 'hidden';
    
    // Update tokens immediately
    updateAllTokenPositions();
    
    navigateTo('screen-game');
    initGame();
    updateTurnVisuals();
};

// Online Mode UI Logic
if(document.getElementById('btn-online')) document.getElementById('btn-online').onclick = () => {
    if (!myPlayerId) {
        document.getElementById('player-name-modal').style.display = 'flex';
    } else {
        showOnlineLobby();
    }
};

if(document.getElementById('btn-save-name')) document.getElementById('btn-save-name').onclick = () => {
    let name = document.getElementById('player-name-input').value.trim();
    if (name === '') {
        alert("দয়া করে একটি নাম দিন!");
        return;
    }
    // Append a random 4-digit code to make it unique (Firebase doesn't allow #)
    let randomCode = Math.floor(1000 + Math.random() * 9000);
    myPlayerId = name + "-" + randomCode;
    localStorage.setItem('ludoPlayerName', myPlayerId);
    
    document.getElementById('player-name-modal').style.display = 'none';
    showOnlineLobby();
};

function showOnlineLobby() {
    document.getElementById('online-lobby-menu').style.display = 'flex';
    document.getElementById('my-player-id').innerText = myPlayerId;
    initFirebase();
}

if(document.getElementById('btn-back-to-menu-from-lobby')) document.getElementById('btn-back-to-menu-from-lobby').onclick = () => {
    document.getElementById('online-lobby-menu').style.display = 'none';
    document.getElementById('start-menu').style.display = 'flex';
    if (db) {
        db.ref('lobby/' + myPlayerId).remove();
    }
};

// Firebase Logic
function initFirebase() {
    if (firebase.apps.length === 0) {
        // We add dummy values for apiKey, etc. because the Firebase SDK sometimes throws an error if they are entirely missing, even when the Database is public.
        const firebaseConfig = {
            apiKey: "AIzaSyDummyKeyForPublicDatabase12345",
            authDomain: "khelaghorludu.firebaseapp.com",
            databaseURL: "https://khelaghorludu-default-rtdb.asia-southeast1.firebasedatabase.app/",
            projectId: "khelaghorludu",
            storageBucket: "khelaghorludu.appspot.com",
            messagingSenderId: "123456789012",
            appId: "1:123456789012:web:abcdef123456"
        };
        try {
            firebase.initializeApp(firebaseConfig);
            db = firebase.database();
            joinLobby();
        } catch(e) {
            document.getElementById('lobby-status').innerText = "Firebase Error: " + e.message;
            console.error(e);
        }
    } else {
        db = firebase.database();
        joinLobby();
    }
}

function joinLobby() {
    let myLobbyRef = db.ref('lobby/' + myPlayerId);
    // Remove from lobby on disconnect
    myLobbyRef.onDisconnect().remove();
    // Add to lobby
    myLobbyRef.set(true);

    // Listen to all online players
    db.ref('lobby').on('value', snapshot => {
        let players = snapshot.val() || {};
        let listEl = document.getElementById('online-players-list');
        listEl.innerHTML = '';
        
        let count = 0;
        for (let pid in players) {
            let inviteStatus = window.sentInvites && window.sentInvites[pid] ? window.sentInvites[pid] : '';
            if (pid !== myPlayerId && (players[pid] !== 'playing' || inviteStatus)) {
                count++;
                let li = document.createElement('li');
                let btnStyle = 'background: linear-gradient(90deg, #6c5ce7, #d100ff); color: #fff; border: none; padding: 8px 18px; border-radius: 8px; font-weight: 600; cursor: pointer; font-family: inherit; font-size: 14px; box-shadow: 0 4px 10px rgba(108, 92, 231, 0.4);';
                let btnText = 'ইনভাইট';
                let disabled = '';
                if (inviteStatus === 'pending') {
                    btnStyle = 'background: rgba(255,255,255,0.2); color: #aaa; border: none; padding: 8px 18px; border-radius: 8px; font-weight: 600; cursor: not-allowed; font-family: inherit; font-size: 14px;';
                    btnText = 'পাঠানো হয়েছে';
                    disabled = 'disabled';
                } else if (inviteStatus === 'accepted') {
                    btnStyle = 'background: #2ecc71; color: #fff; border: none; padding: 8px 18px; border-radius: 8px; font-weight: 600; cursor: not-allowed; font-family: inherit; font-size: 14px; box-shadow: 0 4px 10px rgba(46, 204, 113, 0.4);';
                    btnText = 'যুক্ত হয়েছে';
                    disabled = 'disabled';
                }
                
                li.style.display = 'flex';
                li.style.justifyContent = 'space-between';
                li.style.alignItems = 'center';
                li.style.padding = '12px 15px';
                li.style.background = 'rgba(255, 255, 255, 0.05)';
                li.style.border = '1px solid rgba(255, 255, 255, 0.1)';
                li.style.borderRadius = '12px';
                
                let avatarList = ['avatar_male_1.png', 'avatar_female_1.png', 'avatar_male_2.png', 'avatar_female_2.png'];
                let charSum = 0;
                for (let i = 0; i < pid.length; i++) charSum += pid.charCodeAt(i);
                let avatarSrc = 'assets/' + avatarList[charSum % avatarList.length];

                li.innerHTML = `
                    <div style="display: flex; align-items: center; gap: 15px;">
                        <div style="width: 45px; height: 45px; border-radius: 50%; background: #333; border: 2px solid #3498db; overflow: hidden; box-shadow: 0 0 10px rgba(52, 152, 219, 0.5);">
                            <img src="${avatarSrc}" style="width: 100%; height: 100%; object-fit: cover;" onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><circle cx=%2250%22 cy=%2250%22 r=%2250%22 fill=%22%23ccc%22/></svg>'">
                        </div>
                        <div style="text-align: left;">
                            <h4 style="margin: 0; color: #fff; font-size: 16px; font-weight: 600;">${pid}</h4>
                        </div>
                    </div>
                    <button id="invite-btn-${pid}" onclick="sendInvite('${pid}', this)" style="${btnStyle}" ${disabled}>${btnText}</button>
                `;
                listEl.appendChild(li);
            }
        }
        let botNames = ['আকাশ', 'সুমাইয়া', 'সাদিয়া', 'নয়ন'];
        botNames.forEach(bot => {
            let li = document.createElement('li');
            let inviteStatus = window.sentInvites && window.sentInvites[bot] ? window.sentInvites[bot] : '';
            let btnStyle = 'background: linear-gradient(90deg, #6c5ce7, #d100ff); color: #fff; border: none; padding: 8px 18px; border-radius: 8px; font-weight: 600; cursor: pointer; font-family: inherit; font-size: 14px; box-shadow: 0 4px 10px rgba(108, 92, 231, 0.4);';
            let btnText = 'ইনভাইট';
            let disabled = '';
            if (inviteStatus === 'pending') {
                btnStyle = 'background: rgba(255,255,255,0.2); color: #aaa; border: none; padding: 8px 18px; border-radius: 8px; font-weight: 600; cursor: not-allowed; font-family: inherit; font-size: 14px;';
                btnText = 'পাঠানো হয়েছে';
                disabled = 'disabled';
            } else if (inviteStatus === 'accepted') {
                btnStyle = 'background: #2ecc71; color: #fff; border: none; padding: 8px 18px; border-radius: 8px; font-weight: 600; cursor: not-allowed; font-family: inherit; font-size: 14px; box-shadow: 0 4px 10px rgba(46, 204, 113, 0.4);';
                btnText = 'যুক্ত হয়েছে';
                disabled = 'disabled';
            }

            li.style.display = 'flex';
            li.style.justifyContent = 'space-between';
            li.style.alignItems = 'center';
            li.style.padding = '12px 15px';
            li.style.background = 'rgba(255, 255, 255, 0.05)';
            li.style.border = '1px solid rgba(255, 255, 255, 0.1)';
            li.style.borderRadius = '12px';

            let botAvatars = {
                'আকাশ': 'avatar_male_1.png',
                'সুমাইয়া': 'avatar_female_1.png',
                'সাদিয়া': 'avatar_female_2.png',
                'নয়ন': 'avatar_male_2.png'
            };
            let avatarSrc = 'assets/' + botAvatars[bot];

            li.innerHTML = `
                <div style="display: flex; align-items: center; gap: 15px;">
                    <div style="width: 45px; height: 45px; border-radius: 50%; background: #333; border: 2px solid #f1c40f; overflow: hidden; box-shadow: 0 0 10px rgba(241, 196, 15, 0.5);">
                        <img src="${avatarSrc}" style="width: 100%; height: 100%; object-fit: cover;" onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><circle cx=%2250%22 cy=%2250%22 r=%2250%22 fill=%22%23ccc%22/></svg>'">
                    </div>
                    <div style="text-align: left;">
                        <h4 style="margin: 0; color: #fff; font-size: 16px; font-weight: 600;">${bot}</h4>
                    </div>
                </div>
                <button id="invite-btn-${bot}" onclick="sendInvite('${bot}', this)" style="${btnStyle}" ${disabled}>${btnText}</button>
            `;
            listEl.appendChild(li);
            count++;
        });

        if (count === 0) {
            listEl.innerHTML = '<li style="text-align: center; color: #aaa; padding: 20px;">এই মুহূর্তে কেউ অনলাইনে নেই।</li>';
        }
    });

    // Listen for incoming invites
    db.ref('invites/' + myPlayerId).on('value', snapshot => {
        let invite = snapshot.val();
        if (invite && invite.status === 'pending' && !currentRoomId) {
            document.getElementById('inviter-name').innerText = invite.sender;
            document.getElementById('invite-modal').style.display = 'flex';
            
            document.getElementById('btn-accept-invite').onclick = () => {
                document.getElementById('invite-modal').style.display = 'none';
                db.ref('invites/' + myPlayerId).update({ status: 'accepted' });
                setTimeout(() => db.ref('invites/' + myPlayerId).remove(), 2000);
                joinRoomAsGuest(invite.roomId);
            };
            
            document.getElementById('btn-decline-invite').onclick = () => {
                document.getElementById('invite-modal').style.display = 'none';
                db.ref('invites/' + myPlayerId).update({ status: 'declined' });
                setTimeout(() => db.ref('invites/' + myPlayerId).remove(), 2000);
            };
        } else {
            document.getElementById('invite-modal').style.display = 'none';
        }
    });
}

let lobbyRoomListener = null;

window.sendInvite = function(receiverId, btn) {
    if (!currentRoomId) {
        let newRoomId = Math.random().toString(36).substring(2, 8).toUpperCase();
        currentRoomId = newRoomId;
        myColor = 'green';
        isOnlineMode = true;
        db.ref('lobby/' + myPlayerId).set('playing');
        
        let initialGameState = {
            currentPlayerIndex: 0,
            tokenPositions: tokenPositions,
            status: 'waiting'
        };

        // Create room first
        db.ref('rooms/' + currentRoomId).set({
            players: { green: true },
            names: { green: myPlayerId },
            gameState: initialGameState
        }).then(() => {
            db.ref('rooms/' + currentRoomId + '/players/green').onDisconnect().remove();
            
            // Show Start button
            document.getElementById('start-online-game-container').style.display = 'block';
            
            // Listen to players joining
            lobbyRoomListener = db.ref('rooms/' + currentRoomId + '/players').on('value', snap => {
                let p = snap.val();
                if(p) {
                    let count = Object.keys(p).length;
                    let btnStart = document.getElementById('btn-start-online-game');
                    if (btnStart) btnStart.innerText = `গেম শুরু করুন (${count}/4 জন যুক্ত)`;
                    
                    db.ref('rooms/' + currentRoomId + '/names').once('value').then(nameSnap => {
                        let names = nameSnap.val() || {};
                        let listHTML = '';
                        
                        // Clear invites for players who left
                        let currentNamesInRoom = Object.keys(p).map(c => names[c] || c);
                        if (window.sentInvites) {
                            for (let pid in window.sentInvites) {
                                if (window.sentInvites[pid] === 'accepted' && !currentNamesInRoom.includes(pid) && pid !== myPlayerId) {
                                    delete window.sentInvites[pid];
                                    let domBtn = document.getElementById('invite-btn-' + pid);
                                    if (domBtn) {
                                        domBtn.innerText = 'ইনভাইট';
                                        domBtn.style.backgroundColor = '#2196F3';
                                        domBtn.disabled = false;
                                        domBtn.style.cursor = 'pointer';
                                    }
                                }
                            }
                        }

                        Object.keys(p).forEach(c => {
                            let name = names[c] || c;
                            listHTML += `<li style="padding: 10px 5px; border-bottom: 1px solid rgba(255,255,255,0.1); color: #fff; font-weight: 600; font-size: 16px; display: flex; align-items: center; gap: 10px;">✅ ${name}</li>`;
                            
                            // Automatically disable the invite button if they are in the room
                            if (!window.sentInvites) window.sentInvites = {};
                            window.sentInvites[name] = 'accepted';
                            let domBtn = document.getElementById('invite-btn-' + name);
                            if (domBtn) {
                                domBtn.innerText = 'যুক্ত হয়েছে';
                                domBtn.style.backgroundColor = '#4CAF50';
                                domBtn.disabled = true;
                                domBtn.style.cursor = 'not-allowed';
                            }
                        });
                        let listEl = document.getElementById('joined-players-list');
                        if (listEl) listEl.innerHTML = listHTML;
                    });
                }
            });
            sendSingleInvite(receiverId, btn);
        });
    } else {
        sendSingleInvite(receiverId, btn);
    }
};

function sendSingleInvite(receiverId, btn) {
    if (btn) {
        btn.innerText = 'পাঠানো হয়েছে';
        btn.style.backgroundColor = 'gray';
        btn.disabled = true;
    }

    if (!window.sentInvites) window.sentInvites = {};
    window.sentInvites[receiverId] = 'pending';

    const isAiBot = ['আকাশ', 'সুমাইয়া', 'সাদিয়া', 'নয়ন'].includes(receiverId);
    if (isAiBot) {
        document.getElementById('lobby-status').innerText = `${receiverId} ইনভাইট গ্রহণ করছে...`;
        setTimeout(() => {
            // Check if bot is already in the room
            db.ref('rooms/' + currentRoomId + '/names').once('value').then(namesSnap => {
                let names = namesSnap.val() || {};
                if (Object.values(names).includes(receiverId)) {
                    window.sentInvites[receiverId] = 'accepted';
                    return; // Already joined
                }
                
                // Find available color
                db.ref('rooms/' + currentRoomId + '/players').once('value').then(snap => {
                    let p = snap.val() || {};
                    let currentOnline = Object.keys(p);
                    let availableColors = ['green', 'blue', 'yellow', 'red'].filter(c => !currentOnline.includes(c));
                    if (availableColors.length > 0) {
                        let botColor = availableColors[0];
                        isBot[botColor] = true;
                        
                        // Set name first, then player to avoid race condition where color name is shown
                        db.ref('rooms/' + currentRoomId + '/names/' + botColor).set(receiverId).then(() => {
                            db.ref('rooms/' + currentRoomId + '/players/' + botColor).set('bot'); // Save as 'bot' instead of true
                        });

                        document.getElementById('lobby-status').innerText = `${receiverId} রুমে জয়েন করেছে!`;
                        
                        window.sentInvites[receiverId] = 'accepted';
                        
                        if (btn) {
                            btn.innerText = 'যুক্ত হয়েছে';
                            btn.style.backgroundColor = '#4CAF50';
                            btn.disabled = true;
                            btn.style.cursor = 'not-allowed';
                        }
                    } else {
                        document.getElementById('lobby-status').innerText = 'রুম ফুল হয়ে গেছে!';
                        if (btn) {
                            btn.innerText = 'রুম ফুল';
                            btn.style.backgroundColor = '#f44336';
                            setTimeout(() => {
                                btn.innerText = 'ইনভাইট';
                                btn.style.backgroundColor = '#2196F3';
                                btn.disabled = false;
                            }, 2000);
                        }
                    }
                });
            });
        }, 1000);
        return;
    }

    if (!window.sentInvites) window.sentInvites = {};
    window.sentInvites[receiverId] = 'pending';

    db.ref('invites/' + receiverId).set({
        sender: myPlayerId,
        roomId: currentRoomId,
        timestamp: Date.now(),
        status: 'pending'
    });
    document.getElementById('lobby-status').innerText = `${receiverId} কে ইনভাইট পাঠানো হয়েছে...`;

    // Listen for invite responses
    let inviteRef = db.ref('invites/' + receiverId);
    let listener = inviteRef.on('value', snap => {
        let inviteData = snap.val();
        if (inviteData && inviteData.status === 'declined') {
            window.sentInvites[receiverId] = 'declined';
            let currentBtn = document.getElementById('invite-btn-' + receiverId) || btn;
            if (currentBtn) {
                currentBtn.innerText = 'বাতিল';
                currentBtn.style.backgroundColor = '#f44336';
                setTimeout(() => {
                    if (window.sentInvites[receiverId] === 'declined') delete window.sentInvites[receiverId];
                    let retryBtn = document.getElementById('invite-btn-' + receiverId) || currentBtn;
                    if (retryBtn) {
                        retryBtn.innerText = 'ইনভাইট';
                        retryBtn.style.backgroundColor = '#2196F3';
                        retryBtn.disabled = false;
                        retryBtn.style.cursor = 'pointer';
                    }
                }, 3000);
            }
            document.getElementById('lobby-status').innerText = `${receiverId} ইনভাইট বাতিল করেছে।`;
            inviteRef.off('value', listener);
        } else if (inviteData && inviteData.status === 'accepted') {
            window.sentInvites[receiverId] = 'accepted';
            let currentBtn = document.getElementById('invite-btn-' + receiverId) || btn;
            if (currentBtn) {
                currentBtn.innerText = 'যুক্ত হয়েছে';
                currentBtn.style.backgroundColor = '#4CAF50';
                currentBtn.disabled = true;
                currentBtn.style.cursor = 'not-allowed';
            }
            inviteRef.off('value', listener);
        }
    });
}

// Host clicks Start Game
if(document.getElementById('btn-start-online-game')) document.getElementById('btn-start-online-game').onclick = () => {
    db.ref('rooms/' + currentRoomId + '/players').once('value').then(snap => {
        let players = snap.val() || {};
        if (Object.keys(players).length < 2) {
            customAlert('কমপক্ষে ২ জন খেলোয়াড় প্রয়োজন গেম শুরু করার জন্য!');
            return;
        }
        
        if (lobbyRoomListener) {
            db.ref('rooms/' + currentRoomId + '/players').off('value', lobbyRoomListener);
        }
        document.getElementById('start-online-game-container').style.display = 'none';
        db.ref('rooms/' + currentRoomId + '/gameState').update({ status: 'playing' });
        listenToRoom();
    });
};

function joinRoomAsGuest(roomId) {
    db.ref('rooms/' + roomId).once('value').then((snapshot) => {
        if(snapshot.exists()) {
            let data = snapshot.val();
            let playersInRoom = Object.keys(data.players || {});
            
            if(playersInRoom.length >= 4) {
                alert("রুমটি ভর্তি!");
                return;
            }
            
            let availableColors = ['green', 'blue', 'yellow', 'red'].filter(c => !playersInRoom.includes(c));
            myColor = availableColors[0];
            currentRoomId = roomId;
            isOnlineMode = true;
            db.ref('lobby/' + myPlayerId).set('playing');
            
            db.ref('rooms/' + currentRoomId + '/names/' + myColor).set(myPlayerId).then(() => {
                db.ref('rooms/' + currentRoomId + '/players/' + myColor).set(true).then(() => {
                    db.ref('rooms/' + currentRoomId + '/players/' + myColor).onDisconnect().remove();
                    
                    // Hide invite section so guest cannot invite others
                    let inviteSection = document.getElementById('invite-section');
                    if (inviteSection) inviteSection.style.display = 'none';
                    
                    // Wait for host to start
                    document.getElementById('lobby-status').innerText = "হোস্ট গেম শুরু করার জন্য অপেক্ষা করুন...";
                    
                    db.ref('rooms/' + currentRoomId + '/gameState/status').on('value', snap => {
                        if (snap.val() === null) {
                            db.ref('rooms/' + currentRoomId + '/gameState/status').off();
                            alert('হোস্ট রুমটি বন্ধ করে দিয়েছেন!');
                            location.reload();
                        } else if (snap.val() === 'playing') {
                            db.ref('rooms/' + currentRoomId + '/gameState/status').off();
                            listenToRoom();
                        }
                    });
                });
            });
        }
    });
}

function listenToRoom() {
    document.getElementById('online-lobby-menu').style.display = 'none';
    document.getElementById('game-area').style.display = 'block';
    navigateTo('screen-game');
    
    // Listen for players joining/leaving to update activePlayers
    db.ref('rooms/' + currentRoomId + '/players').on('value', snap => {
        let p = snap.val();
        if(p) {
            let currentOnlinePlayers = Object.keys(p);
            
            // Sync bot status for all clients
            currentOnlinePlayers.forEach(c => {
                if (p[c] === 'bot') {
                    // Only one human should control the bots to prevent duplicate rolls.
                    // The first human in the players list acts as the master.
                    let firstHuman = currentOnlinePlayers.find(pc => p[pc] !== 'bot');
                    if (firstHuman === myColor) {
                        isBot[c] = true;
                    } else {
                        isBot[c] = false; // Guests don't control the bot
                    }
                }
            });

            // Hide panels of inactive colors
            players.forEach(c => {
                if(!currentOnlinePlayers.includes(c)) {
                    document.getElementById('panel-' + c).style.visibility = 'hidden';
                    let nameEl = document.getElementById('name-' + c);
                    if (nameEl) nameEl.innerText = '';
                } else {
                    document.getElementById('panel-' + c).style.visibility = 'visible';
                }
            });
            
            // Sync player names to the board
            db.ref('rooms/' + currentRoomId + '/names').once('value').then(nameSnap => {
                let names = nameSnap.val() || {};
                currentOnlinePlayers.forEach(c => {
                    let nameEl = document.getElementById('name-' + c);
                    if (nameEl) {
                        let displayName = names[c] || c;
                        nameEl.innerText = displayName;
                    }
                });
                // Update visuals after names are set
                updateTurnVisuals();
            });
            
            if (currentOnlinePlayers.length > 1) {
                hasGameStarted = true;
            }
            
            if (hasGameStarted && currentOnlinePlayers.length === 1 && currentOnlinePlayers[0] === myColor) {
                // Opponent left
                window.gameWon = true;
                showWinScreen(myColor, "বিপক্ষ খেলোয়াড় ডিসকানেক্ট হয়ে গেছে!");
                db.ref('rooms/' + currentRoomId).remove(); // Cleanup room
                return;
            }
            
            // Handle turn skip if active player disconnected
            if (hasGameStarted && activePlayers.length > 0) {
                let currentActiveColor = players[currentPlayerIndex];
                if (!currentOnlinePlayers.includes(currentActiveColor)) {
                    // Only let the first available human player initiate the skip to prevent race conditions
                    let firstHuman = currentOnlinePlayers.find(c => p[c] !== 'bot');
                    if (myColor === firstHuman) {
                        switchTurn();
                        syncGameState();
                    }
                }
            }
            
            activePlayers = currentOnlinePlayers;
            updateAllTokenPositions();
            updateTurnVisuals();
        } else {
            // Room was deleted
            if (hasGameStarted && !window.gameWon) {
                customAlert('রুমটি বন্ধ হয়ে গেছে বা সবাই ডিসকানেক্ট হয়ে গেছে!', true);
            }
        }
    });

    // Listen for turn changes and token movements
    db.ref('rooms/' + currentRoomId + '/gameState').on('value', snap => {
        let state = snap.val();
        if(state) {
            // Update token positions if they changed remotely
            let changed = false;
            players.forEach(c => {
                if(state.tokenPositions[c]) {
                    for(let i=0; i<4; i++) {
                        if(tokenPositions[c][i] !== state.tokenPositions[c][i]) {
                            tokenPositions[c][i] = state.tokenPositions[c][i];
                            changed = true;
                        }
                    }
                }
            });
            if(changed) updateAllTokenPositions();
            
            if(state.currentPlayerIndex !== undefined && state.currentPlayerIndex !== currentPlayerIndex) {
                currentPlayerIndex = state.currentPlayerIndex;
                updateTurnVisuals();
            }
        }
    });

    // Listen for remote dice rolls
    db.ref('rooms/' + currentRoomId + '/lastRoll').on('value', snap => {
        let roll = snap.val();
        if(roll && roll.color !== myColor) { // Someone else rolled
            gameState = 'rolling';
            rollBtns[roll.color].classList.add('rolling', 'has-result');
            const activeDiceArea = document.getElementById('active-dice-area');
            if(activeDiceArea) {
                activeDiceArea.classList.remove('waiting');
                activeDiceArea.classList.add('rolling');
                document.getElementById('dice-visual').innerHTML = '🎲';
            }
            
            setTimeout(() => {
                rollBtns[roll.color].classList.remove('rolling');
                const activeDiceArea = document.getElementById('active-dice-area');
                if(activeDiceArea) activeDiceArea.classList.remove('rolling');
                document.getElementById('dice-visual').innerHTML = `<div class="dice-result-badge">${roll.value}</div>`;
                
                currentDiceValue = roll.value;
                gameState = 'waiting_for_move';
                startTurnTimer();
                // The actual token movement sync happens via gameState tokenPositions
            }, 1200);
        }
    });
}

function navigateTo(screenId, navElement = null) {
    if (screenId === 'screen-home') {
        let leavingRoomId = typeof currentRoomId !== 'undefined' ? currentRoomId : null;
        let leavingColor = typeof myColor !== 'undefined' ? myColor : null;
        
        // Reset online states when returning home
        window.sentInvites = {};
        if (typeof currentRoomId !== 'undefined') currentRoomId = null;
        if (typeof isHost !== 'undefined') isHost = true;
        let inviteSection = document.getElementById('invite-section');
        if (inviteSection) inviteSection.style.display = 'block';
        let onlineLobby = document.getElementById('online-lobby-menu');
        if (onlineLobby) onlineLobby.style.display = 'none';
        
        // Remove from current room if leaving
        if (db && leavingRoomId) {
            if (leavingColor) {
                db.ref('rooms/' + leavingRoomId + '/players/' + leavingColor).remove();
            }
            // Turn off listeners to prevent popup when staying player deletes room
            db.ref('rooms/' + leavingRoomId + '/players').off();
            db.ref('rooms/' + leavingRoomId + '/gameState').off();
            db.ref('rooms/' + leavingRoomId + '/lastRoll').off();
        }
    }

    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active-screen'));
    document.getElementById(screenId).classList.add('active-screen');
    
    const bottomNav = document.getElementById('bottom-nav');
    if (bottomNav) {
        if (screenId === 'screen-game') {
            bottomNav.style.display = 'none';
        } else {
            bottomNav.style.display = 'flex';
        }
    }
    
    if (navElement) {
        document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
        navElement.classList.add('active');
    }
}

if(document.getElementById('btn-guest-login')) document.getElementById('btn-guest-login').onclick = () => {
    navigateTo('screen-home');
};

// Custom mode handlers removed, reverted to original handlers.

// Wrapper removed

// Update lobby back button
if(document.getElementById('btn-back-to-menu-from-lobby')) document.getElementById('btn-back-to-menu-from-lobby').onclick = () => {
    document.getElementById('online-lobby-menu').style.display = 'none';
    navigateTo('screen-home');
    if (db) db.ref('onlinePlayers/' + myPlayerId).remove();
};


// Event listener for the new central dice
window.handleCentralDiceClick = function(e) {
    if (e) e.preventDefault();
    let currentColor = players[currentPlayerIndex]; 
    if (gameState === 'waiting_for_roll' && !isBot[currentColor] && (!isOnlineMode || currentColor === myColor)) { 
        rollDice(currentColor); 
    } 
};

// Add touch support for central dice
(function() {
    const diceArea = document.getElementById('active-dice-area');
    if (diceArea) {
        diceArea.addEventListener('touchstart', function(e) {
            e.preventDefault();
            handleCentralDiceClick(e);
        }, { passive: false });
    }
})();

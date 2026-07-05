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

const isBot = {
    'green': false,
    'yellow': false,
    'blue': false,
    'red': false
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
    'green': document.getElementById('dice-green'),
    'yellow': document.getElementById('dice-yellow'),
    'blue': document.getElementById('dice-blue'),
    'red': document.getElementById('dice-red')
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
    let el = document.createElement('div');
    el.className = 'win-overlay';
    
    el.innerHTML = `
        <div class="trophy">🏆</div>
        <h1 style="color: #fff">${playerNames[color]} প্রথম হয়েছে!</h1>
        <p style="color: #ffcccc; font-size: 24px; margin-top: -10px;">${customMessage}</p>
        <button onclick="location.reload()" style="margin-top:20px; padding: 15px 30px; font-size:20px; cursor:pointer; border-radius:10px; border:none; background:#fff; color:#000; font-weight:bold; font-family: 'Hind Siliguri', sans-serif;">আবার খেলুন</button>
    `;
    document.body.appendChild(el);
    
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

function updateTurnVisuals() {
    gameState = 'waiting_for_roll';
    players.forEach(color => {
        if(color === players[currentPlayerIndex]) {
            rollBtns[color].classList.remove('disabled');
            rollBtns[color].classList.add('active');
            
            if (isOnlineMode && color !== myColor) {
                rollBtns[color].classList.add('remote-turn');
            } else {
                rollBtns[color].classList.remove('remote-turn');
            }
        } else {
            rollBtns[color].classList.add('disabled');
            rollBtns[color].classList.remove('active', 'has-result', 'remote-turn');
        }
    });

    let currentColor = players[currentPlayerIndex];
    if (isBot[currentColor]) {
        // Auto roll for bot after short delay
        setTimeout(() => {
            if (gameState === 'waiting_for_roll') {
                rollDice(currentColor);
            }
        }, 800);
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
    gameState = 'waiting_for_move';
    validMoves.forEach(i => {
        let el = document.getElementById(`${color}-${i}`);
        el.classList.add('clickable');
        el.onclick = () => moveToken(color, i, diceValue);
    });
}

function moveToken(color, i, diceValue) {
    gameState = 'moving';
    document.querySelectorAll('.token').forEach(t => {
        t.classList.remove('clickable');
        t.onclick = null;
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
    
    if (isOnlineMode && (myColor === color || isBot[color])) {
        syncGameState();
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

function rollDice(color) {
    if (color !== players[currentPlayerIndex] || gameState !== 'waiting_for_roll') return;

    gameState = 'rolling';
    rollBtns[color].classList.add('rolling', 'has-result');
    
    // Increased probability for rolling a 6
    let allInBase = tokenPositions[color].every(pos => pos === -1);
    let chanceForSix = allInBase ? 0.35 : 0.20; // 35% chance if all tokens are stuck in base
    
    let diceValue;
    if (Math.random() < chanceForSix) {
        diceValue = 6;
    } else {
        diceValue = Math.floor(Math.random() * 5) + 1;
    }

    if (isOnlineMode && (myColor === color || isBot[color])) {
        db.ref('rooms/' + currentRoomId + '/lastRoll').set({
            color: color,
            value: diceValue,
            timestamp: Date.now()
        });
    }

    dice3D[color].style.transform = getDiceRotation(diceValue, color);

    setTimeout(() => {
        rollBtns[color].classList.remove('rolling');
        let validMoves = evaluateValidMoves(color, diceValue);
        
        if (validMoves.length === 0) {
            setTimeout(() => {
                switchTurn();
                if (isOnlineMode && myColor === color) syncGameState();
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
                alert("এটি আপনার চাল নয়!");
                return;
            }
            rollDice(color);
        }
    });
});

createTokens();
dice3D['green'].style.transform = 'translateZ(-30px) rotateX(0deg) rotateY(0deg)';

// Mode selection logic
document.getElementById('btn-manual').onclick = () => {
    activePlayers = ['green', 'yellow', 'blue', 'red'];
    document.getElementById('start-menu').style.display = 'none';
    document.getElementById('game-area').style.display = 'block';
    updateTurnVisuals();
};

document.getElementById('btn-robot').onclick = () => {
    activePlayers = ['green', 'blue'];
    isBot['blue'] = true;
    
    // Hide inactive panels
    document.getElementById('panel-yellow').style.visibility = 'hidden';
    document.getElementById('panel-red').style.visibility = 'hidden';
    
    // Update tokens immediately
    updateAllTokenPositions();
    
    document.getElementById('start-menu').style.display = 'none';
    document.getElementById('game-area').style.display = 'block';
    updateTurnVisuals();
};

// Online Mode UI Logic
document.getElementById('btn-online').onclick = () => {
    if (!myPlayerId) {
        document.getElementById('player-name-modal').style.display = 'flex';
    } else {
        showOnlineLobby();
    }
};

document.getElementById('btn-save-name').onclick = () => {
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
    document.getElementById('start-menu').style.display = 'none';
    document.getElementById('online-lobby-menu').style.display = 'flex';
    document.getElementById('my-player-id').innerText = myPlayerId;
    initFirebase();
}

document.getElementById('btn-back-to-menu-from-lobby').onclick = () => {
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
            if (pid !== myPlayerId && players[pid] !== 'playing') {
                count++;
                let li = document.createElement('li');
                li.style.display = 'flex';
                li.style.justifyContent = 'space-between';
                li.style.alignItems = 'center';
                li.style.padding = '8px';
                li.style.borderBottom = '1px solid #eee';
                li.innerHTML = `<span style="color: #333; font-weight: 600;">${pid}</span> 
                                <button onclick="sendInvite('${pid}')" style="background:#2196F3;color:#fff;border:none;padding:5px 10px;border-radius:4px;cursor:pointer;">ইনভাইট</button>`;
                listEl.appendChild(li);
            }
        }
        let botNames = ['আকাশ', 'সুমাইয়া', 'সাদিয়া', 'নয়ন'];
        botNames.forEach(bot => {
            let li = document.createElement('li');
            li.style.display = 'flex';
            li.style.justifyContent = 'space-between';
            li.style.alignItems = 'center';
            li.style.padding = '8px';
            li.style.borderBottom = '1px solid #eee';
            li.innerHTML = `<span style="color: #333; font-weight: 600;">${bot}</span> 
                            <button onclick="sendInvite('${bot}')" style="background:#2196F3;color:#fff;border:none;padding:5px 10px;border-radius:4px;cursor:pointer;">ইনভাইট</button>`;
            listEl.appendChild(li);
            count++;
        });

        if (count === 0) {
            listEl.innerHTML = '<li style="text-align: center; color: #777;">এই মুহূর্তে কেউ অনলাইনে নেই।</li>';
        }
    });

    // Listen for incoming invites
    db.ref('invites/' + myPlayerId).on('value', snapshot => {
        let invite = snapshot.val();
        if (invite && !currentRoomId) {
            document.getElementById('inviter-name').innerText = invite.sender;
            document.getElementById('invite-modal').style.display = 'flex';
            
            document.getElementById('btn-accept-invite').onclick = () => {
                document.getElementById('invite-modal').style.display = 'none';
                db.ref('invites/' + myPlayerId).remove(); // Clear invite
                joinRoomAsGuest(invite.roomId);
            };
            
            document.getElementById('btn-decline-invite').onclick = () => {
                document.getElementById('invite-modal').style.display = 'none';
                db.ref('invites/' + myPlayerId).remove(); // Clear invite
            };
        } else {
            document.getElementById('invite-modal').style.display = 'none';
        }
    });
}

let lobbyRoomListener = null;

window.sendInvite = function(receiverId) {
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
                    document.getElementById('btn-start-online-game').innerText = `গেম শুরু করুন (${count}/4 জন যুক্ত)`;
                }
            });
            sendSingleInvite(receiverId);
        });
    } else {
        sendSingleInvite(receiverId);
    }
};

function sendSingleInvite(receiverId) {
    const isAiBot = ['আকাশ', 'সুমাইয়া', 'সাদিয়া', 'নয়ন'].includes(receiverId);
    if (isAiBot) {
        document.getElementById('lobby-status').innerText = `${receiverId} ইনভাইট গ্রহণ করছে...`;
        setTimeout(() => {
            // Find available color
            db.ref('rooms/' + currentRoomId + '/players').once('value').then(snap => {
                let p = snap.val() || {};
                let currentOnline = Object.keys(p);
                let availableColors = ['green', 'blue', 'yellow', 'red'].filter(c => !currentOnline.includes(c));
                if (availableColors.length > 0) {
                    let botColor = availableColors[0];
                    isBot[botColor] = true;
                    db.ref('rooms/' + currentRoomId + '/players/' + botColor).set(true);
                    document.getElementById('lobby-status').innerText = `${receiverId} রুমে জয়েন করেছে!`;
                }
            });
        }, 1000);
        return;
    }

    db.ref('invites/' + receiverId).set({
        sender: myPlayerId,
        roomId: currentRoomId,
        timestamp: Date.now()
    });
    document.getElementById('lobby-status').innerText = `${receiverId} কে ইনভাইট পাঠানো হয়েছে...`;
}

// Host clicks Start Game
document.getElementById('btn-start-online-game').onclick = () => {
    if (lobbyRoomListener) {
        db.ref('rooms/' + currentRoomId + '/players').off('value', lobbyRoomListener);
    }
    document.getElementById('start-online-game-container').style.display = 'none';
    db.ref('rooms/' + currentRoomId + '/gameState').update({ status: 'playing' });
    listenToRoom();
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
            
            db.ref('rooms/' + currentRoomId + '/players/' + myColor).set(true).then(() => {
                db.ref('rooms/' + currentRoomId + '/players/' + myColor).onDisconnect().remove();
                
                // Wait for host to start
                document.getElementById('lobby-status').innerText = "হোস্ট গেম শুরু করার জন্য অপেক্ষা করুন...";
                
                db.ref('rooms/' + currentRoomId + '/gameState/status').on('value', snap => {
                    if (snap.val() === 'playing') {
                        db.ref('rooms/' + currentRoomId + '/gameState/status').off();
                        listenToRoom();
                    }
                });
            });
        }
    });
}

function listenToRoom() {
    document.getElementById('online-lobby-menu').style.display = 'none';
    document.getElementById('game-area').style.display = 'block';
    
    // Listen for players joining/leaving to update activePlayers
    db.ref('rooms/' + currentRoomId + '/players').on('value', snap => {
        let p = snap.val();
        if(p) {
            let currentOnlinePlayers = Object.keys(p);
            
            // Hide panels of inactive colors
            players.forEach(c => {
                if(!currentOnlinePlayers.includes(c)) {
                    document.getElementById('panel-' + c).style.visibility = 'hidden';
                } else {
                    document.getElementById('panel-' + c).style.visibility = 'visible';
                }
            });
            
            if (currentOnlinePlayers.length > 1) {
                hasGameStarted = true;
            }
            
            if (hasGameStarted && currentOnlinePlayers.length === 1 && currentOnlinePlayers[0] === myColor) {
                // Opponent left
                showWinScreen(myColor, "বিপক্ষ খেলোয়াড় ডিসকানেক্ট হয়ে গেছে!");
                db.ref('rooms/' + currentRoomId).remove(); // Cleanup room
                return;
            }
            
            activePlayers = currentOnlinePlayers;
            updateAllTokenPositions();
            updateTurnVisuals();
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
            dice3D[roll.color].style.transform = getDiceRotation(roll.value, roll.color);
            
            setTimeout(() => {
                rollBtns[roll.color].classList.remove('rolling');
                // The actual token movement sync happens via gameState tokenPositions
            }, 1200);
        }
    });
}



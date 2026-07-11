const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const scoreEl = document.getElementById('score');
const startScreen = document.getElementById('start-screen');
const gameOverScreen = document.getElementById('game-over');
const finalScoreEl = document.getElementById('final-score');
const startBtn = document.getElementById('start-btn');
const restartBtn = document.getElementById('restart-btn');

function resizeCanvas() {
    canvas.width = canvas.parentElement.clientWidth;
    canvas.height = canvas.parentElement.clientHeight;
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

let isPlaying = false;
let score = 0;
let animationId;
let frameCount = 0;

const playerImg = new Image();
playerImg.src = 'player.png';

// Game Objects
let player = {
    x: canvas.width / 2 - 45,
    y: canvas.height - 120,
    width: 90,
    height: 100,
    speed: 6,
    dx: 0
};

let bullets = [];
let enemies = [];
let stars = [];

// Input
const keys = {};
window.addEventListener('keydown', e => { keys[e.code] = true; });
window.addEventListener('keyup', e => { keys[e.code] = false; });

// Touch controls for mobile
let touchX = null;
let isTouching = false;
canvas.addEventListener('touchstart', e => {
    touchX = e.touches[0].clientX - canvas.getBoundingClientRect().left;
    isTouching = true;
});
canvas.addEventListener('touchmove', e => {
    e.preventDefault();
    touchX = e.touches[0].clientX - canvas.getBoundingClientRect().left;
});
canvas.addEventListener('touchend', e => {
    isTouching = false;
    touchX = null;
    player.dx = 0;
});

// Removed old star logic

function drawPlayer() {
    ctx.save();
    ctx.translate(player.x + player.width / 2, player.y + player.height / 2);
    
    // Draw the exact image provided by the user
    try {
        ctx.globalCompositeOperation = 'screen';
        ctx.drawImage(playerImg, -player.width / 2, -player.height / 2, player.width, player.height);
        ctx.globalCompositeOperation = 'source-over';
    } catch (e) {
        // Fallback if image not loaded yet
        ctx.fillStyle = '#94a3b8';
        ctx.fillRect(-10, -10, 20, 20);
    }

    ctx.restore();
}

function fireBullet() {
    if(isPlaying) {
        bullets.push({
            x: player.x + player.width/2 - 3,
            y: player.y - 10,
            width: 6,
            height: 25,
            speed: 12
        });
    }
}

let lastFireTime = 0;

function update() {
    if(!isPlaying) return;

    // Movement Keyboard
    if (keys['ArrowLeft'] || keys['KeyA']) player.dx = -player.speed;
    else if (keys['ArrowRight'] || keys['KeyD']) player.dx = player.speed;
    else if (!isTouching) player.dx = 0;

    // Movement Touch
    if (touchX !== null && isTouching) {
        // move towards touchX
        let center = player.x + player.width/2;
        if (Math.abs(center - touchX) > player.speed) {
            if (touchX < center) player.dx = -player.speed;
            else player.dx = player.speed;
        } else {
            player.dx = 0;
        }
    }

    player.x += player.dx;
    
    // Bounds
    if(player.x < 0) player.x = 0;
    if(player.x + player.width > canvas.width) player.x = canvas.width - player.width;

    // Firing
    let now = Date.now();
    if((keys['Space'] || isTouching) && now - lastFireTime > 250) {
        fireBullet();
        lastFireTime = now;
    }

    // Bullets
    for(let i=bullets.length-1; i>=0; i--) {
        bullets[i].y -= bullets[i].speed;
        if(bullets[i].y < 0) bullets.splice(i, 1);
    }

    // Enemies (Spawn rate increases with score)
    let spawnRate = Math.max(15, 40 - Math.floor(score/50));
    if(frameCount % spawnRate === 0) {
        let size = 25 + Math.random() * 20;
        enemies.push({
            x: Math.random() * (canvas.width - size),
            y: -size,
            width: size,
            height: size,
            speed: 2 + Math.random() * 2 + (score * 0.01),
            color: `hsl(${Math.random() * 360}, 80%, 60%)`
        });
    }

    for(let i=enemies.length-1; i>=0; i--) {
        enemies[i].y += enemies[i].speed;
        
        // Collision with player
        if (
            player.x < enemies[i].x + enemies[i].width &&
            player.x + player.width > enemies[i].x &&
            player.y < enemies[i].y + enemies[i].height &&
            player.y + player.height > enemies[i].y
        ) {
            gameOver();
        }

        // Out of bounds
        if(enemies[i].y > canvas.height) {
            enemies.splice(i, 1);
            continue;
        }

        // Collision with bullets
        for(let j=bullets.length-1; j>=0; j--) {
            let b = bullets[j];
            let e = enemies[i];
            if(b && e && b.x < e.x + e.width && b.x + b.width > e.x && b.y < e.y + e.height && b.y + b.height > e.y) {
                // Explosion effect (just remove for now)
                enemies.splice(i, 1);
                bullets.splice(j, 1);
                score += 10;
                scoreEl.innerText = score;
                document.getElementById('coins').innerText = Math.floor(score / 50); // 1 coin every 50 points
                break;
            }
        }
    }

    frameCount++;
}

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    if(!isPlaying) {
        drawPlayer();
        return;
    }

    drawPlayer();

    // Draw glowing laser bullets
    ctx.fillStyle = '#00f2fe';
    bullets.forEach(b => {
        ctx.shadowBlur = 15;
        ctx.shadowColor = '#00f2fe';
        ctx.beginPath();
        ctx.moveTo(b.x + b.width/2, b.y);
        ctx.lineTo(b.x + b.width, b.y + b.height);
        ctx.lineTo(b.x, b.y + b.height);
        ctx.closePath();
        ctx.fill();
        ctx.shadowBlur = 0;
    });

    // Draw aggressive enemies
    enemies.forEach(e => {
        ctx.save();
        ctx.translate(e.x + e.width/2, e.y + e.height/2);
        
        // Ship Body
        ctx.fillStyle = '#1e293b';
        ctx.beginPath();
        ctx.moveTo(0, e.height/2); // Nose pointing down
        ctx.lineTo(e.width/2, -e.height/4); // Right wing
        ctx.lineTo(e.width/4, -e.height/2);
        ctx.lineTo(-e.width/4, -e.height/2);
        ctx.lineTo(-e.width/2, -e.height/4); // Left wing
        ctx.closePath();
        ctx.fill();
        
        // Glowing Red Thrusters
        ctx.fillStyle = '#ff416c';
        ctx.shadowBlur = 10;
        ctx.shadowColor = '#ff416c';
        ctx.beginPath();
        ctx.arc(0, -e.height/2, e.width/6, Math.PI, 0);
        ctx.fill();
        ctx.shadowBlur = 0;
        
        // Core Eye
        ctx.fillStyle = '#ff4b2b';
        ctx.beginPath();
        ctx.arc(0, 0, e.width/8, 0, Math.PI*2);
        ctx.fill();
        
        ctx.restore();
    });
}

function gameLoop() {
    update();
    draw();
    animationId = requestAnimationFrame(gameLoop);
}

function startGame() {
    resizeCanvas();
    player.x = canvas.width / 2 - 45;
    player.y = canvas.height - 120;
    bullets = [];
    enemies = [];
    score = 0;
    frameCount = 0;
    scoreEl.innerText = score;
    document.getElementById('coins').innerText = '0';
    isPlaying = true;
    startScreen.classList.add('hidden');
    gameOverScreen.classList.add('hidden');
    document.getElementById('game-hud').style.display = 'block';
}

function gameOver() {
    isPlaying = false;
    finalScoreEl.innerText = score;
    gameOverScreen.classList.remove('hidden');
}

startBtn.addEventListener('click', startGame);
restartBtn.addEventListener('click', startGame);

// No stars needed
gameLoop();

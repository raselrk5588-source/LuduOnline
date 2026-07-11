// Game Variables
let scene, camera, renderer;
let player;
let obstacles = [];
let coins = [];
let scenery = [];
let lanes = [-3, 0, 3]; // Left, Middle, Right lane x-coordinates
let currentLane = 1; // Middle lane
let gameSpeed = 0.5;
let isPlaying = false;
let score = 0;
let distance = 0;

// Player states
let isJumping = false;
let isSliding = false;
let jumpVelocity = 0;
let gravity = -0.015;
let playerY = 1; // Default Y

// DOM Elements
const startMenu = document.getElementById('start-menu');
const gameOverMenu = document.getElementById('game-over-menu');
const hud = document.getElementById('hud');
const scoreVal = document.getElementById('score-val');
const finalScore = document.getElementById('final-score');
const startBtn = document.getElementById('start-btn');
const restartBtn = document.getElementById('restart-btn');

function init() {
    // 1. Setup Scene
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87CEEB); // Sky blue
    scene.fog = new THREE.Fog(0x87CEEB, 50, 150); // Fog to hide popping objects

    // 2. Setup Camera
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 6, 10);
    camera.lookAt(0, 0, -10);

    // 3. Setup Renderer
    const canvas = document.getElementById('game-canvas');
    renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;

    // 4. Lighting (Sunlight)
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);

    const sunLight = new THREE.DirectionalLight(0xffffee, 1.0);
    sunLight.position.set(-20, 50, 20);
    sunLight.castShadow = true;
    sunLight.shadow.camera.top = 50;
    sunLight.shadow.camera.bottom = -50;
    sunLight.shadow.camera.left = -50;
    sunLight.shadow.camera.right = 50;
    scene.add(sunLight);

    // 5. Environment (Village Road)
    createEnvironment();

    // 6. Player
    createPlayer();

    // 7. Event Listeners
    window.addEventListener('resize', onWindowResize, false);
    document.addEventListener('keydown', handleKeyDown, false);
    startBtn.addEventListener('click', startGame);
    restartBtn.addEventListener('click', startGame);

    // Initial scenery
    for(let i=0; i<10; i++) spawnScenery(true);

    // Start Animation Loop
    animate();
}

function createEnvironment() {
    // City Street Base
    const streetGeo = new THREE.PlaneGeometry(200, 400);
    const streetMat = new THREE.MeshLambertMaterial({ map: createRoadTexture() }); // Use stone texture
    const street = new THREE.Mesh(streetGeo, streetMat);
    street.rotation.x = -Math.PI / 2;
    street.position.z = -100;
    street.receiveShadow = true;
    scene.add(street);

    // Left Sidewalk
    const leftSidewalkGeo = new THREE.BoxGeometry(90, 0.5, 400);
    const sidewalkMat = new THREE.MeshLambertMaterial({ color: 0x888888 }); // Lighter gray concrete
    const leftSidewalk = new THREE.Mesh(leftSidewalkGeo, sidewalkMat);
    leftSidewalk.position.set(-52, 0.25, -100);
    leftSidewalk.receiveShadow = true;
    scene.add(leftSidewalk);

    // Right Sidewalk
    const rightSidewalkGeo = new THREE.BoxGeometry(90, 0.5, 400);
    const rightSidewalk = new THREE.Mesh(rightSidewalkGeo, sidewalkMat);
    rightSidewalk.position.set(52, 0.25, -100);
    rightSidewalk.receiveShadow = true;
    scene.add(rightSidewalk);
}

function spawnScenery(initial = false) {
    const sceneryGroup = new THREE.Group();
    
    // Building
    const width = 4 + Math.random() * 4;
    const height = 10 + Math.random() * 15;
    const depth = 5 + Math.random() * 5;
    const buildGeo = new THREE.BoxGeometry(width, height, depth);
    
    // Warm town colors
    const colors = ['#d2b48c', '#f4a460', '#cd853f', '#deb887', '#bc8f8f', '#8b4513'];
    const buildColor = colors[Math.floor(Math.random() * colors.length)];
    const buildMat = new THREE.MeshLambertMaterial({ map: createBuildingTexture(buildColor) });
    
    const building = new THREE.Mesh(buildGeo, buildMat);
    building.position.y = height / 2;
    building.castShadow = true;
    sceneryGroup.add(building);

    // Roof
    const roofGeo = new THREE.ConeGeometry(width/1.2, 4, 4);
    const roofMat = new THREE.MeshLambertMaterial({ color: 0x8b0000 }); // Dark red/brown roof
    const roof = new THREE.Mesh(roofGeo, roofMat);
    roof.position.y = height + 2;
    roof.rotation.y = Math.PI / 4;
    roof.castShadow = true;
    sceneryGroup.add(roof);

    // Random placement on sides (on sidewalks)
    let side = Math.random() > 0.5 ? 1 : -1;
    sceneryGroup.position.x = side * (12 + Math.random() * 5);
    sceneryGroup.position.z = initial ? (-Math.random() * 150) : -150;
    
    scene.add(sceneryGroup);
    scenery.push(sceneryGroup);

    // Also spawn a road line segment!
    const lineGeo = new THREE.PlaneGeometry(0.2, 4);
    const lineMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    
    const leftLine = new THREE.Mesh(lineGeo, lineMat);
    leftLine.rotation.x = -Math.PI / 2;
    leftLine.position.set(-1.5, 0.05, sceneryGroup.position.z);
    scene.add(leftLine);
    scenery.push(leftLine);

    const rightLine = new THREE.Mesh(lineGeo, lineMat);
    rightLine.rotation.x = -Math.PI / 2;
    rightLine.position.set(1.5, 0.05, sceneryGroup.position.z);
    scene.add(rightLine);
    scenery.push(rightLine);
}

function createPlayer() {
    player = new THREE.Group();
    const catColor = 0xff8c00; // Orange cat
    const hoodieColor = 0xcc0000;
    const jeansColor = 0x1e90ff;
    const shoesColor = 0xffffff;

    // Body (Red Hoodie)
    const bodyGeo = new THREE.BoxGeometry(0.8, 0.6, 1.2);
    const bodyMat = new THREE.MeshLambertMaterial({ color: hoodieColor });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.y = 0.6;
    body.castShadow = true;
    player.add(body);

    // Paw Print Logo on Back of Hoodie
    const logoMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const pad1 = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 8), logoMat);
    pad1.position.set(0, 0.65, 0.61);
    player.add(pad1);
    const pad2 = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 8), logoMat);
    pad2.position.set(-0.15, 0.75, 0.61);
    player.add(pad2);
    const pad3 = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 8), logoMat);
    pad3.position.set(0, 0.8, 0.61);
    player.add(pad3);
    const pad4 = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 8), logoMat);
    pad4.position.set(0.15, 0.75, 0.61);
    player.add(pad4);

    // Head
    const headGeo = new THREE.BoxGeometry(0.7, 0.6, 0.7);
    const headMat = new THREE.MeshLambertMaterial({ color: catColor });
    const head = new THREE.Mesh(headGeo, headMat);
    head.position.set(0, 0.9, -0.7);
    head.castShadow = true;
    player.add(head);

    // Ears
    const earGeo = new THREE.ConeGeometry(0.15, 0.3, 4);
    const leftEar = new THREE.Mesh(earGeo, headMat);
    leftEar.position.set(-0.25, 1.3, -0.7);
    leftEar.rotation.y = Math.PI / 4;
    leftEar.castShadow = true;
    player.add(leftEar);

    const rightEar = new THREE.Mesh(earGeo, headMat);
    rightEar.position.set(0.25, 1.3, -0.7);
    rightEar.rotation.y = Math.PI / 4;
    rightEar.castShadow = true;
    player.add(rightEar);

    // Eyes and Nose
    const eyeGeo = new THREE.BoxGeometry(0.1, 0.1, 0.1);
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
    const leftEye = new THREE.Mesh(eyeGeo, eyeMat);
    leftEye.position.set(-0.2, 1.0, -1.05);
    player.add(leftEye);

    const rightEye = new THREE.Mesh(eyeGeo, eyeMat);
    rightEye.position.set(0.2, 1.0, -1.05);
    player.add(rightEye);

    const noseGeo = new THREE.BoxGeometry(0.1, 0.05, 0.1);
    const noseMat = new THREE.MeshBasicMaterial({ color: 0xff69b4 });
    const nose = new THREE.Mesh(noseGeo, noseMat);
    nose.position.set(0, 0.85, -1.06);
    player.add(nose);

    // Snout (White part around nose)
    const snoutGeo = new THREE.BoxGeometry(0.3, 0.2, 0.1);
    const snoutMat = new THREE.MeshLambertMaterial({ color: 0xffffff });
    const snout = new THREE.Mesh(snoutGeo, snoutMat);
    snout.position.set(0, 0.75, -1.06);
    player.add(snout);

    // Tail
    const tailGeo = new THREE.BoxGeometry(0.1, 0.8, 0.1);
    const tail = new THREE.Mesh(tailGeo, headMat);
    tail.position.set(0, 0.9, 0.6);
    tail.rotation.x = Math.PI / 4;
    tail.castShadow = true;
    player.add(tail);

    // Legs (Jeans)
    const legGeo = new THREE.BoxGeometry(0.2, 0.4, 0.2);
    const legMat = new THREE.MeshLambertMaterial({ color: jeansColor });
    const fLL = new THREE.Mesh(legGeo, legMat);
    fLL.position.set(-0.25, 0.2, -0.4);
    fLL.castShadow = true;
    player.add(fLL);

    const fRL = new THREE.Mesh(legGeo, legMat);
    fRL.position.set(0.25, 0.2, -0.4);
    fRL.castShadow = true;
    player.add(fRL);

    const bLL = new THREE.Mesh(legGeo, legMat);
    bLL.position.set(-0.25, 0.2, 0.4);
    bLL.castShadow = true;
    player.add(bLL);

    const bRL = new THREE.Mesh(legGeo, legMat);
    bRL.position.set(0.25, 0.2, 0.4);
    bRL.castShadow = true;
    player.add(bRL);

    // Shoes (White)
    const shoeGeo = new THREE.BoxGeometry(0.22, 0.1, 0.25);
    const shoeMat = new THREE.MeshLambertMaterial({ color: shoesColor });
    
    const fLS = new THREE.Mesh(shoeGeo, shoeMat);
    fLS.position.set(0, -0.2, -0.05);
    fLL.add(fLS);

    const fRS = new THREE.Mesh(shoeGeo, shoeMat);
    fRS.position.set(0, -0.2, -0.05);
    fRL.add(fRS);

    const bLS = new THREE.Mesh(shoeGeo, shoeMat);
    bLS.position.set(0, -0.2, -0.05);
    bLL.add(bLS);

    const bRS = new THREE.Mesh(shoeGeo, shoeMat);
    bRS.position.set(0, -0.2, -0.05);
    bRL.add(bRS);

    player.userData.legs = [fLL, fRL, bLL, bRL];
    player.userData.tail = tail;

    playerY = 0; // Legs touch ground
    player.position.set(lanes[currentLane], playerY, 0);
    scene.add(player);
}

function spawnObstacle() {
    if (!isPlaying) return;

    const laneIndex = Math.floor(Math.random() * 3);
    const xPos = lanes[laneIndex];
    const type = Math.floor(Math.random() * 3);
    
    let obsGroup = new THREE.Group();
    
    if (type === 0) {
        // Wooden Crate (Block)
        const geo = new THREE.BoxGeometry(2, 2, 2);
        const mat = new THREE.MeshLambertMaterial({ map: createCrateTexture() });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.y = 1;
        mesh.castShadow = true;
        
        // Inner darker box for border effect
        const innerGeo = new THREE.BoxGeometry(1.9, 1.9, 2.1);
        const innerMat = new THREE.MeshBasicMaterial({ color: 0x3d2314 });
        const innerMesh = new THREE.Mesh(innerGeo, innerMat);
        mesh.add(innerMesh);

        obsGroup.add(mesh);
        obsGroup.userData.type = 'block';
    } else if (type === 1) {
        // Low Barricade (Jump over)
        const geo = new THREE.BoxGeometry(3, 1, 0.5);
        const mat = new THREE.MeshLambertMaterial({ color: 0xff4500 });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.y = 0.5;
        mesh.castShadow = true;
        obsGroup.add(mesh);
        obsGroup.userData.type = 'hole'; // Reuse jump logic
    } else if (type === 2) {
        // High Barrier (Slide under)
        const geo = new THREE.BoxGeometry(3.5, 1, 0.5);
        const mat = new THREE.MeshLambertMaterial({ color: 0xff4500 }); // Orange
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.y = 2.5; // High up so player can slide under
        mesh.castShadow = true;
        
        // White stripes
        const stripeGeo = new THREE.BoxGeometry(0.5, 1.05, 0.55);
        const stripeMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
        const stripe1 = new THREE.Mesh(stripeGeo, stripeMat);
        stripe1.position.set(-1, 0, 0);
        const stripe2 = new THREE.Mesh(stripeGeo, stripeMat);
        stripe2.position.set(1, 0, 0);
        mesh.add(stripe1);
        mesh.add(stripe2);
        
        obsGroup.add(mesh);
        
        // Two side poles supporting it
        const poleGeo = new THREE.CylinderGeometry(0.1, 0.1, 3);
        const poleMat = new THREE.MeshLambertMaterial({ color: 0x888888 });
        const leftPole = new THREE.Mesh(poleGeo, poleMat);
        leftPole.position.set(-1.5, 1.5, 0);
        leftPole.castShadow = true;
        
        const rightPole = new THREE.Mesh(poleGeo, poleMat);
        rightPole.position.set(1.5, 1.5, 0);
        rightPole.castShadow = true;

        obsGroup.add(leftPole);
        obsGroup.add(rightPole);
        
        obsGroup.userData.type = 'high';
    }

    obsGroup.position.set(xPos, 0, -100);
    scene.add(obsGroup);
    obstacles.push({ mesh: obsGroup, type: type });
}

function handleKeyDown(event) {
    if (!isPlaying) return;

    switch (event.code) {
        case 'ArrowLeft':
        case 'KeyA':
            if (currentLane > 0) currentLane--;
            break;
        case 'ArrowRight':
        case 'KeyD':
            if (currentLane < 2) currentLane++;
            break;
        case 'ArrowUp':
        case 'KeyW':
            if (!isJumping && !isSliding) {
                isJumping = true;
                jumpVelocity = 0.4;
            }
            break;
        case 'ArrowDown':
        case 'KeyS':
            if (!isJumping && !isSliding) {
                isSliding = true;
                player.scale.y = 0.5;
                player.position.y = playerY;
                setTimeout(() => {
                    isSliding = false;
                    player.scale.y = 1;
                    player.position.y = playerY;
                }, 800);
            }
            break;
    }
}

// Touch Controls (Swipe)
let touchStartX = 0;
let touchStartY = 0;

document.addEventListener('touchstart', e => {
    touchStartX = e.changedTouches[0].screenX;
    touchStartY = e.changedTouches[0].screenY;
}, { passive: false });

document.addEventListener('touchmove', e => {
    // Prevent default scrolling on mobile while playing
    if (isPlaying && e.cancelable) {
        e.preventDefault();
    }
}, { passive: false });

document.addEventListener('touchend', e => {
    if (!isPlaying) return;
    
    let touchEndX = e.changedTouches[0].screenX;
    let touchEndY = e.changedTouches[0].screenY;
    
    let diffX = touchEndX - touchStartX;
    let diffY = touchEndY - touchStartY;
    
    // Threshold to ignore simple taps
    if (Math.abs(diffX) < 30 && Math.abs(diffY) < 30) return;

    if (Math.abs(diffX) > Math.abs(diffY)) {
        // Horizontal swipe
        if (diffX > 0) {
            // Swipe Right
            if (currentLane < 2) currentLane++;
        } else {
            // Swipe Left
            if (currentLane > 0) currentLane--;
        }
    } else {
        // Vertical swipe
        if (diffY < 0) {
            // Swipe Up
            if (!isJumping && !isSliding) {
                isJumping = true;
                jumpVelocity = 0.4;
            }
        } else {
            // Swipe Down
            if (!isJumping && !isSliding) {
                isSliding = true;
                player.scale.y = 0.5;
                player.position.y = playerY;
                setTimeout(() => {
                    isSliding = false;
                    player.scale.y = 1;
                    player.position.y = playerY;
                }, 800);
            }
        }
    }
}, { passive: false });

function updatePlayer() {
    player.position.x += (lanes[currentLane] - player.position.x) * 0.1;

    if (isJumping) {
        player.position.y += jumpVelocity;
        jumpVelocity += gravity;

        if (player.position.y <= playerY) {
            player.position.y = playerY;
            isJumping = false;
            jumpVelocity = 0;
        }
    }

    // Leg and Tail animation
    if (!isJumping && !isSliding) {
        const time = Date.now() * 0.015 * gameSpeed;
        if (player.userData.legs) {
            player.userData.legs[0].rotation.x = Math.sin(time) * 0.6; // fLL
            player.userData.legs[1].rotation.x = Math.sin(time + Math.PI) * 0.6; // fRL
            player.userData.legs[2].rotation.x = Math.sin(time + Math.PI) * 0.6; // bLL
            player.userData.legs[3].rotation.x = Math.sin(time) * 0.6; // bRL
        }
        if (player.userData.tail) {
            player.userData.tail.rotation.z = Math.sin(time * 0.5) * 0.3;
        }
    } else {
        if (player.userData.legs) {
            player.userData.legs.forEach(leg => leg.rotation.x = 0);
        }
    }
}

function updateEnvironment() {
    // Update Obstacles
    for (let i = obstacles.length - 1; i >= 0; i--) {
        let obs = obstacles[i].mesh;
        obs.position.z += gameSpeed;

        if (obs.position.z > -1.5 && obs.position.z < 1.5) {
            if (Math.abs(obs.position.x - player.position.x) < 1.0) {
                let hit = false;
                let obsType = obstacles[i].type;
                
                if (obsType === 0) { // Rock
                    if (player.position.y < 2) hit = true;
                } else if (obsType === 1) { // Hole
                    if (player.position.y < 1.5) hit = true; // Player must be jumping
                } else if (obsType === 2) { // Fallen Tree
                    if (!isSliding && player.position.y > 0.8) hit = true;
                }

                if (hit) {
                    gameOver();
                }
            }
        }

        if (obs.position.z > 10) {
            scene.remove(obs);
            obstacles.splice(i, 1);
        }
    }

    // Update Scenery Trees
    for (let i = scenery.length - 1; i >= 0; i--) {
        let tree = scenery[i];
        tree.position.z += gameSpeed;
        if (tree.position.z > 10) {
            scene.remove(tree);
            scenery.splice(i, 1);
        }
    }

    // Update Coins
    for (let i = coins.length - 1; i >= 0; i--) {
        let coin = coins[i];
        coin.position.z += gameSpeed;
        coin.rotation.z += 0.05;

        if (coin.position.z > -1.5 && coin.position.z < 1.5) {
            if (Math.abs(coin.position.x - player.position.x) < 1.0) {
                if (player.position.y < 2) { // Collect coin
                    score += 10;
                    scoreVal.innerText = Math.floor(score);
                    scene.remove(coin);
                    coins.splice(i, 1);
                    continue;
                }
            }
        }

        if (coin.position.z > 10) {
            scene.remove(coin);
            coins.splice(i, 1);
        }
    }
}

function startGame() {
    startMenu.classList.add('hidden');
    gameOverMenu.classList.add('hidden');
    hud.classList.remove('hidden');
    
    obstacles.forEach(obs => scene.remove(obs.mesh));
    obstacles = [];

    scenery.forEach(tree => scene.remove(tree));
    scenery = [];
    for(let i=0; i<10; i++) spawnScenery(true);

    coins.forEach(c => scene.remove(c));
    coins = [];

    currentLane = 1;
    player.position.set(lanes[currentLane], playerY, 0);
    player.scale.y = 1;
    isJumping = false;
    isSliding = false;
    
    score = 0;
    distance = 0;
    gameSpeed = 0.4; // Start slightly slower
    scoreVal.innerText = score;
    
    isPlaying = true;
}

function gameOver() {
    isPlaying = false;
    hud.classList.add('hidden');
    gameOverMenu.classList.remove('hidden');
    finalScore.innerText = Math.floor(score);
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

function animate() {
    requestAnimationFrame(animate);

    if (isPlaying) {
        updatePlayer();
        updateEnvironment();

        if (Math.random() < 0.03 + (gameSpeed * 0.04)) {
            // Dynamic gap: as speed increases, obstacles can spawn much closer together
            let minGap = Math.max(25, 80 - (gameSpeed * 40));
            if (obstacles.length === 0 || obstacles[obstacles.length - 1].mesh.position.z > -minGap) {
                spawnObstacle();
            }
        }

        if (Math.random() < 0.05 + (gameSpeed * 0.02)) {
            spawnScenery();
        }

        if (Math.random() < 0.03) {
            spawnCoin();
        }

        // Score increases slightly faster
        distance += gameSpeed * 1.5;
        score = Math.floor(distance / 10);
        scoreVal.innerText = score;

        // Speed increases more noticeably over time
        gameSpeed += 0.0002;
    }

    if (isPlaying && !isJumping && !isSliding) {
        const time = Date.now() * 0.015;
        player.position.y = playerY + Math.abs(Math.sin(time)) * 0.2;
        
        if (player.userData.legs) {
            player.userData.legs[0].rotation.x = Math.sin(time) * 0.6; // FL
            player.userData.legs[1].rotation.x = Math.sin(time + Math.PI) * 0.6; // FR
            player.userData.legs[2].rotation.x = Math.sin(time + Math.PI) * 0.6; // BL
            player.userData.legs[3].rotation.x = Math.sin(time) * 0.6; // BR
            player.userData.tail.rotation.x = Math.PI / 4 + Math.sin(time * 0.5) * 0.2;
        }
    } else if (player.userData.legs) {
        player.userData.legs.forEach(leg => leg.rotation.x = 0);
        player.userData.tail.rotation.x = Math.PI / 4;
    }

    renderer.render(scene, camera);
}

// --- Texture Generators ---
function createRoadTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');
    
    ctx.fillStyle = '#4a4d53';
    ctx.fillRect(0, 0, 512, 512);
    
    ctx.strokeStyle = '#3a3c40';
    ctx.lineWidth = 4;
    for(let y = 0; y < 512; y += 64) {
        for(let x = 0; x < 512; x += 128) {
            let offset = (y / 64) % 2 === 0 ? 0 : 64;
            ctx.strokeRect(x - offset, y, 128, 64);
            ctx.fillStyle = 'rgba(255,255,255,0.03)';
            ctx.fillRect(x - offset + 4, y + 4, 120, 56);
        }
    }
    
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(4, 20);
    return texture;
}

function createBuildingTexture(colorStr) {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');
    
    ctx.fillStyle = colorStr;
    ctx.fillRect(0, 0, 256, 256);
    
    // Windows
    ctx.fillStyle = '#ffffe0'; // warm glowing light
    for(let y = 30; y < 250; y += 40) {
        for(let x = 20; x < 230; x += 40) {
            if(Math.random() > 0.3) {
                ctx.fillRect(x, y, 20, 25);
            } else {
                ctx.fillStyle = '#222';
                ctx.fillRect(x, y, 20, 25);
                ctx.fillStyle = '#ffffe0';
            }
        }
    }
    
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    return texture;
}

function createCrateTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');
    
    ctx.fillStyle = '#b08d6a';
    ctx.fillRect(0, 0, 256, 256);
    
    ctx.strokeStyle = '#5e4024';
    ctx.lineWidth = 10;
    ctx.strokeRect(5, 5, 246, 246);
    
    // Cross
    ctx.beginPath();
    ctx.moveTo(10, 10);
    ctx.lineTo(246, 246);
    ctx.moveTo(246, 10);
    ctx.lineTo(10, 246);
    ctx.stroke();
    
    // Planks
    ctx.lineWidth = 2;
    for(let i=20; i<256; i+=20) {
        ctx.beginPath();
        ctx.moveTo(0, i);
        ctx.lineTo(256, i);
        ctx.stroke();
    }
    
    const texture = new THREE.CanvasTexture(canvas);
    return texture;
}

function createPawTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    
    ctx.fillStyle = '#ffd700'; // gold
    ctx.fillRect(0, 0, 128, 128);
    
    ctx.fillStyle = '#ccaa00'; // dark gold
    // Main pad
    ctx.beginPath(); ctx.arc(64, 80, 20, 0, Math.PI*2); ctx.fill();
    // Toes
    ctx.beginPath(); ctx.arc(35, 50, 12, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(64, 40, 12, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(93, 50, 12, 0, Math.PI*2); ctx.fill();
    
    const texture = new THREE.CanvasTexture(canvas);
    return texture;
}

function spawnCoin() {
    if (!isPlaying) return;

    // Pick a random lane
    const laneIndex = Math.floor(Math.random() * 3);
    const xPos = lanes[laneIndex];

    const coinGeo = new THREE.CylinderGeometry(0.4, 0.4, 0.1, 16);
    const coinMat = new THREE.MeshLambertMaterial({ map: createPawTexture() }); // Use Paw texture!
    const coin = new THREE.Mesh(coinGeo, coinMat);
    
    coin.rotation.x = Math.PI / 2; // Stand upright
    coin.position.set(xPos, 0.6, -100);
    coin.castShadow = true;
    
    scene.add(coin);
    coins.push(coin);
}

init();

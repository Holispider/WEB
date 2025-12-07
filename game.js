document.addEventListener('DOMContentLoaded', () => {
    
    // --- 1. FIREBASE CONFIG ---
    const firebaseConfig = {
        apiKey: "AIzaSyCG86336uqHVxmv3f95ES41hZsGbuBnz1A",
        authDomain: "web-holispider.firebaseapp.com",
        databaseURL: "https://web-holispider-default-rtdb.europe-west1.firebasedatabase.app",
        projectId: "web-holispider",
        storageBucket: "web-holispider.firebasestorage.app",
        messagingSenderId: "671733150466",
        appId: "1:671733150466:web:fcca9298f31f0d4e9bc81b",
        measurementId: "G-2FB2WM14T6"
    };

    let db;
    try {
        firebase.initializeApp(firebaseConfig);
        db = firebase.database();
    } catch (e) { console.error("Firebase error:", e); }

    // --- DOM PRVKY ---
    const canvas = document.getElementById('gameCanvas');
    const ctx = canvas.getContext('2d');
    const overlay = document.getElementById('gameOverlay');
    const startBtn = document.getElementById('startGameBtn');
    const scoreDisplay = document.getElementById('gameScoreDisplay');
    const titleDisplay = document.getElementById('gameTitle');
    const fullscreenBtn = document.getElementById('fullscreenBtn');
    const gameContainer = document.getElementById('gameContainer');
    const gameBackdrop = document.getElementById('gameBackdrop');
    
    const nickInput = document.getElementById('playerNick');
    const champNameEl = document.getElementById('champName');
    const champScoreEl = document.getElementById('champScore');
    const externalRecordEl = document.getElementById('externalHighScore');

    // --- DETEKCE MOBILU (PRO OPTIMALIZACI) ---
    // Pokud je obrazovka užší než 900px nebo je to dotykové zařízení, považujeme to za mobil/tablet
    const isMobile = window.innerWidth < 900 || 'ontouchstart' in window;

    // --- PROMĚNNÉ ---
    let globalHighScore = 0;
    let globalChampionName = "Nikdo";
    let currentPlayerNick = "";
    let gameRunning = false;
    let score = 0;
    let gameSpeed = 2.5; 
    let frames = 0;
    let animationId;
    let lastObstacleType = null; 

    // --- NAČTENÍ DAT Z FIREBASE ---
    if (db) {
        const scoreRef = db.ref('bobri_utek_rekord');
        scoreRef.on('value', (snapshot) => {
            const data = snapshot.val();
            if (data) {
                globalHighScore = data.score;
                globalChampionName = data.name;
                if(champNameEl) champNameEl.innerText = globalChampionName;
                if(champScoreEl) champScoreEl.innerText = globalHighScore;
                if(externalRecordEl) {
                    externalRecordEl.innerText = `${globalChampionName} (${globalHighScore})`;
                    externalRecordEl.style.color = "#00ff00";
                }
            } else {
                if(externalRecordEl) externalRecordEl.innerText = "Nikdo (zatím)";
            }
        });
    }

    // --- AUDIO ---
    const bgMusic = new Audio('hra/music.mp3');
    bgMusic.loop = true; bgMusic.volume = 0.4;  

    // --- GRAFIKA ---
    const imgBackground = new Image(); imgBackground.src = 'hra/pozadí.png';
    const imgGround = new Image(); imgGround.src = 'hra/podlaha.png';
    const imgTrap1 = new Image(); imgTrap1.src = 'hra/past1.png'; 
    const imgTrap2 = new Image(); imgTrap2.src = 'hra/past2.png';
    const imgSpike = new Image(); imgSpike.src = 'hra/prekazka.png'; 
    const imgTree1 = new Image(); imgTree1.src = 'hra/Strom1.png'; 
    const imgTree2 = new Image(); imgTree2.src = 'hra/Strom2.png'; 
    const imgAxe1 = new Image(); imgAxe1.src = 'hra/sekera1.png'; 
    const imgAxe2 = new Image(); imgAxe2.src = 'hra/sekera2.png';
    const imgFood = new Image(); imgFood.src = 'hra/jidlo.png';      
    const randomBeaverIndex = Math.floor(Math.random() * 46) + 1;
    const imgBeaver = new Image(); imgBeaver.src = `img/bobri/${randomBeaverIndex}.png`;

    // === OPTIMALIZACE 1: Vypnutí stínů na mobilech ===
    function setGlow(color = 'white', blur = 20) { 
        if (isMobile) return; // Na mobilu stíny nevykreslujeme (zvyšuje to výkon o 300%)
        ctx.shadowColor = color; 
        ctx.shadowBlur = blur; 
    }
    function resetGlow() { 
        if (isMobile) return;
        ctx.shadowBlur = 0; 
    }
    
    function safeDrawImage(img, x, y, w, h) {
        if (img && img.complete && img.naturalWidth !== 0) ctx.drawImage(img, x, y, w, h);
    }

    // --- RESIZE A DRAW ---
    const BASE_WIDTH = 800; 
    const BASE_HEIGHT = 400;
    const GROUND_HEIGHT = 50; 
    const FLOOR_Y = BASE_HEIGHT - GROUND_HEIGHT; 

    // === OPTIMALIZACE 2: Omezení rozlišení na mobilech ===
    function resizeCanvas() {
        const width = gameContainer.clientWidth; 
        const height = gameContainer.clientHeight;
        
        if (width === 0 || height === 0) return;
        
        // Na PC použijeme jemné rozlišení (Retina), na mobilu stačí 1.0 (kvůli rychlosti)
        // iPhony mají běžně dpr 3, což je pro canvas hru zbytečně náročné na výpočet.
        const dpr = isMobile ? 1 : (window.devicePixelRatio || 1);
        
        canvas.width = width * dpr; 
        canvas.height = height * dpr;
        
        ctx.setTransform(1, 0, 0, 1, 0, 0); 
        ctx.scale(dpr, dpr);
        
        const scale = width / BASE_WIDTH;
        ctx.scale(scale, scale);

        if (!gameRunning) drawStaticScene();
    }

    function drawStaticScene() {
        ctx.clearRect(0, 0, BASE_WIDTH, BASE_HEIGHT);
        safeDrawImage(imgBackground, 0, 0, BASE_WIDTH, BASE_HEIGHT);
        safeDrawImage(imgGround, 0, FLOOR_Y - 180, BASE_WIDTH, GROUND_HEIGHT + 180);
        if (imgBeaver.complete) { beaver.init(); beaver.draw(); }
    }

    // --- OBJEKTY ---
    const beaver = {
        baseX: 80, x: 80, y: 0, width: 70, height: 70, dy: 0, jumpPower: -10, gravity: 0.4, groundY: 0, 
        init: function() { this.groundY = FLOOR_Y - this.height + 15; this.y = this.groundY; this.x = this.baseX; this.dy = 0; this.jumpCount = 0; },
        draw: function() {
            if (!imgBeaver.complete) return;
            ctx.save();
            if (this.y < this.groundY) { // Skok
                ctx.translate(this.x + this.width/2, this.y + this.height/2);
                let jumpRot = (this.jumpCount > 1) ? frames * 0.15 : -0.3;
                ctx.rotate(jumpRot);
                safeDrawImage(imgBeaver, -this.width/2, -this.height/2, this.width, this.height);
            } else { // Běh
                this.runAngle = Math.sin(frames * 0.2) * 0.1;
                let bounceY = Math.abs(Math.sin(frames * 0.2)) * 5;
                ctx.translate(this.x + this.width/2, this.y + this.height/2 - bounceY);
                ctx.rotate(this.runAngle);
                safeDrawImage(imgBeaver, -this.width/2, -this.height/2, this.width, this.height);
            }
            ctx.restore();
        },
        update: function() {
            this.y += this.dy;
            if (this.y < this.groundY) { this.dy += this.gravity; } 
            else { this.y = this.groundY; this.dy = 0; this.jumpCount = 0; }
            this.draw();
        },
        jump: function() {
            if (this.jumpCount < 2) { this.dy = this.jumpPower; this.jumpCount++; }
        }
    };

    const background = {
        x1: 0, x2: BASE_WIDTH, y: 0, width: BASE_WIDTH, height: BASE_HEIGHT, speed: 1, 
        update: function() {
            this.x1 -= this.speed; this.x2 -= this.speed;
            if (this.x1 <= -this.width) this.x1 = this.width + this.x2 - this.speed;
            if (this.x2 <= -this.width) this.x2 = this.width + this.x1 - this.speed;
            safeDrawImage(imgBackground, this.x1, this.y, this.width, this.height);
            if (imgBackground.complete) {
                ctx.save(); ctx.translate(this.x2 + this.width, this.y); ctx.scale(-1, 1);
                safeDrawImage(imgBackground, 0, 0, this.width, this.height); ctx.restore();
            }
        }
    };

    const ground = {
        x1: 0, x2: BASE_WIDTH, y: FLOOR_Y, width: BASE_WIDTH, height: GROUND_HEIGHT, speed: gameSpeed,
        update: function() {
            this.speed = gameSpeed;
            this.x1 -= this.speed; this.x2 -= this.speed;
            if (this.x1 <= -this.width) this.x1 = this.width + this.x2 - this.speed;
            if (this.x2 <= -this.width) this.x2 = this.width + this.x1 - this.speed;
            
            let visualY = this.y - 180; 
            let visualHeight = this.height + 180;
            safeDrawImage(imgGround, this.x1, visualY, this.width, visualHeight);
            safeDrawImage(imgGround, this.x2, visualY, this.width, visualHeight);
        }
    };

    const obstacles = [];
    const foods = [];

    // --- PŘEKÁŽKY ---
    class Obstacle {
        constructor(type) {
            this.markedForDeletion = false; this.type = type; this.angle = 0; this.sway = 0;
            if (type === 'trap') {
                this.image = Math.random() > 0.5 ? imgTrap1 : imgTrap2;
                this.width = 90; this.height = 70; this.x = BASE_WIDTH;
                this.y = FLOOR_Y - this.height + 15; 
                this.isFlying = false;
            } else if (type === 'spike') {
                this.image = imgSpike;
                this.width = 80; this.height = 90; this.x = BASE_WIDTH;
                this.y = FLOOR_Y - this.height + 20; 
                this.isFlying = false;
            } else if (type === 'tree') {
                this.image = Math.random() > 0.5 ? imgTree1 : imgTree2;
                this.width = 120; this.height = 250; this.x = BASE_WIDTH;
                this.y = FLOOR_Y - this.height + 30; 
                this.isFlying = false;
            } else {
                this.image = Math.random() > 0.5 ? imgAxe1 : imgAxe2;
                this.width = 60; this.height = 60; this.x = -60; this.y = -60; 
                let targetX = BASE_WIDTH + 100; let targetY = FLOOR_Y + 50;
                let dx = targetX - this.x; let dy = targetY - this.y;
                let distance = Math.sqrt(dx*dx + dy*dy);
                let speed = distance / 450; 
                this.vx = dx / distance * speed * 2.0; 
                this.vy = dy / distance * speed * 2.0; 
                this.gravity = 0.01; this.isFlying = true;
            }
        }
        update() {
            if (this.isFlying) {
                this.x += this.vx; this.y += this.vy; this.vy += this.gravity; this.angle += 0.1; 
                if (this.x > BASE_WIDTH + 100 || this.y > BASE_HEIGHT + 100) this.markedForDeletion = true;
                setGlow('rgba(255, 50, 50, 0.6)', 25);
                ctx.save(); ctx.translate(this.x + this.width/2, this.y + this.height/2);
                ctx.rotate(this.angle); ctx.scale(-1, 1); 
                safeDrawImage(this.image, -this.width/2, -this.height/2, this.width, this.height);
                ctx.restore(); resetGlow();
            } else {
                this.x -= gameSpeed;
                if (this.x < -this.width) this.markedForDeletion = true;
                if (this.type === 'tree') {
                    this.sway = Math.sin(frames * 0.05) * 0.05; 
                    setGlow('rgba(0, 255, 0, 0.3)', 15); 
                    ctx.save(); ctx.translate(this.x + this.width/2, this.y + this.height); ctx.rotate(this.sway);
                    safeDrawImage(this.image, -this.width/2, -this.height, this.width, this.height);
                    ctx.restore(); resetGlow();
                } else {
                    setGlow('rgba(255, 50, 50, 0.6)', 25);
                    safeDrawImage(this.image, this.x, this.y, this.width, this.height);
                    resetGlow();
                }
            }
        }
    }

    class Food {
        constructor() {
            this.x = BASE_WIDTH; this.width = 45; this.height = 45;
            this.y = FLOOR_Y - 50 - Math.random() * 150; 
            this.markedForDeletion = false; this.wobble = 0;
        }
        update() {
            this.x -= gameSpeed; this.wobble += 0.1;
            this.y += Math.sin(this.wobble) * 0.5; 
            if (this.x < -this.width) this.markedForDeletion = true;
            setGlow('rgba(255, 215, 0, 0.8)', 25);
            safeDrawImage(imgFood, this.x, this.y, this.width, this.height);
            resetGlow();
        }
    }

    function getRandomObstacleType() {
        let rand = Math.random();
        if (rand < 0.3) return 'trap'; else if (rand < 0.5) return 'spike'; else if (rand < 0.7) return 'tree'; else return 'axe';
    }

    function handleObstacles() {
        let interval = Math.floor(130 - gameSpeed * 5);
        if (interval < 60) interval = 60;
        if (frames % interval === 0) {
            let type = getRandomObstacleType();
            let attempts = 0;
            while (type === lastObstacleType && attempts < 10) { type = getRandomObstacleType(); attempts++; }
            lastObstacleType = type; obstacles.push(new Obstacle(type));
        }
        obstacles.forEach((obs, index) => {
            obs.update();
            if (collision(beaver, obs)) gameOver();
            if (obs.markedForDeletion) obstacles.splice(index, 1);
        });
    }

    function handleFood() {
        if (frames % 250 === 0) {
            let isSafe = true;
            obstacles.forEach(obs => { if (obs.x > BASE_WIDTH - 150) isSafe = false; });
            if (isSafe) foods.push(new Food());
        }
        foods.forEach((food, index) => {
            food.update();
            if (collision(beaver, food)) { score += 50; foods.splice(index, 1); }
            if (food.markedForDeletion) foods.splice(index, 1);
        });
    }

    function collision(p, o) {
        const pP = 15; const pX = p.x + pP; const pY = p.y + pP; const pW = p.width - 2 * pP; const pH = p.height - 2 * pP;
        let oX, oY, oW, oH;
        if (o.type === 'trap') { oX = o.x + 25; oW = o.width - 50; oY = o.y + (o.height * 0.6); oH = o.height * 0.4; }
        else if (o.type === 'spike') { oX = o.x + 20; oW = o.width - 40; oY = o.y + 20; oH = o.height - 20; }
        else if (o.type === 'tree') { oX = o.x + 30; oW = o.width - 60; oY = o.y; oH = o.height * 0.5; }
        else { const s = o.width * 0.3; oX = o.x + s; oY = o.y + s; oW = o.width - (s * 2); oH = o.height - (s * 2); }
        return (pX < oX + oW && pX + pW > oX && pY < oY + oH && pY + pH > oY);
    }

    function drawScore() {
        ctx.fillStyle = 'white'; ctx.font = 'bold 24px Arial'; ctx.shadowColor = "black"; ctx.shadowBlur = 4;
        ctx.fillText('Skóre: ' + Math.floor(score), 20, 40); resetGlow();
    }

    function gameOver() {
        gameRunning = false;
        try { bgMusic.pause(); } catch(e) {}
        cancelAnimationFrame(animationId);
        
        const finalScore = Math.floor(score);

        if (db && finalScore > globalHighScore) {
            db.ref('bobri_utek_rekord').set({
                name: currentPlayerNick || "Neznámý Bobr",
                score: finalScore
            });
            titleDisplay.innerText = "NOVÝ REKORD!";
            titleDisplay.style.color = "#FFD700";
        } else {
            titleDisplay.innerText = "Bobr je v pasti – a teď z něj budou papuče!";
            titleDisplay.style.color = "#FF0000";
        }

        overlay.style.display = 'flex';
        nickInput.style.display = 'none'; 
        
        scoreDisplay.style.display = 'block';
        scoreDisplay.innerText = `Tvé skóre: ${finalScore}`;
        
        startBtn.style.display = 'block';
        startBtn.innerText = "ZKUSIT ZNOVU";
        
        fullscreenBtn.style.display = 'inline-block';
    }

    // --- RESET A START ---
    function resetGame() {
        if (!gameRunning && nickInput.style.display !== 'none') {
            const val = nickInput.value.trim();
            if (val === "") {
                nickInput.style.border = "2px solid red";
                nickInput.placeholder = "! Zadej jméno !";
                return; 
            }
            currentPlayerNick = val;
            nickInput.style.display = 'none';
        }

        score = 0; frames = 0; gameSpeed = 2.5; 
        obstacles.length = 0; foods.length = 0; lastObstacleType = null; 
        beaver.init(); gameRunning = true; 
        overlay.style.display = 'none';
        
        try {
            bgMusic.currentTime = 0;
            bgMusic.play().catch(e => console.log("Audio error:", e));
        } catch(e) {}
        animate();
    }

    function animate() {
        if (!gameRunning) return;
        ctx.clearRect(0, 0, BASE_WIDTH, BASE_HEIGHT);
        background.update(); handleObstacles(); ground.update(); handleFood(); beaver.update(); drawScore();
        score += 0.05; frames++; if (frames % 800 === 0) gameSpeed += 0.3; 
        animationId = requestAnimationFrame(animate);
    }

    const resizeObserver = new ResizeObserver(() => { resizeCanvas(); });
    resizeObserver.observe(gameContainer);

    fullscreenBtn.addEventListener('click', () => {
        gameContainer.classList.toggle('expanded');
        if (gameBackdrop) gameBackdrop.classList.toggle('active');
        fullscreenBtn.innerText = gameContainer.classList.contains('expanded') ? "❌" : "🔍";
        setTimeout(resizeCanvas, 310); 
    });

    if(gameBackdrop) gameBackdrop.addEventListener('click', () => fullscreenBtn.click());
    document.addEventListener('keydown', (e) => { if (e.key === "Escape" && gameContainer.classList.contains('expanded')) fullscreenBtn.click(); });

    window.addEventListener('keydown', function(e) {
        if (e.code === 'Space' || e.code === 'ArrowUp') {
            e.preventDefault(); 
            if (e.repeat) return;
            if (gameRunning) beaver.jump();
            else if (overlay.style.display !== 'none') {
                 if (nickInput.style.display === 'none' || nickInput.value.trim() !== "") resetGame();
            }
        }
    });
    canvas.addEventListener('mousedown', () => { if (gameRunning) beaver.jump(); });
    startBtn.addEventListener('click', resetGame);

    resizeCanvas();
    drawStaticScene();
    imgBackground.onload = drawStaticScene;
    imgGround.onload = drawStaticScene;
    imgBeaver.onload = drawStaticScene;
});
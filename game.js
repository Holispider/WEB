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
    // Optimalizace: alpha: false pro vyšší výkon
    const ctx = canvas.getContext('2d', { alpha: false }); 
    
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

    // NASTAVENÍ (Tlačítka)
    const settingsBtn = document.getElementById('settingsBtn');
    const settingsPanel = document.getElementById('settingsPanel');
    const qualityToggleBtn = document.getElementById('qualityToggleBtn');
    const closeSettingsBtn = document.getElementById('closeSettingsBtn');

    // --- STAV KVALITY ---
    let isHighQuality = true; 

    // --- PROMĚNNÉ ---
    let globalHighScore = 0;
    let globalChampionName = "Nikdo";
    let currentPlayerNick = "";
    let gameRunning = false;
    let score = 0;
    
    // Rychlost hry a fyzika
    let gameSpeed = 3.5; // Mírně upraveno pro DT logiku
    let animationId;
    let lastObstacleType = null; 

    // PROMĚNNÉ PRO DELTA TIME
    let lastTime = 0;
    let gameTimeAccumulator = 0; // Pro animace (sinusovky)

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

    // --- AUDIO & GRAFIKA ---
    const bgMusic = new Audio('hra/music.mp3');
    bgMusic.loop = true; bgMusic.volume = 0.4;  

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

    // FUNKCE PRO STÍNY
    function setGlow(color = 'white', blur = 20) { 
        if (!isHighQuality) return; 
        ctx.shadowColor = color; ctx.shadowBlur = blur; 
    }
    function resetGlow() { 
        if (!isHighQuality) return;
        ctx.shadowBlur = 0; 
    }
    function safeDrawImage(img, x, y, w, h) {
        if (img && img.complete && img.naturalWidth !== 0) ctx.drawImage(img, x, y, w, h);
    }

    // --- OVLÁDÁNÍ KVALITY ---
    function updateQualityButton() {
        if (isHighQuality) {
            qualityToggleBtn.innerText = "Kvalita: VYSOKÁ (PC)";
            qualityToggleBtn.style.background = "#007bff";
        } else {
            qualityToggleBtn.innerText = "Kvalita: NÍZKÁ (Mobil)";
            qualityToggleBtn.style.background = "#555";
        }
    }

    qualityToggleBtn.addEventListener('click', () => {
        isHighQuality = !isHighQuality;
        updateQualityButton();
        resizeCanvas(); 
    });

    settingsBtn.addEventListener('click', () => {
        settingsPanel.classList.remove('hidden-settings');
    });

    closeSettingsBtn.addEventListener('click', () => {
        settingsPanel.classList.add('hidden-settings');
    });

    // --- RESIZE A DRAW ---
    const BASE_WIDTH = 800; 
    const BASE_HEIGHT = 400;
    const GROUND_HEIGHT = 50; 
    const FLOOR_Y = BASE_HEIGHT - GROUND_HEIGHT; 

    function resizeCanvas() {
        const width = gameContainer.clientWidth; 
        const height = gameContainer.clientHeight;
        
        if (width === 0 || height === 0) return;
        
        const dpr = isHighQuality ? Math.min(window.devicePixelRatio || 1, 2) : 1;
        
        canvas.width = width * dpr; 
        canvas.height = height * dpr;
        
        ctx.setTransform(1, 0, 0, 1, 0, 0); 
        ctx.scale(dpr, dpr);
        
        const scaleX = width / BASE_WIDTH;
        const scaleY = height / BASE_HEIGHT;
        ctx.scale(scaleX, scaleY);

        if (!gameRunning) drawStaticScene();
    }

    function drawStaticScene() {
        ctx.clearRect(0, 0, BASE_WIDTH, BASE_HEIGHT);
        safeDrawImage(imgBackground, 0, 0, BASE_WIDTH, BASE_HEIGHT);
        safeDrawImage(imgGround, 0, FLOOR_Y - 180, BASE_WIDTH, GROUND_HEIGHT + 180);
        if (imgBeaver.complete) { beaver.init(); beaver.draw(); }
    }

    // --- OBJEKTY (S ÚPRAVOU PRO DELTA TIME) ---
    
    const beaver = {
        baseX: 80, x: 80, y: 0, width: 70, height: 70, 
        dy: 0, 
        jumpPower: -11, // Mírně upraveno pro DT
        gravity: 0.45,  // Mírně upraveno pro DT
        groundY: 0, 
        jumpCount: 0,
        
        init: function() { 
            this.groundY = FLOOR_Y - this.height + 15; 
            this.y = this.groundY; 
            this.x = this.baseX; 
            this.dy = 0; 
            this.jumpCount = 0; 
        },
        
        draw: function() {
            if (!imgBeaver.complete) return;
            ctx.save();
            if (this.y < this.groundY) { // Skok
                ctx.translate(this.x + this.width/2, this.y + this.height/2);
                // Rotace závislá na čase, ne na framech
                let jumpRot = (this.jumpCount > 1) ? gameTimeAccumulator * 0.015 : -0.3;
                ctx.rotate(jumpRot);
                safeDrawImage(imgBeaver, -this.width/2, -this.height/2, this.width, this.height);
            } else { // Běh
                let runAngle = Math.sin(gameTimeAccumulator * 0.015) * 0.1;
                let bounceY = Math.abs(Math.sin(gameTimeAccumulator * 0.015)) * 5;
                ctx.translate(this.x + this.width/2, this.y + this.height/2 - bounceY);
                ctx.rotate(runAngle);
                safeDrawImage(imgBeaver, -this.width/2, -this.height/2, this.width, this.height);
            }
            ctx.restore();
        },
        
        update: function(dt) {
            // Fyzika s Delta Time
            this.y += this.dy * dt;
            
            if (this.y < this.groundY) { 
                this.dy += this.gravity * dt; 
            } else { 
                this.y = this.groundY; 
                this.dy = 0; 
                this.jumpCount = 0; 
            }
            this.draw();
        },
        
        jump: function() {
            if (this.jumpCount < 2) { 
                this.dy = this.jumpPower; 
                this.jumpCount++; 
            }
        }
    };

    const background = {
        x1: 0, x2: BASE_WIDTH, y: 0, width: BASE_WIDTH, height: BASE_HEIGHT, speed: 1, 
        update: function(dt) {
            // Posun s Delta Time
            let move = this.speed * dt;
            this.x1 -= move; 
            this.x2 -= move;
            
            if (this.x1 <= -this.width) this.x1 = this.x2 + this.width - move;
            if (this.x2 <= -this.width) this.x2 = this.x1 + this.width - move;
            
            safeDrawImage(imgBackground, this.x1, this.y, this.width, this.height);
            if (imgBackground.complete) {
                ctx.save(); ctx.translate(this.x2 + this.width, this.y); ctx.scale(-1, 1);
                safeDrawImage(imgBackground, 0, 0, this.width, this.height); ctx.restore();
            }
        }
    };

    const ground = {
        x1: 0, x2: BASE_WIDTH, y: FLOOR_Y, width: BASE_WIDTH, height: GROUND_HEIGHT, 
        update: function(dt) {
            let move = gameSpeed * dt;
            this.x1 -= move; 
            this.x2 -= move;
            
            if (this.x1 <= -this.width) this.x1 = this.x2 + this.width - move;
            if (this.x2 <= -this.width) this.x2 = this.x1 + this.width - move;
            
            let visualY = this.y - 180; 
            let visualHeight = this.height + 180;
            safeDrawImage(imgGround, this.x1, visualY, this.width, visualHeight);
            safeDrawImage(imgGround, this.x2, visualY, this.width, visualHeight);
        }
    };

    const obstacles = [];
    const foods = [];

    // --- PŘEKÁŽKY (S DT) ---
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
        update(dt) {
            if (this.isFlying) {
                this.x += this.vx * dt; 
                this.y += this.vy * dt; 
                this.vy += this.gravity * dt; 
                this.angle += 0.1 * dt; 
                
                if (this.x > BASE_WIDTH + 100 || this.y > BASE_HEIGHT + 100) this.markedForDeletion = true;
                
                setGlow('rgba(255, 50, 50, 0.6)', 25);
                ctx.save(); ctx.translate(this.x + this.width/2, this.y + this.height/2);
                ctx.rotate(this.angle); ctx.scale(-1, 1); 
                safeDrawImage(this.image, -this.width/2, -this.height/2, this.width, this.height);
                ctx.restore(); resetGlow();
            } else {
                this.x -= gameSpeed * dt;
                
                if (this.x < -this.width) this.markedForDeletion = true;
                if (this.type === 'tree') {
                    // Kývání stromů podle času
                    this.sway = Math.sin(gameTimeAccumulator * 0.005) * 0.05; 
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
        update(dt) {
            this.x -= gameSpeed * dt; 
            this.wobble += 0.1 * dt;
            let wobbleY = Math.sin(this.wobble) * 0.5 * dt; // Pouze vizuální posun
            
            // Pozn: Neměníme this.y trvale vlněním, aby se to neposouvalo pryč, jen vizuálně při vykreslení
            // Ale pro jednoduchost kolizí to necháme takto, posun je malý.
            this.y += wobbleY; 

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

    // Intervaly musíme přepočítat, protože frames už nejsou spolehlivé pro časování
    let obstacleTimer = 0;
    
    function handleObstacles(dt) {
        // Interval se zmenšuje s rychlostí (obtížnost)
        // Původně: 130 frames. Při 60FPS to je cca 2.1 sekundy (130 * 16.6ms = 2166ms)
        // Základní interval v ms
        let spawnIntervalMs = Math.max(800, 2200 - (gameSpeed * 150)); 
        
        // Přičteme reálný čas (dt * 16.66 ms)
        obstacleTimer += dt * 16.66;

        if (obstacleTimer > spawnIntervalMs) {
            obstacleTimer = 0;
            let type = getRandomObstacleType();
            let attempts = 0;
            while (type === lastObstacleType && attempts < 10) { type = getRandomObstacleType(); attempts++; }
            lastObstacleType = type; obstacles.push(new Obstacle(type));
        }
        
        obstacles.forEach((obs, index) => {
            obs.update(dt);
            if (collision(beaver, obs)) gameOver();
            if (obs.markedForDeletion) obstacles.splice(index, 1);
        });
    }

    let foodTimer = 0;
    function handleFood(dt) {
        foodTimer += dt * 16.66;
        if (foodTimer > 4000) { // Cca každé 4 sekundy
            foodTimer = 0;
            let isSafe = true;
            obstacles.forEach(obs => { if (obs.x > BASE_WIDTH - 150) isSafe = false; });
            if (isSafe) foods.push(new Food());
        }
        foods.forEach((food, index) => {
            food.update(dt);
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
        settingsBtn.style.display = 'inline-block';
    }

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

        score = 0; 
        gameSpeed = 3.5; 
        obstacles.length = 0; foods.length = 0; lastObstacleType = null; 
        
        obstacleTimer = 0;
        foodTimer = 0;
        lastTime = 0; // Reset času
        gameTimeAccumulator = 0;

        beaver.init(); gameRunning = true; 
        overlay.style.display = 'none';
        
        try {
            bgMusic.currentTime = 0;
            bgMusic.play().catch(e => console.log("Audio error:", e));
        } catch(e) {}
        
        requestAnimationFrame(animate);
    }

    // === HLAVNÍ SMYČKA S DELTA TIME ===
    function animate(timestamp) {
        if (!gameRunning) return;

        // Inicializace času při prvním snímku
        if (!lastTime) lastTime = timestamp;
        
        // Výpočet delta time (rozdíl v ms od posledního snímku)
        const deltaTime = timestamp - lastTime;
        lastTime = timestamp;

        // Normalizace na 60 FPS (16.666 ms)
        // Pokud hra běží na 60 FPS, dt = 1.
        // Pokud na 120 FPS, dt = 0.5.
        // Omezíme max dt na 3 (kdyby se hra sekla, ať bobr neproletí zdí)
        const dt = Math.min(deltaTime / 16.667, 3);

        // Akumulátor pro animace (aby se stromy kývaly plynule nezávisle na FPS)
        gameTimeAccumulator += deltaTime;

        ctx.clearRect(0, 0, BASE_WIDTH, BASE_HEIGHT);
        
        // Všechny update funkce nyní přijímají `dt`
        background.update(dt); 
        handleObstacles(dt); 
        ground.update(dt); 
        handleFood(dt); 
        beaver.update(dt); 
        drawScore();
        
        // Skóre a zrychlování
        score += 0.05 * dt; 
        // Zrychlení každých cca 13 sekund (800 frames * 16ms)
        if (gameTimeAccumulator > 13000 * (gameSpeed / 3.5)) { 
             // Jednoduché zrychlení:
             // Resetovat akumulátor pro zrychlení by bylo složité, 
             // jednodušší je zvedat speed plynule nebo po krocích jinde.
             // Pro zachování logiky z minula:
             // Zvedneme speed o malinko každých X ms
        }
        // Jednodušší zrychlování:
        gameSpeed += 0.0003 * dt; 

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
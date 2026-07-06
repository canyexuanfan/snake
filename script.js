class SnakeGame {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.scoreElement = document.getElementById('score');
        this.highScoreElement = document.getElementById('highScore');
        
        // 游戏设置
        this.gridSize = 20;
        this.tileCount = this.canvas.width / this.gridSize;
        
        // 游戏状态
        this.gameRunning = false;
        this.gamePaused = false;
        this.score = 0;
        this.highScore = localStorage.getItem('snakeHighScore') || 0;
        this.difficulty = 300;
        this.baseLevelSpeed = 300;
        this.levelTargetScore = 0;
        this.gameOverState = false; // 游戏是否结束
        this.lastUpdate = Date.now(); // 用于requestAnimationFrame
        this.lives = 3; // 初始化生命值
        
        // 音频上下文
        this.audioContext = null;
        
        // 食物类型定义
        this.FOOD_TYPES = {
            NORMAL: { score: 10, color: '#f56565', effect: null, class: 'food-normal' },
            GOLDEN: { score: 50, color: '#ffd700', effect: 'speedUp', duration: 5000, class: 'food-golden' },
            BOMB: { score: -20, color: '#000', effect: 'shrink', class: 'food-bomb' },
            SLOW: { score: 30, color: '#4299e1', effect: 'slowDown', duration: 3000, class: 'food-slow' }
        };
        
        // 游戏模式
        this.GAME_MODES = {
            CLASSIC: 'classic',
            TIME_ATTACK: 'timeAttack',
            WALLS: 'walls'
        };
        this.currentMode = this.GAME_MODES.CLASSIC;
        this.level = 1;
        this.walls = [];
        
        // 关卡配置 - 暂时不初始化
        this.levels = [];
        this.difficultyProfiles = {
            350: { speedMultiplier: 1.2, targetMultiplier: 0.85 },
            250: { speedMultiplier: 1, targetMultiplier: 1 },
            150: { speedMultiplier: 0.85, targetMultiplier: 1.15 },
            80: { speedMultiplier: 0.7, targetMultiplier: 1.3 }
        };
        this.speedEffectProfiles = {
            350: { speedUp: 0.9, slowDown: 1.1, scoreBonus: 1.05 },
            250: { speedUp: 0.85, slowDown: 1.2, scoreBonus: 1.08 },
            150: { speedUp: 0.8, slowDown: 1.3, scoreBonus: 1.12 },
            80: { speedUp: 0.75, slowDown: 1.4, scoreBonus: 1.15 }
        };
        this.selectedDifficultyValue = 250;
        this.speedMultiplier = 1;
        this.targetMultiplier = 1;
        
        // 统计信息
        this.stats = {
            totalScore: parseInt(localStorage.getItem('snakeTotalScore')) || 0,
            gamesPlayed: parseInt(localStorage.getItem('snakeGamesPlayed')) || 0,
            maxLength: parseInt(localStorage.getItem('snakeMaxLength')) || 1,
            achievements: JSON.parse(localStorage.getItem('snakeAchievements')) || {}
        };
        
        // 蛇的初始状态
        this.snake = [
            {x: 10, y: 10}
        ];
        this.dx = 0;
        this.dy = 0;
        
        // 食物位置
        this.apple = {
            x: 15,
            y: 15,
            type: 'NORMAL'
        };
        this.specialItem = null;
        this.specialItemLifetime = 6000;
        this.specialSpawnMin = 5000;
        this.specialSpawnMax = 9000;
        this.specialDifficultyProfiles = {
            350: { spawnMin: 7000, spawnMax: 11000, lifetime: 9000 },
            250: { spawnMin: 6000, spawnMax: 9000, lifetime: 8000 },
            150: { spawnMin: 5000, spawnMax: 8000, lifetime: 7000 },
            80: { spawnMin: 4000, spawnMax: 7000, lifetime: 6000 }
        };
        this.nextSpecialSpawnAt = Date.now() + 4000;
        
        this.activeEffects = [];
        this.speedEffectMultiplier = 1;
        this.particles = [];
        this.transientMessage = null;
        
        // 音效系统
        this.sounds = {
            eat: { play: () => { this.playSound('eat') }, volume: 0.5 },
            gameOver: { play: () => { this.playSound('gameOver') }, volume: 0.5 },
            levelUp: { play: () => { this.playSound('levelUp') }, volume: 0.5 },
            win: { play: () => { this.playSound('levelUp') }, volume: 0.5 }
        };
        
        this.init();
    }
    
    init() {
        // 初始化关卡配置 - 增加更多关卡和更平滑的难度曲线
        this.levels = [
            { targetScore: 50, speed: 350, wallsConfig: { type: 'none' }, theme: 'grass' },
            { targetScore: 120, speed: 320, wallsConfig: { type: 'simple' }, theme: 'grass' },
            { targetScore: 200, speed: 290, wallsConfig: { type: 'complex', pattern: 'cross' }, theme: 'desert' },
            { targetScore: 300, speed: 260, wallsConfig: { type: 'complex', pattern: 'grid' }, theme: 'desert' },
            { targetScore: 450, speed: 230, wallsConfig: { type: 'complex', pattern: 'spiral' }, theme: 'snow' },
            { targetScore: 600, speed: 200, wallsConfig: { type: 'complex', pattern: 'maze' }, theme: 'snow' },
            { targetScore: 800, speed: 170, wallsConfig: { type: 'complex', pattern: 'random' }, theme: 'lava' }
        ];

        this.updateHighScore();
        this.setupEventListeners();
        this.setupTouchControls();
        this.setupOverlayControls();
        
        const difficultySelect = document.getElementById('difficulty');
        if (difficultySelect) {
            this.applyDifficultyProfile(parseInt(difficultySelect.value, 10));
        }

        // 初始化第一关
        this.level = 1;
        this.loadLevel(this.level);
    }

    setupOverlayControls() {
        const overlayStartBtn = document.getElementById('overlayStartBtn');
        const overlay = document.getElementById('gameOverlay');

        overlayStartBtn.addEventListener('click', () => {
            this.initAudio();
            this.resetGame();
            overlay.style.opacity = '0';
            setTimeout(() => {
                overlay.style.display = 'none';
                this.startGame();
            }, 300);
        });
        
        // Modal controls
        const statsModal = document.getElementById('statsModal');
        const closeModal = document.querySelector('.close-modal');
        
        closeModal.addEventListener('click', () => {
            statsModal.style.display = 'none';
        });
        
        window.addEventListener('click', (e) => {
            if (e.target === statsModal) {
                statsModal.style.display = 'none';
            }
        });
    }

    loadLevel(levelIndex) {
        const levelConfig = this.levels[levelIndex - 1];
        if (!levelConfig) {
            return;
        }
        this.updateLevelParams();
        
        // 生成墙壁
        if (levelConfig.wallsConfig.type === 'simple') {
            this.walls = this.generateSimpleWalls();
        } else if (levelConfig.wallsConfig.type === 'complex') {
            this.walls = this.generateComplexWalls(levelConfig.wallsConfig.pattern);
        } else {
            this.walls = [];
        }

        this.walls = this.applyWallDensityLimit(this.walls, levelConfig.wallsConfig.pattern);
        this.ensureItemPositions();
        
        this.updateTheme(); // 更新主题
        this.drawGame();
    }
    
    levelUp() {
        this.level++;
        if (this.level > this.levels.length) {
            this.gameWon = true;
            this.gameOver();
            this.showMessage('恭喜通关! 你是贪吃蛇大师!');
            this.sounds.win.play();
            return;
        }

        this.loadLevel(this.level);
        this.sounds.levelUp.play();
        this.showLevelUpMessage();

        // 增加关卡奖励效果
        if (this.level % 2 === 0) {
            // 每升2级增加一条生命
            this.lives++;
            this.showMessage(`+1 生命! 当前生命: ${this.lives}`);
        }
    }
    
    setupEventListeners() {
        // 键盘控制
        document.addEventListener('keydown', (e) => {
            this.initAudio();
            if (!this.gameRunning && !this.gameOverState) {
                this.startGame();
            }
            if (this.gamePaused) {
                this.togglePause();
            }
            if (!this.gameRunning || this.gamePaused) return;
            
            switch(e.key) {
                case 'ArrowUp':
                    if (this.dy !== 1) {
                        this.dx = 0;
                        this.dy = -1;
                    }
                    break;
                case 'ArrowDown':
                    if (this.dy !== -1) {
                        this.dx = 0;
                        this.dy = 1;
                    }
                    break;
                case 'ArrowLeft':
                    if (this.dx !== 1) {
                        this.dx = -1;
                        this.dy = 0;
                    }
                    break;
                case 'ArrowRight':
                    if (this.dx !== -1) {
                        this.dx = 1;
                        this.dy = 0;
                    }
                    break;
            }
        });
        
        // 按钮控制
        document.getElementById('startBtn').addEventListener('click', () => {
            this.initAudio();
            if (this.gameOverState) {
                // If game over, reset then start is handled by overlay
                const overlay = document.getElementById('gameOverlay');
                overlay.style.display = 'flex';
                setTimeout(() => { overlay.style.opacity = '1'; }, 10);
            } else if (!this.gameRunning) {
                this.startGame();
            } else {
                this.togglePause();
            }
        });
        
        document.getElementById('resetBtn').addEventListener('click', () => {
            this.resetGame();
        });

        document.getElementById('statsBtn').addEventListener('click', () => {
            const statsModal = document.getElementById('statsModal');
            statsModal.style.display = 'flex';
            this.updateStatsDisplay();
        });

        document.getElementById('difficulty').addEventListener('change', (e) => {
            this.applyDifficultyProfile(parseInt(e.target.value, 10));
        });
        
        // 移动端控制
        document.querySelectorAll('.dpad-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                if (!this.gameRunning || this.gamePaused) return;
                
                const direction = e.target.dataset.direction;
                switch(direction) {
                    case 'up':
                        if (this.dy !== 1) {
                            this.dx = 0;
                            this.dy = -1;
                        }
                        break;
                    case 'down':
                        if (this.dy !== -1) {
                            this.dx = 0;
                            this.dy = 1;
                        }
                        break;
                    case 'left':
                        if (this.dx !== 1) {
                            this.dx = -1;
                            this.dy = 0;
                        }
                        break;
                    case 'right':
                        if (this.dx !== -1) {
                            this.dx = 1;
                            this.dy = 0;
                        }
                        break;
                }
            });
        });
    }
    
    startGame() {
        if (this.gameRunning) return;
        this.gameOverState = false;
        
        // Hide overlay if visible
        const overlay = document.getElementById('gameOverlay');
        overlay.style.opacity = '0';
        setTimeout(() => {
            overlay.style.display = 'none';
        }, 300);

        this.gameRunning = true;
        this.gamePaused = false;
        this.dx = 1;
        this.dy = 0;
        
        // Reset timestamp to prevent large delta
        this.lastUpdate = Date.now();
        
        const startButton = document.getElementById('startBtn');
        const startIcon = startButton ? startButton.querySelector('.icon') : null;
        if (startButton) {
            startButton.disabled = false;
            startButton.title = '暂停';
        }
        if (startIcon) {
            startIcon.textContent = '⏸';
        }
        if (!this.specialItem) {
            this.nextSpecialSpawnAt = Date.now() + 2000;
        }
        
        this.gameLoop();
    }
    
    togglePause() {
        if (!this.gameRunning) return;
        
        this.gamePaused = !this.gamePaused;
        const startButton = document.getElementById('startBtn');
        const startIcon = startButton ? startButton.querySelector('.icon') : null;
        if (startButton) {
            startButton.title = this.gamePaused ? '继续' : '暂停';
        }
        if (startIcon) {
            startIcon.textContent = this.gamePaused ? '▶' : '⏸';
        }
        
        if (!this.gamePaused) {
            this.gameLoop();
        }
    }
    
    resetGame() {
        this.gameRunning = false;
        this.gamePaused = false;
        this.gameOverState = false;
        this.gameWon = false;
        this.score = 0;
        this.dx = 0;
        this.dy = 0;
        this.activeEffects = [];
        this.specialItem = null;
        this.nextSpecialSpawnAt = Date.now() + 4000;
        this.level = 1;
        this.loadLevel(this.level);
        this.difficulty = this.baseLevelSpeed;
        this.updateSpeedIndicator();
        this.updateSpeedStatus();
        
        this.snake = [{x: 10, y: 10}];
        this.generateApple();
        
        const startButton = document.getElementById('startBtn');
        const startIcon = startButton ? startButton.querySelector('.icon') : null;
        if (startButton) {
            startButton.disabled = false;
            startButton.title = '开始游戏';
        }
        if (startIcon) {
            startIcon.textContent = '▶';
        }
        
        this.updateScore();
        this.drawGame();
    }
    
    gameLoop() {
        if (!this.gameRunning || this.gamePaused) return;
        
        const now = Date.now();
        const delta = now - this.lastUpdate;
        
        if (delta > this.difficulty) {
            this.lastUpdate = now - (delta % this.difficulty);
            
            this.clearCanvas();
            this.updateEffects();
            this.updateParticles();
            this.updateSpecialItem();
            this.moveSnake();
            this.drawWalls();
            this.drawApple();
            this.drawSpecialItem();
            this.drawSnake();
            this.drawParticles();
            this.checkLevelProgress();
            this.drawSpeedEffectStatus();
            this.drawTransientMessage();
        }
        
        requestAnimationFrame(() => this.gameLoop());
    }
    
    clearCanvas() {
        this.ctx.fillStyle = this.themeColors?.bgColor || '#2d3748';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }
    
    initAudio() {
        if (!this.audioContext) {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        }
        if (this.audioContext.state === 'suspended') {
            this.audioContext.resume();
        }
    }

    // 新增playSound方法实现
    playSound(type) {
        if (!this.audioContext) return;
        
        try {
            const audioContext = this.audioContext;
            
            switch(type) {
                case 'eat':
                    const oscillator = audioContext.createOscillator();
                    oscillator.type = 'sine';
                    oscillator.frequency.setValueAtTime(523.25, audioContext.currentTime); // C5
                    oscillator.frequency.setValueAtTime(659.25, audioContext.currentTime + 0.1); // E5
                    oscillator.connect(audioContext.destination);
                    oscillator.start();
                    oscillator.stop(audioContext.currentTime + 0.2);
                    break;
                    
                case 'gameOver':
                    const oscillator2 = audioContext.createOscillator();
                    oscillator2.type = 'sawtooth';
                    oscillator2.frequency.setValueAtTime(220.00, audioContext.currentTime); // A3
                    oscillator2.frequency.setValueAtTime(146.83, audioContext.currentTime + 0.3); // D3
                    oscillator2.connect(audioContext.destination);
                    oscillator2.start();
                    oscillator2.stop(audioContext.currentTime + 0.6);
                    break;
                    
                case 'levelUp':
                    const oscillator3 = audioContext.createOscillator();
                    oscillator3.type = 'triangle';
                    oscillator3.frequency.setValueAtTime(523.25, audioContext.currentTime); // C5
                    oscillator3.frequency.setValueAtTime(659.25, audioContext.currentTime + 0.1); // E5
                    oscillator3.frequency.setValueAtTime(783.99, audioContext.currentTime + 0.2); // G5
                    oscillator3.connect(audioContext.destination);
                    oscillator3.start();
                    oscillator3.stop(audioContext.currentTime + 0.4);
                    break;
            }
        } catch (e) {
            console.error('音效播放失败:', e);
        }
    }

    setupTouchControls() {
        let touchStartX = 0;
        let touchStartY = 0;
        let lastTouchTime = 0;
        
        document.addEventListener('touchstart', (e) => {
            this.initAudio();
            touchStartX = e.touches[0].clientX;
            touchStartY = e.touches[0].clientY;
            lastTouchTime = Date.now();
        }, { passive: true });
        
        document.addEventListener('touchend', (e) => {
            if (Date.now() - lastTouchTime > 300) return;
            
            const touchEndX = e.changedTouches[0].clientX;
            const touchEndY = e.changedTouches[0].clientY;
            
            const diffX = touchEndX - touchStartX;
            const diffY = touchEndY - touchStartY;
            
            if (Math.abs(diffX) > 20 || Math.abs(diffY) > 20) {
                if (Math.abs(diffX) > Math.abs(diffY)) {
                    if (diffX > 0) {
                        this.handleSwipe('right');
                    } else {
                        this.handleSwipe('left');
                    }
                } else {
                    if (diffY > 0) {
                        this.handleSwipe('down');
                    } else {
                        this.handleSwipe('up');
                    }
                }
            }
        }, { passive: true });
    }
    
    handleSwipe(direction) {
        if (!this.gameRunning || this.gamePaused) return;
        
        switch(direction) {
            case 'up':
                if (this.dy !== 1) {
                    this.dx = 0;
                    this.dy = -1;
                }
                break;
            case 'down':
                if (this.dy !== -1) {
                    this.dx = 0;
                    this.dy = 1;
                }
                break;
            case 'left':
                if (this.dx !== 1) {
                    this.dx = -1;
                    this.dy = 0;
                }
                break;
            case 'right':
                if (this.dx !== -1) {
                    this.dx = 1;
                    this.dy = 0;
                }
                break;
        }
    }
    
    gameOver() {
        if (this.gameOverState) {
            return;
        }
        this.gameRunning = false;
        this.gamePaused = false;
        this.gameOverState = true;

        this.stats.gamesPlayed += 1;
        localStorage.setItem('snakeGamesPlayed', this.stats.gamesPlayed);
        
        const startButton = document.getElementById('startBtn');
        const startIcon = startButton ? startButton.querySelector('.icon') : null;
        if (startButton) {
            startButton.disabled = false;
            startButton.title = '开始游戏';
        }
        if (startIcon) {
            startIcon.textContent = '▶';
        }
        
        // Show overlay
        const overlay = document.getElementById('gameOverlay');
        const title = document.getElementById('overlayTitle');
        const msg = document.getElementById('overlayMessage');
        const btn = document.getElementById('overlayStartBtn');
        
        title.textContent = '游戏结束';
        msg.innerHTML = `最终得分: ${this.score}<br>最高分: ${this.highScore}`;
        btn.textContent = '再试一次';
        
        overlay.style.display = 'flex';
        setTimeout(() => {
            overlay.style.opacity = '1';
        }, 10);
        
        this.sounds.gameOver.play();
    }
    
    updateHighScore() {
        this.highScoreElement.textContent = `${this.highScore}`;
    }
    
    updateScore() {
        this.scoreElement.textContent = `${this.score}`;
    }
    
    generateApple() {
        const blocked = this.specialItem ? [this.specialItem] : [];
        const position = this.getRandomEmptyPosition(blocked);
        if (!position) {
            this.gameOver();
            return;
        }
        this.apple.x = position.x;
        this.apple.y = position.y;
        this.apple.type = 'NORMAL';
    }
    
    moveSnake() {
        const head = {x: this.snake[0].x + this.dx, y: this.snake[0].y + this.dy};
        
        // 检查是否撞墙
        if (head.x < 0 || head.x >= this.tileCount || head.y < 0 || head.y >= this.tileCount) {
            this.gameOver();
            return;
        }
        
        // 检查是否撞到自己
        for (let segment of this.snake) {
            if (segment.x === head.x && segment.y === head.y) {
                this.gameOver();
                return;
            }
        }
        
        // 检查是否撞到墙壁
        for (let wall of this.walls) {
            if (wall.x === head.x && wall.y === head.y) {
                this.gameOver();
                return;
            }
        }
        
        this.snake.unshift(head);
        
        const ateApple = head.x === this.apple.x && head.y === this.apple.y;
        const ateSpecial = this.specialItem && head.x === this.specialItem.x && head.y === this.specialItem.y;

        // 检查是否吃到苹果
        if (ateApple) {
            const foodType = this.FOOD_TYPES[this.apple.type];
            const scoreDelta = this.getScoreWithSpeedBonus(foodType.score);
            this.score += scoreDelta;
            this.updateScore();
            
            // 播放吃食物音效
            this.sounds.eat.play();
            
            // 处理食物效果
            if (foodType.effect) {
                this.applyEffect(foodType.effect, foodType.duration);
            }
            
            // 更新最高分
            if (this.score > this.highScore) {
                this.highScore = this.score;
                localStorage.setItem('snakeHighScore', this.highScore);
                this.updateHighScore();
            }
            
            // 更新统计
            this.stats.totalScore += scoreDelta;
            localStorage.setItem('snakeTotalScore', this.stats.totalScore);
            
            // 生成新苹果
            this.generateApple();
        } else if (!ateSpecial) {
            // 如果没有吃到苹果，移除尾部
            this.snake.pop();
        }

        if (ateSpecial) {
            const specialType = this.FOOD_TYPES[this.specialItem.type];
            const specialScoreDelta = this.getScoreWithSpeedBonus(specialType.score);
            this.score += specialScoreDelta;
            this.updateScore();
            this.sounds.eat.play();
            if (specialType.effect) {
                this.applyEffect(specialType.effect, specialType.duration);
            }
            if (this.score > this.highScore) {
                this.highScore = this.score;
                localStorage.setItem('snakeHighScore', this.highScore);
                this.updateHighScore();
            }
            this.stats.totalScore += specialScoreDelta;
            localStorage.setItem('snakeTotalScore', this.stats.totalScore);
            this.specialItem = null;
            this.nextSpecialSpawnAt = Date.now() + this.getRandomSpecialSpawnDelay();
        }

        if ((ateApple || ateSpecial) && this.snake.length > this.stats.maxLength) {
            this.stats.maxLength = this.snake.length;
            localStorage.setItem('snakeMaxLength', this.stats.maxLength);
        }
    }
    
    applyEffect(effect, duration) {
        this.activeEffects = this.activeEffects.filter(e => e.type !== effect);
        const effectDuration = this.getEffectDuration(effect, duration);
        this.activeEffects.push({type: effect, startTime: Date.now(), duration: effectDuration});
        
        switch(effect) {
            case 'shrink':
                if (this.snake.length > 1) {
                    this.snake = this.snake.slice(0, Math.max(1, this.snake.length - 3));
                }
                break;
        }
        
        this.updateSpeedFromEffects();
    }
    
    updateEffects() {
        const now = Date.now();
        let speedChanged = false;
        
        for (let i = this.activeEffects.length - 1; i >= 0; i--) {
            const effect = this.activeEffects[i];
            
            if (now - effect.startTime >= effect.duration) {
                if (effect.type === 'speedUp' || effect.type === 'slowDown') {
                    speedChanged = true;
                }
                this.activeEffects.splice(i, 1);
            }
        }
        
        if (speedChanged) {
            this.updateSpeedFromEffects();
        }
    }
    
    updateParticles() {
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const particle = this.particles[i];
            particle.x += particle.vx;
            particle.y += particle.vy;
            particle.size -= 0.1;
            particle.alpha -= 0.01;
            
            if (particle.size <= 0 || particle.alpha <= 0) {
                this.particles.splice(i, 1);
            }
        }
    }
    
    drawParticles() {
        for (let particle of this.particles) {
            this.ctx.globalAlpha = particle.alpha;
            this.ctx.fillStyle = particle.color;
            this.ctx.beginPath();
            this.ctx.arc(
                particle.x * this.gridSize + this.gridSize / 2,
                particle.y * this.gridSize + this.gridSize / 2,
                particle.size,
                0,
                Math.PI * 2
            );
            this.ctx.fill();
            this.ctx.globalAlpha = 1;
        }
    }
    
    drawSnake() {
        for (let i = 0; i < this.snake.length; i++) {
            const segment = this.snake[i];
            
            if (i === 0) {
                // 蛇头
                this.drawSnakeHead(segment);
            } else {
                // 蛇身
                this.drawSnakeBody(segment, i);
            }
        }
    }
    
    generateSimpleWalls() {
        const walls = [];
        // 在边缘生成简单墙壁
        for (let i = 0; i < this.tileCount; i++) {
            walls.push({x: i, y: 0});
            walls.push({x: i, y: this.tileCount - 1});
            walls.push({x: 0, y: i});
            walls.push({x: this.tileCount - 1, y: i});
        }
        return walls;
    }
    
    generateComplexWalls(pattern) {
        const walls = this.generateSimpleWalls();
        const wallPattern = pattern || 'random';

        // 根据不同模式生成复杂墙壁
        switch(wallPattern) {
            case 'cross':
                // 十字形布局
                const center = Math.floor(this.tileCount / 2);
                for (let i = 3; i < this.tileCount - 3; i++) {
                    walls.push({x: center, y: i});
                    walls.push({x: i, y: center});
                }
                break;
            case 'grid':
                // 网格布局
                for (let i = 3; i < this.tileCount - 3; i += 5) {
                    for (let j = 3; j < this.tileCount - 3; j += 5) {
                        walls.push({x: i, y: j});
                        walls.push({x: i + 1, y: j});
                        walls.push({x: i, y: j + 1});
                        walls.push({x: i + 1, y: j + 1});
                    }
                }
                break;
            case 'spiral':
                // 螺旋形布局
                let x = Math.floor(this.tileCount / 2);
                let y = Math.floor(this.tileCount / 2);
                let dx = 1;
                let dy = 0;
                let steps = 1;
                let turnCount = 0;

                for (let i = 0; i < 30; i++) {
                    for (let j = 0; j < steps; j++) {
                        if (x > 2 && x < this.tileCount - 3 && y > 2 && y < this.tileCount - 3) {
                            walls.push({x, y});
                        }
                        x += dx;
                        y += dy;
                    }
                    // 改变方向
                    const temp = dx;
                    dx = -dy;
                    dy = temp;
                    turnCount++;
                    // 每两次转弯增加步数
                    if (turnCount % 2 === 0) {
                        steps++;
                    }
                }
                break;
            case 'maze':
                // 简单迷宫布局
                const maze = [];
                for (let i = 0; i < this.tileCount; i++) {
                    maze[i] = [];
                    for (let j = 0; j < this.tileCount; j++) {
                        maze[i][j] = false;
                    }
                }

                // 递归回溯算法生成迷宫
                function carveMaze(x, y) {
                    const directions = [[0, -1], [1, 0], [0, 1], [-1, 0]];
                    directions.sort(() => Math.random() - 0.5);

                    for (const [dx, dy] of directions) {
                        const nx = x + dx * 2;
                        const ny = y + dy * 2;
                        if (nx > 2 && nx < this.tileCount - 3 && ny > 2 && ny < this.tileCount - 3 && !maze[nx][ny]) {
                            maze[nx][ny] = true;
                            maze[x + dx][y + dy] = true;
                            carveMaze.call(this, nx, ny);
                        }
                    }
                }

                carveMaze.call(this, 3, 3);
                maze[3][3] = true;

                for (let i = 0; i < this.tileCount; i++) {
                    for (let j = 0; j < this.tileCount; j++) {
                        if (!maze[i][j] && (i % 2 === 1 || j % 2 === 1)) {
                            walls.push({x: i, y: j});
                        }
                    }
                }
                break;
            default:
                // 随机布局
                for (let i = 3; i < this.tileCount - 3; i += 4) {
                    for (let j = 3; j < this.tileCount - 3; j += 4) {
                        if (Math.random() > 0.3) {
                            walls.push({x: i, y: j});
                            if (Math.random() > 0.5) {
                                walls.push({x: i + 1, y: j});
                            }
                            if (Math.random() > 0.5) {
                                walls.push({x: i, y: j + 1});
                            }
                        }
                    }
                }
        }

        return walls;
    }

    applyWallDensityLimit(walls, pattern) {
        if (!walls || walls.length === 0) {
            return [];
        }
        const unique = new Map();
        for (const wall of walls) {
            unique.set(`${wall.x},${wall.y}`, wall);
        }
        const deduped = Array.from(unique.values());
        const edgeWalls = [];
        const interiorWalls = [];
        for (const wall of deduped) {
            const isEdge = wall.x === 0 || wall.y === 0 || wall.x === this.tileCount - 1 || wall.y === this.tileCount - 1;
            if (isEdge) {
                edgeWalls.push(wall);
            } else {
                interiorWalls.push(wall);
            }
        }
        const snakeBlocks = new Set(this.snake.map(segment => `${segment.x},${segment.y}`));
        const appleBlock = this.apple ? `${this.apple.x},${this.apple.y}` : null;
        const specialBlock = this.specialItem ? `${this.specialItem.x},${this.specialItem.y}` : null;
        const head = this.snake?.[0];
        const isNearHead = (wall) => {
            if (!head) {
                return false;
            }
            const dx = Math.abs(wall.x - head.x);
            const dy = Math.abs(wall.y - head.y);
            return dx + dy <= 1;
        };
        const filteredInterior = interiorWalls.filter(wall => {
            const key = `${wall.x},${wall.y}`;
            if (key === appleBlock || key === specialBlock || snakeBlocks.has(key)) {
                return false;
            }
            if (isNearHead(wall)) {
                return false;
            }
            return true;
        });
        const densityTarget = this.getWallDensityTarget(pattern);
        const interiorCells = Math.max(0, (this.tileCount - 2) * (this.tileCount - 2));
        const maxInteriorWalls = Math.max(0, Math.floor(interiorCells * densityTarget));
        this.shuffleArray(filteredInterior);
        const limitedInterior = filteredInterior.slice(0, maxInteriorWalls);
        return edgeWalls.concat(limitedInterior);
    }

    getWallDensityTarget(pattern) {
        const levelIndex = Math.max(1, this.level);
        const byPattern = {
            cross: 0.04,
            grid: 0.06,
            spiral: 0.08,
            maze: 0.1,
            random: 0.12
        };
        const base = byPattern[pattern] ?? 0.08;
        const levelFactor = Math.min(1.05, 0.75 + (levelIndex - 1) * 0.04);
        return Math.min(0.14, base * levelFactor);
    }

    ensureItemPositions() {
        if (this.apple) {
            const appleBlocked = this.specialItem ? [this.specialItem] : [];
            const appleOnWall = this.walls.some(wall => wall.x === this.apple.x && wall.y === this.apple.y);
            if (appleOnWall) {
                const position = this.getRandomEmptyPosition(appleBlocked);
                if (position) {
                    this.apple.x = position.x;
                    this.apple.y = position.y;
                }
            }
        }
        if (this.specialItem) {
            const specialOnWall = this.walls.some(wall => wall.x === this.specialItem.x && wall.y === this.specialItem.y);
            if (specialOnWall) {
                const position = this.getRandomEmptyPosition([this.apple]);
                if (position) {
                    this.specialItem.x = position.x;
                    this.specialItem.y = position.y;
                }
            }
        }
    }


    shuffleArray(items) {
        for (let i = items.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [items[i], items[j]] = [items[j], items[i]];
        }
    }
    
    drawWalls() {
        this.ctx.fillStyle = this.themeColors?.wallColor || '#4a5568';
        this.ctx.shadowBlur = 0; // Reset shadow
        
        for (let wall of this.walls) {
            const x = wall.x * this.gridSize;
            const y = wall.y * this.gridSize;
            
            // 绘制3D立体墙壁
            this.ctx.fillStyle = this.themeColors?.wallColor || '#4a5568';
            this.ctx.fillRect(x, y, this.gridSize, this.gridSize);
            
            // 顶部高光
            this.ctx.fillStyle = 'rgba(255,255,255,0.2)';
            this.ctx.fillRect(x, y, this.gridSize, this.gridSize * 0.2);
            
            // 底部阴影
            this.ctx.fillStyle = 'rgba(0,0,0,0.3)';
            this.ctx.fillRect(x, y + this.gridSize * 0.8, this.gridSize, this.gridSize * 0.2);
            
            // 边框
            this.ctx.strokeStyle = 'rgba(0,0,0,0.1)';
            this.ctx.lineWidth = 1;
            this.ctx.strokeRect(x, y, this.gridSize, this.gridSize);
        }
    }
    
    checkLevelProgress() {
        // 检查分数是否达到目标
        const targetScore = this.levelTargetScore || this.levels[this.level - 1].targetScore;
        if (this.score >= targetScore) {
            if (this.level < this.levels.length) {
                this.levelUp();
            } else {
                // 通关后的处理
                this.gameWon = true;
                this.gameOverState = true;
                this.showMessage('恭喜通关! 你是贪吃蛇大师!');
                this.sounds.win.play();
            }
        }
    }

    applyDifficultyProfile(value) {
        const profile = this.difficultyProfiles[value] || this.difficultyProfiles[250];
        this.selectedDifficultyValue = value;
        this.speedMultiplier = profile.speedMultiplier;
        this.targetMultiplier = profile.targetMultiplier;
        this.updateLevelParams();
    }

    updateLevelParams() {
        const levelConfig = this.levels[this.level - 1];
        if (!levelConfig) {
            return;
        }
        this.baseLevelSpeed = Math.max(40, Math.round(levelConfig.speed * this.speedMultiplier));
        this.levelTargetScore = Math.max(10, Math.round(levelConfig.targetScore * this.targetMultiplier));
        this.updateSpeedFromEffects();
        this.updateSpecialParams();
        const levelIndicator = document.getElementById('levelIndicator');
        if (levelIndicator) {
            levelIndicator.textContent = `Level ${this.level} · 目标 ${this.levelTargetScore}`;
        }
    }
    
    drawSpecialItem() {
        if (!this.specialItem) {
            return;
        }
        this.drawApple(this.specialItem);
    }

    updateSpecialItem() {
        const now = Date.now();
        if (this.specialItem && now >= this.specialItem.expiresAt) {
            this.specialItem = null;
            this.nextSpecialSpawnAt = now + this.getRandomSpecialSpawnDelay();
            return;
        }
        if (!this.specialItem && now >= this.nextSpecialSpawnAt) {
            this.generateSpecialItem();
        }
    }

    generateSpecialItem() {
        const position = this.getRandomEmptyPosition([this.apple]);
        if (!position) {
            return;
        }
        const random = Math.random();
        let type = 'GOLDEN';
        if (random < 0.4) {
            type = 'GOLDEN';
        } else if (random < 0.75) {
            type = 'SLOW';
        } else {
            type = 'BOMB';
        }
        this.specialItem = {
            x: position.x,
            y: position.y,
            type,
            expiresAt: Date.now() + this.specialItemLifetime
        };
        this.nextSpecialSpawnAt = Date.now() + this.getRandomSpecialSpawnDelay();
    }

    getRandomSpecialSpawnDelay() {
        const min = Math.max(1000, this.specialSpawnMin);
        const max = Math.max(min + 500, this.specialSpawnMax);
        return min + Math.floor(Math.random() * (max - min));
    }

    updateSpeedIndicator() {
        const speedElement = document.getElementById('speedIndex');
        if (!speedElement) {
            return;
        }
        const minDelay = 40;
        const maxDelay = 700;
        const ratio = (maxDelay - this.difficulty) / (maxDelay - minDelay);
        const baseRatio = (maxDelay - this.baseLevelSpeed) / (maxDelay - minDelay);
        const rawIndex = Math.max(1, Math.min(100, 1 + ratio * 99));
        const baseIndex = Math.max(1, Math.min(100, 1 + baseRatio * 99));
        const hasSpeedUp = this.activeEffects.some(effect => effect.type === 'speedUp');
        const hasSlowDown = this.activeEffects.some(effect => effect.type === 'slowDown');
        let displayIndex = rawIndex;
        if (hasSpeedUp) {
            displayIndex = Math.max(rawIndex, baseIndex + 1);
        } else if (hasSlowDown) {
            displayIndex = Math.min(rawIndex, Math.max(1, baseIndex - 1));
        }
        speedElement.textContent = Math.round(displayIndex).toString();
    }

    updateSpeedStatus() {
        const statusElement = document.getElementById('speedStatus');
        if (!statusElement) {
            return;
        }
        const hasSpeedUp = this.activeEffects.some(effect => effect.type === 'speedUp');
        const hasSlowDown = this.activeEffects.some(effect => effect.type === 'slowDown');
        if (hasSpeedUp) {
            statusElement.textContent = '加速中';
            statusElement.classList.remove('speed-down');
            statusElement.classList.add('speed-up');
        } else if (hasSlowDown) {
            statusElement.textContent = '减速中';
            statusElement.classList.remove('speed-up');
            statusElement.classList.add('speed-down');
        } else {
            statusElement.textContent = '正常';
            statusElement.classList.remove('speed-up');
            statusElement.classList.remove('speed-down');
        }
    }

    getEffectDuration(effect, baseDuration) {
        if (effect !== 'speedUp' && effect !== 'slowDown') {
            return baseDuration;
        }
        const difficultyRanks = { 350: 0, 250: 1, 150: 2, 80: 3 };
        const rank = difficultyRanks[this.selectedDifficultyValue] ?? 1;
        const levelIndex = Math.max(1, this.level);
        if (effect === 'speedUp') {
            const difficultyFactor = 0.8 + rank * 0.1;
            const levelFactor = Math.min(1.25, 0.9 + (levelIndex - 1) * 0.03);
            return Math.round(baseDuration * difficultyFactor * levelFactor);
        }
        const difficultyFactor = 1.3 - rank * 0.1;
        const levelFactor = Math.max(0.75, 1.1 - (levelIndex - 1) * 0.02);
        return Math.round(baseDuration * difficultyFactor * levelFactor);
    }

    getSpeedEffectProfile() {
        return this.speedEffectProfiles[this.selectedDifficultyValue] || this.speedEffectProfiles[250];
    }

    getScoreWithSpeedBonus(score) {
        if (score <= 0) {
            return score;
        }
        const hasSpeedUp = this.activeEffects.some(effect => effect.type === 'speedUp');
        if (!hasSpeedUp) {
            return score;
        }
        const profile = this.getSpeedEffectProfile();
        return Math.round(score * profile.scoreBonus);
    }

    updateSpeedFromEffects() {
        const speedEffects = this.activeEffects
            .filter(effect => effect.type === 'speedUp' || effect.type === 'slowDown')
            .sort((a, b) => b.startTime - a.startTime);
        const profile = this.getSpeedEffectProfile();
        let multiplier = 1;
        if (speedEffects.length > 0) {
            multiplier = speedEffects[0].type === 'speedUp' ? profile.speedUp : profile.slowDown;
        }
        this.speedEffectMultiplier = multiplier;
        this.difficulty = Math.max(30, Math.round(this.baseLevelSpeed * multiplier));
        this.updateSpeedIndicator();
        this.updateSpeedStatus();
    }

    updateSpecialParams() {
        const profile = this.specialDifficultyProfiles[this.selectedDifficultyValue] || this.specialDifficultyProfiles[250];
        const levelFactor = Math.max(0.7, 1 - (this.level - 1) * 0.05);
        this.specialSpawnMin = Math.max(1500, Math.round(profile.spawnMin * levelFactor));
        this.specialSpawnMax = Math.max(this.specialSpawnMin + 800, Math.round(profile.spawnMax * levelFactor));
        this.specialItemLifetime = Math.max(2500, Math.round(profile.lifetime * levelFactor));
        if (this.specialItem) {
            this.specialItem.expiresAt = Date.now() + this.specialItemLifetime;
        }
    }

    getRandomEmptyPosition(blocked = []) {
        let newX, newY;
        let onSnake;
        let attempts = 0;
        const maxAttempts = 100;
        
        do {
            onSnake = false;
            newX = Math.floor(Math.random() * (this.tileCount - 2)) + 1;
            newY = Math.floor(Math.random() * (this.tileCount - 2)) + 1;
            
            for (let segment of this.snake) {
                if (segment.x === newX && segment.y === newY) {
                    onSnake = true;
                    break;
                }
            }
            
            if (!onSnake) {
                for (let wall of this.walls) {
                    if (wall.x === newX && wall.y === newY) {
                        onSnake = true;
                        break;
                    }
                }
            }
            
            if (!onSnake) {
                for (let item of blocked) {
                    if (item && item.x === newX && item.y === newY) {
                        onSnake = true;
                        break;
                    }
                }
            }
            
            attempts++;
        } while (onSnake && attempts < maxAttempts);
        
        if (onSnake) {
            const emptySpots = [];
            for (let x = 1; x < this.tileCount - 1; x++) {
                for (let y = 1; y < this.tileCount - 1; y++) {
                    let occupied = false;
                    
                    for (let segment of this.snake) {
                        if (segment.x === x && segment.y === y) {
                            occupied = true;
                            break;
                        }
                    }
                    if (occupied) continue;
                    
                    for (let wall of this.walls) {
                        if (wall.x === x && wall.y === y) {
                            occupied = true;
                            break;
                        }
                    }
                    
                    if (!occupied) {
                        for (let item of blocked) {
                            if (item && item.x === x && item.y === y) {
                                occupied = true;
                                break;
                            }
                        }
                    }
                    
                    if (!occupied) {
                        emptySpots.push({x, y});
                    }
                }
            }
            
            if (emptySpots.length > 0) {
                return emptySpots[Math.floor(Math.random() * emptySpots.length)];
            }
            return null;
        }
        
        return { x: newX, y: newY };
    }
    

    
    showLevelUpMessage() {
        this.setTransientMessage(`升级! 第 ${this.level} 关`, 1000);
    }
    
    showMessage(message) {
        this.setTransientMessage(message, 1200);
    }

    setTransientMessage(message, duration) {
        document.querySelectorAll('.level-up-message, .game-message').forEach(element => {
            element.remove();
        });
        this.transientMessage = {
            text: message,
            expiresAt: Date.now() + duration
        };
    }
    
    // 新增主题更新方法
    updateTheme() {
        const theme = this.levels[this.level - 1].theme;
        let bgColor, wallColor;
    
        switch(theme) {
            case 'grass':
                bgColor = '#2d3748';
                wallColor = '#4a5568';
                break;
            case 'desert':
                bgColor = '#ed8936';
                wallColor = '#c05621';
                break;
            case 'snow':
                bgColor = '#e2e8f0';
                wallColor = '#a0aec0';
                break;
            case 'lava':
                bgColor = '#4a148c';
                wallColor = '#d69e2e';
                break;
            default:
                bgColor = '#2d3748';
                wallColor = '#4a5568';
        }
    
        // 更新画布背景
        this.canvas.style.backgroundColor = bgColor;
    
        // 存储主题颜色供其他方法使用
        this.themeColors = {
            bgColor,
            wallColor
        };
    }
    
    // 添加缺失的drawGame方法
    drawGame() {
        this.clearCanvas();
        this.drawGrid();
        this.drawWalls();
        this.drawApple();
        this.drawSpecialItem();
        this.drawSnake();
        this.drawSpeedEffectStatus();
        this.drawTransientMessage();
    }

    drawTransientMessage() {
        if (!this.transientMessage) {
            return;
        }
        const now = Date.now();
        if (now >= this.transientMessage.expiresAt) {
            this.transientMessage = null;
            return;
        }
        const ctx = this.ctx;
        const text = this.transientMessage.text;
        const fontSize = Math.max(12, Math.round(this.gridSize * 0.9));
        ctx.save();
        ctx.font = `700 ${fontSize}px Nunito`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
        ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';
        ctx.shadowBlur = 8;
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.6)';
        ctx.lineWidth = Math.max(2, Math.round(fontSize * 0.12));
        ctx.strokeText(text, this.canvas.width / 2, this.canvas.height * 0.18);
        ctx.fillText(text, this.canvas.width / 2, this.canvas.height * 0.18);
        ctx.restore();
    }

    drawSpeedEffectStatus() {
        const hasSpeedUp = this.activeEffects.some(effect => effect.type === 'speedUp');
        const hasSlowDown = this.activeEffects.some(effect => effect.type === 'slowDown');
        if (!hasSpeedUp && !hasSlowDown) {
            return;
        }
        const text = hasSpeedUp ? '加速中' : '减速中';
        const ctx = this.ctx;
        const fontSize = Math.max(11, Math.round(this.gridSize * 0.75));
        ctx.save();
        ctx.font = `700 ${fontSize}px Nunito`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = hasSpeedUp ? 'rgba(255, 209, 102, 0.95)' : 'rgba(116, 185, 255, 0.95)';
        ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';
        ctx.shadowBlur = 6;
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.6)';
        ctx.lineWidth = Math.max(2, Math.round(fontSize * 0.12));
        ctx.strokeText(text, this.canvas.width / 2, this.canvas.height * 0.08);
        ctx.fillText(text, this.canvas.width / 2, this.canvas.height * 0.08);
        ctx.restore();
    }
    
    drawGrid() {
        this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
        this.ctx.lineWidth = 1;
        
        for (let x = 0; x <= this.canvas.width; x += this.gridSize) {
            this.ctx.beginPath();
            this.ctx.moveTo(x, 0);
            this.ctx.lineTo(x, this.canvas.height);
            this.ctx.stroke();
        }
        
        for (let y = 0; y <= this.canvas.height; y += this.gridSize) {
            this.ctx.beginPath();
            this.ctx.moveTo(0, y);
            this.ctx.lineTo(this.canvas.width, y);
            this.ctx.stroke();
        }
    }
    
    // 添加蛇头绘制方法
    drawSnakeHead(segment) {
        const x = segment.x * this.gridSize;
        const y = segment.y * this.gridSize;
        const size = this.gridSize;
        
        // 蛇头颜色
        this.ctx.fillStyle = this.getThemeColor('head');
        
        // 绘制圆角矩形作为头部
        this.ctx.beginPath();
        // 根据方向调整圆角
        let radius = {tl: 10, tr: 10, br: 10, bl: 10};
        
        // 如果有方向，可以做更细致的形状，这里简化为全圆角
        this.roundRect(x + 1, y + 1, size - 2, size - 2, 8);
        this.ctx.fill();
        
        // 添加发光效果
        this.ctx.shadowBlur = 15;
        this.ctx.shadowColor = this.getThemeColor('head');
        this.ctx.stroke();
        this.ctx.shadowBlur = 0;

        // 眼睛
        const eyeSize = size * 0.2;
        const eyeOffset = size * 0.25;
        
        let eyeX1, eyeY1, eyeX2, eyeY2;
        
        // 根据移动方向定位眼睛
        if (this.dx === 1) { // Right
            eyeX1 = x + size * 0.7; eyeY1 = y + size * 0.25;
            eyeX2 = x + size * 0.7; eyeY2 = y + size * 0.75;
        } else if (this.dx === -1) { // Left
            eyeX1 = x + size * 0.3; eyeY1 = y + size * 0.25;
            eyeX2 = x + size * 0.3; eyeY2 = y + size * 0.75;
        } else if (this.dy === -1) { // Up
            eyeX1 = x + size * 0.25; eyeY1 = y + size * 0.3;
            eyeX2 = x + size * 0.75; eyeY2 = y + size * 0.3;
        } else { // Down or default
            eyeX1 = x + size * 0.25; eyeY1 = y + size * 0.7;
            eyeX2 = x + size * 0.75; eyeY2 = y + size * 0.7;
        }
        
        this.ctx.fillStyle = 'white';
        this.ctx.beginPath();
        this.ctx.arc(eyeX1, eyeY1, eyeSize, 0, Math.PI * 2);
        this.ctx.arc(eyeX2, eyeY2, eyeSize, 0, Math.PI * 2);
        this.ctx.fill();
        
        // 瞳孔
        this.ctx.fillStyle = 'black';
        const pupilSize = eyeSize * 0.5;
        this.ctx.beginPath();
        this.ctx.arc(eyeX1, eyeY1, pupilSize, 0, Math.PI * 2);
        this.ctx.arc(eyeX2, eyeY2, pupilSize, 0, Math.PI * 2);
        this.ctx.fill();
    }
    
    // 添加蛇身绘制方法
    drawSnakeBody(segment, index) {
        const x = segment.x * this.gridSize;
        const y = segment.y * this.gridSize;
        const size = this.gridSize;
        
        // 渐变色
        const color = this.getThemeColor('body', index);
        this.ctx.fillStyle = color;
        
        // 绘制圆角矩形，略微缩小以显示节段感
        this.ctx.beginPath();
        this.roundRect(x + 1, y + 1, size - 2, size - 2, 6);
        this.ctx.fill();
        
        // 简单的光泽
        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
        this.ctx.beginPath();
        this.ctx.arc(x + size*0.3, y + size*0.3, size*0.15, 0, Math.PI*2);
        this.ctx.fill();
    }
    
    // 辅助方法：绘制圆角矩形
    roundRect(x, y, w, h, r) {
        if (w < 2 * r) r = w / 2;
        if (h < 2 * r) r = h / 2;
        this.ctx.beginPath();
        this.ctx.moveTo(x + r, y);
        this.ctx.arcTo(x + w, y, x + w, y + h, r);
        this.ctx.arcTo(x + w, y + h, x, y + h, r);
        this.ctx.arcTo(x, y + h, x, y, r);
        this.ctx.arcTo(x, y, x + w, y, r);
        this.ctx.closePath();
    }
    
    getThemeColor(type, index = 0) {
        const theme = this.levels[this.level - 1].theme;
        
        if (type === 'head') {
             switch(theme) {
                case 'grass': return '#00b894';
                case 'desert': return '#e17055';
                case 'snow': return '#74b9ff';
                case 'lava': return '#d63031';
                default: return '#00b894';
            }
        } else {
            // Body gradient logic
            // 简化为纯色或简单渐变
             switch(theme) {
                case 'grass': return index % 2 === 0 ? '#55efc4' : '#00b894';
                case 'desert': return index % 2 === 0 ? '#fab1a0' : '#e17055';
                case 'snow': return index % 2 === 0 ? '#81ecec' : '#74b9ff';
                case 'lava': return index % 2 === 0 ? '#ff7675' : '#d63031';
                default: return index % 2 === 0 ? '#55efc4' : '#00b894';
            }
        }
    }
    
    // 添加缺失的drawApple方法
    drawApple(item = this.apple) {
        if (!item) {
            return;
        }
        const x = item.x * this.gridSize + this.gridSize/2;
        const y = item.y * this.gridSize + this.gridSize/2;
        const size = this.gridSize / 2 - 2;
        const type = item.type; // 'NORMAL', 'GOLDEN', 'BOMB', 'SLOW'
        const foodConfig = this.FOOD_TYPES[type];
        
        this.ctx.save();
        
        // 基础发光
        this.ctx.shadowBlur = 15;
        this.ctx.shadowColor = foodConfig.color;
        
        // 动态呼吸效果 (利用 lastUpdate 制造简单的 pulsating)
        const pulse = Math.sin(Date.now() / 200) * 0.1 + 1; // 0.9 ~ 1.1
        const currentSize = size * pulse;
        
        switch(type) {
            case 'NORMAL':
                // 绘制苹果主体
                this.ctx.fillStyle = '#ff4757';
                this.ctx.beginPath();
                this.ctx.arc(x, y + 1, currentSize, 0, Math.PI * 2); // 稍微下移一点
                this.ctx.fill();
                
                // 苹果柄
                this.ctx.shadowBlur = 0;
                this.ctx.strokeStyle = '#2ed573';
                this.ctx.lineWidth = 2;
                this.ctx.beginPath();
                this.ctx.moveTo(x, y - currentSize + 2);
                this.ctx.quadraticCurveTo(x - 2, y - currentSize - 3, x - 4, y - currentSize - 2);
                this.ctx.stroke();
                
                // 叶子
                this.ctx.fillStyle = '#2ed573';
                this.ctx.beginPath();
                this.ctx.ellipse(x + 2, y - currentSize, 4, 2, Math.PI / 4, 0, Math.PI * 2);
                this.ctx.fill();
                
                // 高光
                this.ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
                this.ctx.beginPath();
                this.ctx.arc(x - size*0.3, y - size*0.3, size*0.2, 0, Math.PI * 2);
                this.ctx.fill();
                break;
                
            case 'GOLDEN':
                // 金币/星星主体
                this.ctx.fillStyle = '#ffa502';
                this.ctx.beginPath();
                this.ctx.arc(x, y, currentSize, 0, Math.PI * 2);
                this.ctx.fill();
                
                // 内部纹理（更亮的金色）
                this.ctx.shadowBlur = 0;
                this.ctx.fillStyle = '#ffeaa7';
                this.ctx.beginPath();
                this.ctx.arc(x, y, currentSize * 0.6, 0, Math.PI * 2);
                this.ctx.fill();
                
                // 闪烁星星
                this.ctx.fillStyle = '#ffffff';
                const starAngle = (Date.now() / 500) % (Math.PI * 2);
                this.ctx.save();
                this.ctx.translate(x, y);
                this.ctx.rotate(starAngle);
                this.ctx.font = '12px Arial';
                this.ctx.textAlign = 'center';
                this.ctx.textBaseline = 'middle';
                this.ctx.fillText('★', 0, 0);
                this.ctx.restore();
                break;
                
            case 'BOMB':
                // 炸弹主体 (黑色)
                this.ctx.fillStyle = '#2f3542';
                this.ctx.beginPath();
                this.ctx.arc(x, y + 2, currentSize, 0, Math.PI * 2);
                this.ctx.fill();
                
                // 骷髅头/危险标志
                this.ctx.shadowBlur = 0;
                this.ctx.fillStyle = '#ff4757';
                this.ctx.font = 'bold 10px Arial';
                this.ctx.textAlign = 'center';
                this.ctx.textBaseline = 'middle';
                this.ctx.fillText('!', x, y + 2);
                
                // 引信
                this.ctx.strokeStyle = '#ced6e0';
                this.ctx.lineWidth = 2;
                this.ctx.beginPath();
                this.ctx.moveTo(x, y - currentSize + 2);
                this.ctx.quadraticCurveTo(x + 3, y - currentSize - 2, x + 5, y - currentSize - 5);
                this.ctx.stroke();
                
                // 引信火花
                if (Math.floor(Date.now() / 100) % 2 === 0) {
                    this.ctx.fillStyle = '#ffa502';
                    this.ctx.beginPath();
                    this.ctx.arc(x + 5, y - currentSize - 5, 2, 0, Math.PI * 2);
                    this.ctx.fill();
                }
                break;
                
            case 'SLOW':
                // 冰块/雪花主体
                this.ctx.fillStyle = '#1e90ff';
                // 绘制菱形/方形代表冰块
                this.ctx.beginPath();
                this.ctx.moveTo(x, y - currentSize);
                this.ctx.lineTo(x + currentSize, y);
                this.ctx.lineTo(x, y + currentSize);
                this.ctx.lineTo(x - currentSize, y);
                this.ctx.closePath();
                this.ctx.fill();
                
                // 内部高光
                this.ctx.shadowBlur = 0;
                this.ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
                this.ctx.beginPath();
                this.ctx.moveTo(x, y - currentSize * 0.7);
                this.ctx.lineTo(x + currentSize * 0.7, y);
                this.ctx.lineTo(x, y + currentSize * 0.7);
                this.ctx.lineTo(x - currentSize * 0.7, y);
                this.ctx.closePath();
                this.ctx.fill();
                
                // 雪花图标
                this.ctx.fillStyle = '#ffffff';
                this.ctx.font = '12px Arial';
                this.ctx.textAlign = 'center';
                this.ctx.textBaseline = 'middle';
                this.ctx.fillText('❄', x, y);
                break;
        }
        
        this.ctx.restore();
    }
    updateStatsDisplay() {
        const bestScoreElement = document.getElementById('bestScore');
        if (bestScoreElement) {
            bestScoreElement.textContent = this.highScore;
        }
        document.getElementById('gamesPlayed').textContent = this.stats.gamesPlayed;
        document.getElementById('maxLength').textContent = this.stats.maxLength;
    }
}

// 初始化游戏
window.addEventListener('DOMContentLoaded', () => {
    console.log('Initializing SnakeGame...');
    try {
        new SnakeGame();
        console.log('SnakeGame initialized successfully');
    } catch (error) {
        console.error('Error initializing SnakeGame:', error);
    }
});

// 防止方向键滚动页面
window.addEventListener('keydown', (e) => {
    if(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        e.preventDefault();
    }
});

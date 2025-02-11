// Constants
const BOARD_WIDTH = 1920;
const BOARD_HEIGHT = 1080;
const GRID_SIZE = 1;
const DEFAULT_NUM_FOOD = 50;
const DEFAULT_MOVE_INTERVAL = 100;
const STUN_DURATION = 2000;
const SCREEN_WIDTH = window.innerWidth;
const SCREEN_HEIGHT = window.innerHeight;

// Colors
const GREEN = 'rgb(0, 255, 0)';
const RED = 'rgb(255, 0, 0)';
const BG_COLOR = 'rgb(50, 50, 50)';

class Vector2 {
    constructor(x, y) {
        this.x = x;
        this.y = y;
    }

    add(other) {
        return new Vector2(this.x + other.x, this.y + other.y);
    }

    subtract(other) {
        return new Vector2(this.x - other.x, this.y - other.y);
    }

    multiply(scalar) {
        return new Vector2(this.x * scalar, this.y * scalar);
    }

    distanceTo(other) {
        const dx = this.x - other.x;
        const dy = this.y - other.y;
        return Math.sqrt(dx * dx + dy * dy);
    }
}

class Food {
    constructor() {
        this.respawn();
    }

    respawn() {
        this.position = new Vector2(
            Math.floor(Math.random() * BOARD_WIDTH / GRID_SIZE) * GRID_SIZE,
            Math.floor(Math.random() * BOARD_HEIGHT / GRID_SIZE) * GRID_SIZE
        );
    }

    draw(ctx, cameraPosition, zoom) {
        const screenPos = this.position
            .subtract(cameraPosition)
            .multiply(zoom)
            .add(new Vector2(SCREEN_WIDTH / 2, SCREEN_HEIGHT / 2));
        
        ctx.fillStyle = RED;
        ctx.fillRect(
            screenPos.x,
            screenPos.y,
            GRID_SIZE * zoom,
            GRID_SIZE * zoom
        );
    }
}

class Snake {
    static death_enabled = true;

    constructor() {
        const startPos = new Vector2(
            Math.floor(Math.random() * BOARD_WIDTH / GRID_SIZE) * GRID_SIZE,
            Math.floor(Math.random() * BOARD_HEIGHT / GRID_SIZE) * GRID_SIZE
        );
        this.body = [startPos];
        this.growSegments = 0;
        this.direction = new Vector2(1, 0);
        this.collisionCount = 0;
        this.stunned = false;
        this.stunTimer = 0;
        this.moveTimer = DEFAULT_MOVE_INTERVAL;
        this.alive = true;
    }

    get position() {
        return this.body[0];
    }

    update(dt, foods, snakes, gameSpeed) {
        if (!this.alive) return;
        
        if (this.stunned) {
            this.stunTimer -= dt;
            if (this.stunTimer <= 0) {
                this.stunned = false;
            }
            return;
        }

        this.moveTimer -= dt;
        if (this.moveTimer <= 0) {
            this.moveTimer = gameSpeed;
            this.decideDirection(foods, snakes);
            const newHead = this.position.add(this.direction.multiply(GRID_SIZE));

            // Check collision with other snakes
            for (const other of snakes) {
                if (other !== this && other.alive) {
                    for (const segment of other.body) {
                        if (newHead.x === segment.x && newHead.y === segment.y) {
                            this.handleCollision();
                            return;
                        }
                    }
                }
            }

            // Move snake
            this.body.unshift(newHead);
            if (this.growSegments > 0) {
                this.growSegments--;
            } else {
                this.body.pop();
            }
        }
    }

    decideDirection(foods, snakes) {
        if (foods.length === 0) return;

        // Find nearest food
        let nearestFood = foods[0];
        let minDist = this.position.distanceTo(foods[0].position);
        for (let i = 1; i < foods.length; i++) {
            const dist = this.position.distanceTo(foods[i].position);
            if (dist < minDist) {
                minDist = dist;
                nearestFood = foods[i];
            }
        }

        const diff = nearestFood.position.subtract(this.position);
        let preferred, alternate;

        if (Math.abs(diff.x) > Math.abs(diff.y)) {
            preferred = new Vector2(Math.sign(diff.x), 0);
            alternate = new Vector2(0, diff.y !== 0 ? Math.sign(diff.y) : 1);
        } else {
            preferred = new Vector2(0, Math.sign(diff.y));
            alternate = new Vector2(diff.x !== 0 ? Math.sign(diff.x) : 1, 0);
        }

        // Check if current direction is still valid
        if (this.isSafe(this.direction, snakes)) {
            const currentDist = this.position.distanceTo(nearestFood.position);
            const nextPos = this.position.add(this.direction.multiply(GRID_SIZE));
            const nextDist = nextPos.distanceTo(nearestFood.position);
            if (nextDist < currentDist) return;
        }

        // Try preferred direction
        if (this.isSafe(preferred, snakes)) {
            this.direction = preferred;
        }
        // Try alternate direction
        else if (this.isSafe(alternate, snakes)) {
            this.direction = alternate;
        }
        // Try other directions
        else {
            const possibleDirs = [
                new Vector2(1, 0),
                new Vector2(-1, 0),
                new Vector2(0, 1),
                new Vector2(0, -1)
            ];
            const safeDirs = possibleDirs.filter(d => this.isSafe(d, snakes));
            if (safeDirs.length > 0) {
                this.direction = safeDirs[Math.floor(Math.random() * safeDirs.length)];
            }
        }
    }

    isSafe(direction, snakes) {
        const candidate = this.position.add(direction.multiply(GRID_SIZE));
        
        // Check bounds
        if (candidate.x < 0 || candidate.x >= BOARD_WIDTH ||
            candidate.y < 0 || candidate.y >= BOARD_HEIGHT) {
            return false;
        }

        // Check other snakes
        for (const other of snakes) {
            if (other !== this && other.alive) {
                for (const segment of other.body) {
                    if (candidate.x === segment.x && candidate.y === segment.y) {
                        return false;
                    }
                }
            }
        }

        // Check self collision (except with tail)
        for (let i = 0; i < this.body.length - 1; i++) {
            if (candidate.x === this.body[i].x && candidate.y === this.body[i].y) {
                return false;
            }
        }

        return true;
    }

    handleCollision() {
        this.stunned = true;
        this.stunTimer = STUN_DURATION;
        this.collisionCount++;
        if (this.collisionCount >= 3 && Snake.death_enabled) {
            this.alive = false;
        }
    }

    grow(segments = 1) {
        this.growSegments += segments;
    }

    draw(ctx, cameraPosition, zoom) {
        if (!this.alive) return;

        for (const segment of this.body) {
            const screenPos = segment
                .subtract(cameraPosition)
                .multiply(zoom)
                .add(new Vector2(SCREEN_WIDTH / 2, SCREEN_HEIGHT / 2));
            
            ctx.fillStyle = GREEN;
            ctx.fillRect(
                screenPos.x,
                screenPos.y,
                GRID_SIZE * zoom,
                GRID_SIZE * zoom
            );
        }
    }
}

class Game {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.resizeCanvas();
        window.addEventListener('resize', () => this.resizeCanvas());

        // UI Elements
        this.menuContainer = document.getElementById('menuContainer');
        this.controls = document.getElementById('controls');
        this.startButton = document.getElementById('startButton');
        this.hideSettingsBtn = document.getElementById('hideSettingsBtn');
        this.floatingControls = document.getElementById('floatingControls');
        
        // Menu controls
        this.speedSlider = document.getElementById('speedSlider');
        this.foodSlider = document.getElementById('foodSlider');
        this.snakeSlider = document.getElementById('snakeSlider');
        this.deathCheckbox = document.getElementById('deathCheckbox');
        
        // In-game controls
        this.speedSlider2 = document.getElementById('speedSlider2');
        this.foodSlider2 = document.getElementById('foodSlider2');
        this.deathCheckbox2 = document.getElementById('deathCheckbox2');

        // Value displays
        this.speedValue = document.getElementById('speedValue');
        this.foodValue = document.getElementById('foodValue');
        this.snakeValue = document.getElementById('snakeValue');
        this.speedValue2 = document.getElementById('speedValue2');
        this.foodValue2 = document.getElementById('foodValue2');

        // Touch state
        this.touchStartDistance = 0;
        this.touchStartZoom = 1;
        this.lastTouchPos = null;

        // Sync menu and in-game controls
        this.speedSlider.addEventListener('input', () => {
            const value = this.speedSlider.value;
            this.speedValue.textContent = value;
            this.speedSlider2.value = value;
            this.speedValue2.textContent = value;
        });
        this.foodSlider.addEventListener('input', () => {
            const value = this.foodSlider.value;
            this.foodValue.textContent = value;
            this.foodSlider2.value = value;
            this.foodValue2.textContent = value;
        });
        this.snakeSlider.addEventListener('input', () => {
            const value = Math.round(this.snakeSlider.value);
            this.snakeValue.textContent = value;
            this.snakeSlider.value = value;
        });
        
        // Sync in-game controls back to menu
        this.speedSlider2.addEventListener('input', () => {
            const value = this.speedSlider2.value;
            this.speedValue2.textContent = value;
            this.speedSlider.value = value;
            this.speedValue.textContent = value;
        });
        this.foodSlider2.addEventListener('input', () => {
            const value = this.foodSlider2.value;
            this.foodValue2.textContent = value;
            this.foodSlider.value = value;
            this.foodValue.textContent = value;
        });
        
        // Sync checkboxes
        this.deathCheckbox.addEventListener('change', () => {
            this.deathCheckbox2.checked = this.deathCheckbox.checked;
        });
        this.deathCheckbox2.addEventListener('change', () => {
            this.deathCheckbox.checked = this.deathCheckbox2.checked;
        });

        // Game state
        this.state = 'menu';
        this.showSettings = true;
        this.cameraPosition = new Vector2(BOARD_WIDTH / 2, BOARD_HEIGHT / 2);
        this.zoom = 1.0;
        this.panning = false;
        this.lastMousePos = null;

        // Game objects
        this.snakes = [];
        this.foods = [];

        // Input handling
        document.addEventListener('keydown', (e) => this.handleKeyDown(e));
        this.canvas.addEventListener('mousedown', (e) => this.handleMouseDown(e));
        this.canvas.addEventListener('mouseup', (e) => this.handleMouseUp(e));
        this.canvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
        this.canvas.addEventListener('wheel', (e) => this.handleWheel(e));
        
        // Touch event handling
        this.canvas.addEventListener('touchstart', (e) => this.handleTouchStart(e));
        this.canvas.addEventListener('touchmove', (e) => this.handleTouchMove(e));
        this.canvas.addEventListener('touchend', (e) => this.handleTouchEnd(e));
        
        // Settings button
        this.hideSettingsBtn.addEventListener('click', (e) => {
            e.preventDefault();
            this.toggleSettings();
        });
        this.hideSettingsBtn.addEventListener('touchend', (e) => {
            e.preventDefault();
            this.toggleSettings();
        });
        
        // Start button
        this.startButton.addEventListener('click', () => {
            if (this.state === 'menu') {
                this.startGame();
            }
        });

        // Initialize UI state
        this.menuContainer.style.display = 'block';
        this.controls.style.display = 'none';
        this.floatingControls.style.display = 'none';

        // Initialize slider values
        this.speedValue.textContent = this.speedSlider.value;
        this.foodValue.textContent = this.foodSlider.value;
        this.snakeValue.textContent = Math.round(this.snakeSlider.value);

        // Start game loop
        this.lastTime = performance.now();
        this.gameLoop();
    }

    startGame() {
        // Switch to game state first
        this.state = 'game';
        
        // Initialize game objects with current settings
        const numSnakes = Math.round(parseInt(this.snakeSlider.value));
        const numFood = parseInt(this.foodSlider.value);
        
        this.snakes = Array(numSnakes).fill(null).map(() => new Snake());
        this.foods = Array(numFood).fill(null).map(() => new Food());
        
        Snake.death_enabled = this.deathCheckbox.checked;
        
        // Reset camera
        this.cameraPosition = new Vector2(BOARD_WIDTH / 2, BOARD_HEIGHT / 2);
        this.zoom = 1.0;
        
        // Hide menu and show in-game controls
        requestAnimationFrame(() => {
            this.menuContainer.style.display = 'none';
            this.controls.style.display = this.showSettings ? 'block' : 'none';
            this.floatingControls.style.display = 'block';
        });
    }

    toggleSettings() {
        if (this.state === 'game') {
            this.showSettings = !this.showSettings;
            this.controls.style.display = this.showSettings ? 'block' : 'none';
        }
    }

    handleKeyDown(e) {
        if (e.key === 'h' || e.key === 'H') {
            this.toggleSettings();
        } else if (e.key === 'Escape') {
            if (this.state === 'game') {
                // Return to menu
                this.state = 'menu';
                this.menuContainer.style.display = 'block';
                this.controls.style.display = 'none';
                this.floatingControls.style.display = 'none';
                this.snakes = [];
                this.foods = [];
            }
        }
    }

    handleMouseDown(e) {
        if (this.state === 'game') {
            this.panning = true;
            this.lastMousePos = new Vector2(e.clientX, e.clientY);
        }
    }

    handleMouseUp(e) {
        this.panning = false;
    }

    handleMouseMove(e) {
        if (this.panning && this.lastMousePos) {
            const mouseNow = new Vector2(e.clientX, e.clientY);
            const delta = mouseNow.subtract(this.lastMousePos);
            this.cameraPosition = this.cameraPosition.subtract(delta.multiply(1 / this.zoom));
            this.lastMousePos = mouseNow;
        }
    }

    handleWheel(e) {
        const oldZoom = this.zoom;
        this.zoom *= Math.pow(1.1, -Math.sign(e.deltaY));
        
        const mousePos = new Vector2(e.clientX, e.clientY);
        const screenCenter = new Vector2(SCREEN_WIDTH / 2, SCREEN_HEIGHT / 2);
        
        const worldBefore = mousePos.subtract(screenCenter).multiply(1 / oldZoom).add(this.cameraPosition);
        const worldAfter = mousePos.subtract(screenCenter).multiply(1 / this.zoom).add(this.cameraPosition);
        
        this.cameraPosition = this.cameraPosition.add(worldBefore.subtract(worldAfter));
    }

    update(dt) {
        if (this.state === 'game') {
            const gameSpeed = parseFloat(this.speedSlider.value);
            const desiredFoodCount = parseInt(this.foodSlider.value);

            // Update food count
            while (this.foods.length < desiredFoodCount) {
                this.foods.push(new Food());
            }
            if (this.foods.length > desiredFoodCount) {
                this.foods.length = desiredFoodCount;
            }

            // Update snakes
            for (const snake of this.snakes) {
                snake.update(dt, this.foods, this.snakes, gameSpeed);
            }
            this.snakes = this.snakes.filter(s => s.alive);

            // Check for food consumption
            for (const food of this.foods) {
                for (const snake of this.snakes) {
                    if (snake.alive && 
                        snake.position.x === food.position.x && 
                        snake.position.y === food.position.y) {
                        snake.grow(1);
                        food.respawn();
                        break;
                    }
                }
            }
        }
    }

    draw() {
        // Clear canvas
        this.ctx.fillStyle = BG_COLOR;
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        if (this.state === 'game') {
            // Draw game objects
            for (const food of this.foods) {
                food.draw(this.ctx, this.cameraPosition, this.zoom);
            }
            for (const snake of this.snakes) {
                snake.draw(this.ctx, this.cameraPosition, this.zoom);
            }
        }
    }

    gameLoop() {
        const currentTime = performance.now();
        const dt = currentTime - this.lastTime;
        this.lastTime = currentTime;

        this.update(dt);
        this.draw();

        requestAnimationFrame(() => this.gameLoop());
    }
}

// Start the game when the page loads
window.addEventListener('load', () => {
    new Game();
});

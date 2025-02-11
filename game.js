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
        console.log("Initializing game...");
        
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        
        // Initialize UI elements
        this.initializeUI();
        
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

        // Set up event listeners
        this.setupEventListeners();
        
        // Start game loop
        this.lastTime = performance.now();
        this.gameLoop();
        
        console.log("Game initialized");
    }

    initializeUI() {
        console.log("Initializing UI elements...");
        
        // Get UI elements
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

        // Initialize values
        this.updateValue(this.speedSlider, this.speedValue);
        this.updateValue(this.foodSlider, this.foodValue);
        this.updateValue(this.snakeSlider, this.snakeValue, true);

        // Set initial UI state
        this.menuContainer.style.display = 'block';
        this.controls.style.display = 'none';
        this.floatingControls.style.display = 'none';
        
        console.log("UI elements initialized");
    }

    updateValue(slider, display, isSnakeCount = false) {
        const value = isSnakeCount ? Math.round(slider.value) : slider.value;
        display.textContent = value;
        if (isSnakeCount) {
            slider.value = value;
        }
        console.log(`Updated ${slider.id} to ${value}`);
    }

    setupEventListeners() {
        console.log("Setting up event listeners...");

        // Slider event listeners
        this.speedSlider.addEventListener('input', () => {
            console.log("Speed slider changed");
            this.updateValue(this.speedSlider, this.speedValue);
            if (this.speedSlider2) {
                this.speedSlider2.value = this.speedSlider.value;
                this.speedValue2.textContent = this.speedSlider.value;
            }
        });

        this.foodSlider.addEventListener('input', () => {
            console.log("Food slider changed");
            this.updateValue(this.foodSlider, this.foodValue);
            if (this.foodSlider2) {
                this.foodSlider2.value = this.foodSlider.value;
                this.foodValue2.textContent = this.foodSlider.value;
            }
        });

        this.snakeSlider.addEventListener('input', () => {
            console.log("Snake slider changed");
            this.updateValue(this.snakeSlider, this.snakeValue, true);
        });

        // Start button
        this.startButton.addEventListener('click', (e) => {
            console.log("Start button clicked");
            e.preventDefault();
            if (this.state === 'menu') {
                this.startGame();
            }
        });

        // Settings button
        this.hideSettingsBtn.addEventListener('click', (e) => {
            console.log("Settings button clicked");
            e.preventDefault();
            this.toggleSettings();
        });

        // Canvas event listeners
        this.canvas.addEventListener('mousedown', (e) => this.handleMouseDown(e));
        this.canvas.addEventListener('mouseup', (e) => this.handleMouseUp(e));
        this.canvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
        this.canvas.addEventListener('wheel', (e) => this.handleWheel(e));
        this.canvas.addEventListener('touchstart', (e) => this.handleTouchStart(e));
        this.canvas.addEventListener('touchmove', (e) => this.handleTouchMove(e));
        this.canvas.addEventListener('touchend', (e) => this.handleTouchEnd(e));

        // Keyboard events
        document.addEventListener('keydown', (e) => this.handleKeyDown(e));
        
        // Handle window resize
        window.addEventListener('resize', () => this.resizeCanvas());
        this.resizeCanvas();
        
        console.log("Event listeners set up");
    }

    startGame() {
        console.log("Starting game...");
        
        // Switch to game state
        this.state = 'game';
        
        // Initialize game objects
        const numSnakes = Math.round(parseInt(this.snakeSlider.value));
        const numFood = parseInt(this.foodSlider.value);
        
        console.log(`Creating ${numSnakes} snakes and ${numFood} food items`);
        
        this.snakes = Array(numSnakes).fill(null).map(() => new Snake());
        this.foods = Array(numFood).fill(null).map(() => new Food());
        
        Snake.death_enabled = this.deathCheckbox.checked;
        
        // Reset camera
        this.cameraPosition = new Vector2(BOARD_WIDTH / 2, BOARD_HEIGHT / 2);
        this.zoom = 1.0;
        
        // Update UI
        requestAnimationFrame(() => {
            this.menuContainer.style.display = 'none';
            this.controls.style.display = this.showSettings ? 'block' : 'none';
            this.floatingControls.style.display = 'block';
        });
        
        console.log("Game started");
    }

    toggleSettings() {
        if (this.state === 'game') {
            this.showSettings = !this.showSettings;
            this.controls.style.display = this.showSettings ? 'block' : 'none';
            console.log(`Settings visibility toggled: ${this.showSettings}`);
        }
    }

    resizeCanvas() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
        console.log(`Canvas resized to ${this.canvas.width}x${this.canvas.height}`);
    }

    handleMouseDown(e) {
        this.panning = true;
        this.lastMousePos = new Vector2(e.clientX, e.clientY);
    }

    handleMouseUp() {
        this.panning = false;
        this.lastMousePos = null;
    }

    handleMouseMove(e) {
        if (this.panning && this.lastMousePos) {
            const currentPos = new Vector2(e.clientX, e.clientY);
            const delta = currentPos.subtract(this.lastMousePos);
            
            this.cameraPosition = this.cameraPosition.subtract(
                delta.multiply(1 / this.zoom)
            );
            
            this.lastMousePos = currentPos;
        }
    }

    handleWheel(e) {
        const zoomSpeed = 0.001;
        this.zoom = Math.min(Math.max(0.1, this.zoom * (1 - e.deltaY * zoomSpeed)), 5.0);
    }

    handleTouchStart(e) {
        e.preventDefault();
        if (e.touches.length === 2) {
            const touch1 = e.touches[0];
            const touch2 = e.touches[1];
            this.touchStartDistance = Math.hypot(
                touch2.clientX - touch1.clientX,
                touch2.clientY - touch1.clientY
            );
            this.touchStartZoom = this.zoom;
        } else if (e.touches.length === 1) {
            const touch = e.touches[0];
            this.lastTouchPos = new Vector2(touch.clientX, touch.clientY);
        }
    }

    handleTouchMove(e) {
        e.preventDefault();
        if (e.touches.length === 2) {
            const touch1 = e.touches[0];
            const touch2 = e.touches[1];
            const currentDistance = Math.hypot(
                touch2.clientX - touch1.clientX,
                touch2.clientY - touch1.clientY
            );
            
            const scale = currentDistance / this.touchStartDistance;
            this.zoom = Math.min(Math.max(this.touchStartZoom * scale, 0.1), 5.0);
            
        } else if (e.touches.length === 1 && this.lastTouchPos) {
            const touch = e.touches[0];
            const currentPos = new Vector2(touch.clientX, touch.clientY);
            const delta = currentPos.subtract(this.lastTouchPos);
            
            this.cameraPosition = this.cameraPosition.subtract(
                delta.multiply(1 / this.zoom)
            );
            
            this.lastTouchPos = currentPos;
        }
    }

    handleTouchEnd(e) {
        e.preventDefault();
        this.lastTouchPos = null;
        this.touchStartDistance = 0;
    }

    handleKeyDown(e) {
        if (e.key === 'h' || e.key === 'H') {
            this.toggleSettings();
        } else if (e.key === 'Escape') {
            if (this.state === 'game') {
                console.log("Returning to menu");
                this.state = 'menu';
                this.menuContainer.style.display = 'block';
                this.controls.style.display = 'none';
                this.floatingControls.style.display = 'none';
                this.snakes = [];
                this.foods = [];
            }
        }
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

    gameLoop(currentTime) {
        const deltaTime = currentTime - this.lastTime;
        this.lastTime = currentTime;

        this.update(deltaTime);
        this.draw();

        requestAnimationFrame((time) => this.gameLoop(time));
    }
}

// Start the game when the page loads
window.addEventListener('load', () => {
    console.log("Page loaded, creating game instance");
    window.game = new Game();
});

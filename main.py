import pygame
import random
import math
import sys

# Initialize pygame
pygame.init()

# Configuration Constants (default values)
BOARD_WIDTH = 1920
BOARD_HEIGHT = 1080
GRID_SIZE = 1
DEFAULT_NUM_FOOD = 50
DEFAULT_MOVE_INTERVAL = 100      # milliseconds between moves (faster game speed)
STUN_DURATION = 2000             # milliseconds stunned

# Screen settings (display entire board)
SCREEN_WIDTH = 1920
SCREEN_HEIGHT = 1080

# Colors
GREEN = (0, 255, 0)
RED = (255, 0, 0)
BG_COLOR = (50, 50, 50)
SLIDER_TRACK_COLOR = (80, 80, 80)
SLIDER_FILL_COLOR = (100, 100, 255)
SLIDER_BORDER_COLOR = (255, 255, 255)
SLIDER_HANDLE_COLOR = (255, 50, 50)
SLIDER_TEXT_COLOR = (255, 255, 255)
CHECKBOX_BORDER_COLOR = (255, 255, 255)
CHECKBOX_FILL_COLOR = (100, 255, 100)
CHECKBOX_BG_COLOR = (50, 50, 50)
BUTTON_BG_COLOR = (70, 70, 70)
BUTTON_BORDER_COLOR = (255, 255, 255)
BUTTON_TEXT_COLOR = (255, 255, 255)

# Utility function for sign
def sign(x):
    return (1 if x > 0 else -1 if x < 0 else 0)

class Slider:
    def __init__(self, pos, width, height, min_value, max_value, initial_value, label):
        self.rect = pygame.Rect(pos[0], pos[1], width, height)
        self.min_value = min_value
        self.max_value = max_value
        self.value = initial_value
        self.label = label
        self.handle_radius = 10
        self.dragging = False

    def update_value(self, mouse_pos):
        relative_x = mouse_pos[0] - self.rect.x
        t = min(max(relative_x / self.rect.width, 0), 1)
        self.value = self.min_value + t * (self.max_value - self.min_value)

    def handle_event(self, event):
        if event.type == pygame.MOUSEBUTTONDOWN:
            if event.button == 1 and self.rect.collidepoint(event.pos):
                self.dragging = True
                self.update_value(event.pos)
                return True
        elif event.type == pygame.MOUSEBUTTONUP:
            if event.button == 1 and self.dragging:
                self.dragging = False
                return True
        elif event.type == pygame.MOUSEMOTION:
            if self.dragging:
                self.update_value(event.pos)
                return True
        return False

    def draw(self, surface, font):
        # Draw slider track background
        pygame.draw.rect(surface, SLIDER_TRACK_COLOR, self.rect)
        # Calculate filled percentage
        t = (self.value - self.min_value) / (self.max_value - self.min_value)
        filled_width = int(self.rect.width * t)
        filled_rect = pygame.Rect(self.rect.x, self.rect.y, filled_width, self.rect.height)
        pygame.draw.rect(surface, SLIDER_FILL_COLOR, filled_rect)
        # Draw border
        pygame.draw.rect(surface, SLIDER_BORDER_COLOR, self.rect, 2)
        # Draw handle at the end of filled portion
        handle_x = self.rect.x + filled_width
        handle_center = (handle_x, self.rect.y + self.rect.height // 2)
        pygame.draw.circle(surface, SLIDER_HANDLE_COLOR, handle_center, self.handle_radius)
        # Draw label text above slider
        label_surf = font.render(f"{self.label}: {self.value:.1f}", True, SLIDER_TEXT_COLOR)
        surface.blit(label_surf, (self.rect.x, self.rect.y - 25))

class Checkbox:
    def __init__(self, pos, size, initial, label):
        self.rect = pygame.Rect(pos[0], pos[1], size, size)
        self.checked = initial
        self.label = label

    def handle_event(self, event):
        if event.type == pygame.MOUSEBUTTONDOWN:
            if event.button == 1 and self.rect.collidepoint(event.pos):
                self.checked = not self.checked
                return True
        return False

    def draw(self, surface, font):
        # Draw checkbox background
        pygame.draw.rect(surface, CHECKBOX_BG_COLOR, self.rect)
        # Draw border
        pygame.draw.rect(surface, CHECKBOX_BORDER_COLOR, self.rect, 2)
        # Fill if checked
        if self.checked:
            inner_rect = self.rect.inflate(-4, -4)
            pygame.draw.rect(surface, CHECKBOX_FILL_COLOR, inner_rect)
        # Draw label to the right of checkbox
        label_surf = font.render(self.label, True, SLIDER_TEXT_COLOR)
        surface.blit(label_surf, (self.rect.right + 10, self.rect.y))

class Button:
    def __init__(self, pos, size, text):
        self.rect = pygame.Rect(pos[0], pos[1], size[0], size[1])
        self.text = text

    def draw(self, surface, font):
        pygame.draw.rect(surface, BUTTON_BG_COLOR, self.rect)
        pygame.draw.rect(surface, BUTTON_BORDER_COLOR, self.rect, 2)
        text_surf = font.render(self.text, True, BUTTON_TEXT_COLOR)
        # Center the text within the button
        text_rect = text_surf.get_rect(center=self.rect.center)
        surface.blit(text_surf, text_rect)

    def is_clicked(self, mouse_pos):
        return self.rect.collidepoint(mouse_pos)

class Food:
    def __init__(self):
        self.position = pygame.Vector2(
            random.randrange(0, BOARD_WIDTH, GRID_SIZE),
            random.randrange(0, BOARD_HEIGHT, GRID_SIZE)
        )

    def respawn(self):
        self.position = pygame.Vector2(
            random.randrange(0, BOARD_WIDTH, GRID_SIZE),
            random.randrange(0, BOARD_HEIGHT, GRID_SIZE)
        )

    def draw(self, surface, camera_position, zoom):
        screen_pos = (self.position - camera_position) * zoom + pygame.Vector2(SCREEN_WIDTH / 2, SCREEN_HEIGHT / 2)
        rect = pygame.Rect(screen_pos.x, screen_pos.y, GRID_SIZE * zoom, GRID_SIZE * zoom)
        pygame.draw.rect(surface, RED, rect)

class Snake:
    # Class variable to control snake death on collisions
    death_enabled = True

    def __init__(self):
        start_pos = pygame.Vector2(
            random.randrange(0, BOARD_WIDTH, GRID_SIZE),
            random.randrange(0, BOARD_HEIGHT, GRID_SIZE)
        )
        self.body = [start_pos]  # List of segments; head is first element
        self.grow_segments = 0   # Number of segments to grow (when > 0, skip tail removal)
        self.direction = pygame.Vector2(1, 0)  # Start moving to the right
        self.collision_count = 0
        self.stunned = False
        self.stun_timer = 0
        self.move_timer = DEFAULT_MOVE_INTERVAL
        self.alive = True

    @property
    def position(self):
        return self.body[0]

    def update(self, dt, foods, snakes, game_speed):
        if not self.alive:
            return
        if self.stunned:
            self.stun_timer -= dt
            if self.stun_timer <= 0:
                self.stunned = False
            return

        self.move_timer -= dt
        if self.move_timer <= 0:
            self.move_timer = game_speed
            self.decide_direction(foods, snakes)
            new_head = self.position + self.direction * GRID_SIZE

            # Check collision with other snakes
            for other in snakes:
                if other is not self and other.alive and new_head in other.body:
                    self.handle_collision()
                    return

            # Move snake: insert new head, remove tail unless growing
            self.body.insert(0, new_head)
            if self.grow_segments > 0:
                self.grow_segments -= 1
            else:
                self.body.pop()

    def decide_direction(self, foods, snakes):
        if not foods:
            return
        nearest_food = min(foods, key=lambda f: self.position.distance_to(f.position))
        diff = nearest_food.position - self.position
        if abs(diff.x) > abs(diff.y):
            preferred = pygame.Vector2(sign(diff.x), 0)
            alternate = pygame.Vector2(0, sign(diff.y)) if diff.y != 0 else None
        else:
            preferred = pygame.Vector2(0, sign(diff.y))
            alternate = pygame.Vector2(sign(diff.x), 0) if diff.x != 0 else None

        def is_safe(direction):
            candidate = self.position + direction * GRID_SIZE
            for other in snakes:
                if other is not self and candidate in other.body:
                    return False
            return True

        if is_safe(preferred):
            self.direction = preferred
        elif alternate and is_safe(alternate):
            self.direction = alternate
        else:
            self.direction = preferred

    def handle_collision(self):
        self.stunned = True
        self.stun_timer = STUN_DURATION
        self.collision_count += 1
        if self.collision_count >= 3 and Snake.death_enabled:
            self.alive = False

    def grow(self, segments=1):
        self.grow_segments += segments

    def draw(self, surface, camera_position, zoom):
        if not self.alive:
            return
        for segment in self.body:
            screen_pos = (segment - camera_position) * zoom + pygame.Vector2(SCREEN_WIDTH / 2, SCREEN_HEIGHT / 2)
            rect = pygame.Rect(screen_pos.x, screen_pos.y, GRID_SIZE * zoom, GRID_SIZE * zoom)
            pygame.draw.rect(surface, GREEN, rect)

class Game:
    def __init__(self):
        self.screen = pygame.display.set_mode((SCREEN_WIDTH, SCREEN_HEIGHT))
        pygame.display.set_caption("AI Snake Game - Pan, Zoom, Grow & UI")
        self.clock = pygame.time.Clock()
        self.font = pygame.font.SysFont(None, 24)

        # Menu UI elements with initial placeholder positions (will be centered later)
        self.speed_slider = Slider((20, 20), 200, 20, 5, 500, DEFAULT_MOVE_INTERVAL, "Speed (ms)")
        self.food_slider = Slider((20, 60), 200, 20, 5, 1000, float(DEFAULT_NUM_FOOD), "Food Spawn")
        self.death_checkbox = Checkbox((20, 100), 20, True, "Snake Death")
        self.num_snakes_slider = Slider((20, 140), 200, 20, 10, 500, 100, "Num Snakes")
        self.start_button = Button((20, 200), (200, 40), "Start Game")

        # Flag to ensure menu UI is centered once
        self.menu_centered = False

        # In-game settings UI (can be toggled)
        self.show_settings = True
        
        # Game state
        self.state = "menu"  # "menu" or "game"
        self.camera_position = pygame.Vector2(BOARD_WIDTH / 2, BOARD_HEIGHT / 2)
        self.zoom = 1.0
        self.panning = False
        self.last_mouse_pos = None

        # Game objects
        self.snakes = []
        self.foods = [Food() for _ in range(DEFAULT_NUM_FOOD)]
    
    def run(self):
        running = True
        while running:
            dt = self.clock.tick(244)  # Frame cap updated to 244 fps
            for event in pygame.event.get():
                if event.type == pygame.QUIT:
                    running = False

                if self.state == "menu":
                    self.handle_menu_event(event)
                elif self.state == "game":
                    self.handle_game_event(event)

            if self.state == "menu":
                self.draw_menu()
            elif self.state == "game":
                self.update_game(dt)
                self.draw_game()

        pygame.quit()
        sys.exit()

    def handle_menu_event(self, event):
        # Process UI events for menu
        self.speed_slider.handle_event(event)
        self.food_slider.handle_event(event)
        self.death_checkbox.handle_event(event)
        self.num_snakes_slider.handle_event(event)
        
        if event.type == pygame.MOUSEBUTTONDOWN:
            if event.button == 1 and self.start_button.is_clicked(event.pos):
                # Start game using settings from menu
                num_snakes = int(self.num_snakes_slider.value)
                self.snakes = [Snake() for _ in range(num_snakes)]
                # Update snake death setting
                Snake.death_enabled = self.death_checkbox.checked
                # Transition to game state
                self.state = "game"

    def handle_game_event(self, event):
        if event.type == pygame.KEYDOWN:
            if event.key == pygame.K_h:  # Press H to toggle settings UI
                self.show_settings = not self.show_settings
            if event.key == pygame.K_ESCAPE:
                pygame.event.post(pygame.event.Event(pygame.QUIT))
        if event.type == pygame.MOUSEBUTTONDOWN:
            if event.button == 1:
                # Check if click is on UI elements; if so, do not start panning.
                if self.show_settings and (
                    self.speed_slider.rect.collidepoint(event.pos) or
                    self.food_slider.rect.collidepoint(event.pos) or
                    self.death_checkbox.rect.collidepoint(event.pos)
                ):
                    pass
                else:
                    self.panning = True
                    self.last_mouse_pos = pygame.Vector2(event.pos)
        elif event.type == pygame.MOUSEBUTTONUP:
            if event.button == 1:
                self.panning = False
        elif event.type == pygame.MOUSEMOTION:
            # Only process panning if not interacting with UI elements
            if self.panning and not (self.speed_slider.dragging or self.food_slider.dragging):
                mouse_now = pygame.Vector2(event.pos)
                delta = mouse_now - self.last_mouse_pos
                self.camera_position -= delta / self.zoom
                self.last_mouse_pos = mouse_now
        elif event.type == pygame.MOUSEWHEEL:
            old_zoom = self.zoom
            self.zoom *= 1.1 ** event.y
            mouse_pos = pygame.Vector2(pygame.mouse.get_pos())
            world_before = (mouse_pos - pygame.Vector2(SCREEN_WIDTH / 2, SCREEN_HEIGHT / 2)) / old_zoom + self.camera_position
            world_after = (mouse_pos - pygame.Vector2(SCREEN_WIDTH / 2, SCREEN_HEIGHT / 2)) / self.zoom + self.camera_position
            self.camera_position += (world_before - world_after)
        # Always process UI events in game mode
        self.speed_slider.handle_event(event)
        self.food_slider.handle_event(event)
        self.death_checkbox.handle_event(event)

    def update_game(self, dt):
        game_speed = self.speed_slider.value
        desired_food_count = int(self.food_slider.value)
        if len(self.foods) < desired_food_count:
            for _ in range(desired_food_count - len(self.foods)):
                self.foods.append(Food())
        elif len(self.foods) > desired_food_count:
            self.foods = self.foods[:desired_food_count]

        for snake in self.snakes:
            snake.update(dt, self.foods, self.snakes, game_speed)
        self.snakes = [s for s in self.snakes if s.alive]

        # Check for food consumption
        for food in self.foods:
            for snake in self.snakes:
                if snake.alive and snake.position == food.position:
                    snake.grow(1)
                    food.respawn()
                    break

    def draw_menu(self):
        self.screen.fill(BG_COLOR)
        # Center the UI in the menu once
        if not self.menu_centered:
            panel_width = 200  # using slider/button widths
            panel_height = 260 # total vertical space for the menu
            new_x_slider = (SCREEN_WIDTH - panel_width) // 2
            new_x_checkbox = (SCREEN_WIDTH - 20) // 2  # checkbox width is 20
            start_y = (SCREEN_HEIGHT - panel_height) // 2
            self.speed_slider.rect.x = new_x_slider
            self.speed_slider.rect.y = start_y
            self.food_slider.rect.x = new_x_slider
            self.food_slider.rect.y = start_y + 40
            self.death_checkbox.rect.x = new_x_checkbox
            self.death_checkbox.rect.y = start_y + 80
            self.num_snakes_slider.rect.x = new_x_slider
            self.num_snakes_slider.rect.y = start_y + 120
            self.start_button.rect.x = new_x_slider
            self.start_button.rect.y = start_y + 180
            self.menu_centered = True

        self.speed_slider.draw(self.screen, self.font)
        self.food_slider.draw(self.screen, self.font)
        self.death_checkbox.draw(self.screen, self.font)
        self.num_snakes_slider.draw(self.screen, self.font)
        self.start_button.draw(self.screen, self.font)
        # Draw instructions
        instruct = self.font.render("Adjust settings then click 'Start Game'", True, SLIDER_TEXT_COLOR)
        instruct_rect = instruct.get_rect(center=(SCREEN_WIDTH // 2, (self.start_button.rect.y + self.start_button.rect.height) + 30))
        self.screen.blit(instruct, instruct_rect)
        pygame.display.flip()

    def draw_game(self):
        self.screen.fill(BG_COLOR)
        for food in self.foods:
            food.draw(self.screen, self.camera_position, self.zoom)
        for snake in self.snakes:
            snake.draw(self.screen, self.camera_position, self.zoom)
        if self.show_settings:
            # Draw settings UI in simulation (drawn at their original positions)
            self.speed_slider.draw(self.screen, self.font)
            self.food_slider.draw(self.screen, self.font)
            self.death_checkbox.draw(self.screen, self.font)
            instruct = self.font.render("Press H to hide settings", True, SLIDER_TEXT_COLOR)
            self.screen.blit(instruct, (20, 260))
        pygame.display.flip()

if __name__ == '__main__':
    game = Game()
    game.run()

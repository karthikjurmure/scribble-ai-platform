# 🎨 Scribble AI Platform: Complete Architectural & Operational Guide

Welcome to the ultimate technical blueprint of the **Scribble AI Platform**. This document provides an exhaustive, from-scratch deep dive into the system's architecture, data flows, communication protocols, file responsibilities, and operational mechanics.

---

## 1. System Architecture Overview

The Scribble AI Platform is a real-time, multiplayer drawing and guessing game augmented with a deep learning prediction microservice. 

The system is constructed of three primary pillars:
1. **Frontend (Browser UI)**: A high-performance, responsive Vanilla JavaScript app handling drawing actions, WebSockets, canvas coordinate scaling, and rendering.
2. **Game Engine (Node.js & Redis)**: The central socket-driven state machine coordinating lobbies, drawing broadcasts, chat processing, scoring, and the AI invocation loop.
3. **AI Inference Service (Python FastAPI & TensorFlow)**: A high-speed Convolutional Neural Network (CNN) trained on the Google QuickDraw dataset to recognize canvas drawings.

### 🌐 High-Level Topology
```mermaid
graph TD
    UserA[Player A: Drawer] -- "1. Real-time Drawing strokes (Socket.IO)" --> GameEngine[Node.js Game Engine]
    GameEngine -- "2. Broadcast Strokes" --> UserB[Player B: Guesser]
    GameEngine -- "3. Cache Strokes (TTL 2h)" --> Redis[(Redis Cloud State)]
    
    UserA -- "4. Base64 Snapshots (every 15s)" --> GameEngine
    GameEngine -- "5. HTTP POST /predict (FormData)" --> AIService[FastAPI AI Service]
    AIService -- "6. Preprocess & CNN Inference" --> TensorFlow((TF Model))
    AIService -- "7. Top 3 Guesses & Confidence" --> GameEngine
    
    GameEngine -- "8. Broadcast AI Speculations / Victory" --> AllPlayers[All Players]
```

---

## 2. Component Deep Dives

---

### 🎨 Component A: The Client-Side Frontend (`frontend/`)
Designed to be fast, responsive, and cross-platform (PWA-enabled), the frontend handles raw client interactions without complex framework overhead.

#### Core Files & Responsibilities
*   **[index.html](file:///c:/Users/Admin/Documents/Projects/scribble-ai-platform/frontend/public/index.html)**
    *   Defines the structural blueprint using semantic HTML5.
    *   Responsive split layout using CSS Grid for desktop & mobile optimization.
    *   Declares the drawing `<canvas>` and panels for players list, scores, chat log, and control toolbars.
*   **[style.css](file:///c:/Users/Admin/Documents/Projects/scribble-ai-platform/frontend/public/style.css)**
    *   Implements the CSS variables, layout positioning, custom animations, and a modern glassmorphism aesthetic.
    *   Handles desktop viewport layouts (scores sidebar, center canvas, right chat) and mobile responsive modes (drawing canvas on top, chat on bottom).
*   **[socket.js](file:///c:/Users/Admin/Documents/Projects/scribble-ai-platform/frontend/public/js/socket.js)**
    *   Instantiates the Socket.IO connection client and establishes connection error boundaries.
*   **[canvas.js](file:///c:/Users/Admin/Documents/Projects/scribble-ai-platform/frontend/public/js/canvas.js)**
    *   **Unified Pointer Listeners**: Binds mouse (`mousedown`, `mousemove`, `mouseup`) and touch events (`touchstart`, `touchmove`, `touchend`) under a single logical umbrella.
    *   **Internal Resolution Mapping (Coordinate Normalization)**:
        *   To keep drawings consistent across different client screens (e.g. mobile vs UltraWide monitors), drawing inputs are scaled onto a fixed **800x500 logical space**:
            $$\text{Normalized } X = (X_{client} - \text{rect}_{left}) \times \frac{\text{canvas}_{width}}{\text{rect}_{width}}$$
            $$\text{Normalized } Y = (Y_{client} - \text{rect}_{top}) \times \frac{\text{canvas}_{height}}{\text{rect}_{height}}$$
    *   **Drawing Renderer**: Operates a stateful draw brush with variables for size (`currentBrushSize`) and color (`currentBrushColor`).
*   **[game.js](file:///c:/Users/Admin/Documents/Projects/scribble-ai-platform/frontend/public/js/game.js)**
    *   Triggers room registration and game initialization packets.
    *   Orchestrates round changes, roles (locks canvas drawing for Guessers; locks chat input for Drawers), and handles game-over leaderboards.
    *   **AI Capture Loop**: Automatically takes a Base64 image snapshot using `canvas.toDataURL('image/png')` every **15 seconds** and uploads it to the backend.
*   **[ui.js](file:///c:/Users/Admin/Documents/Projects/scribble-ai-platform/frontend/public/js/ui.js)**
    *   Manages dynamic updates to the chat viewport and leaderboard rows. Handles specialized styling for the AI guess announcements.

---

### ⚙️ Component B: Node.js Game Engine (`game-engine/`)
The engine is a real-time WebSocket orchestrator that holds room settings, verifies user guesses, persists drawing strokes, and communicates with the AI service.

#### Core Files & Responsibilities
*   **[server.js](file:///c:/Users/Admin/Documents/Projects/scribble-ai-platform/game-engine/src/server.js)**
    *   Initializes the HTTP, Express, Socket.IO, and Redis connections.
    *   Mounts public resources and maps incoming WebSockets to corresponding handlers.
*   **[state.js](file:///c:/Users/Admin/Documents/Projects/scribble-ai-platform/game-engine/src/state.js)**
    *   In-memory data store holding active lobby structures and user aliases:
        ```javascript
        rooms = {
            [roomId]: {
                players: [{ id, username, score, isBot }],
                currentDrawerIndex: 0,
                gameActive: boolean,
                currentWord: string,
                roundStartTime: timestamp,
                endTime: timestamp,
                timeoutId: NodeJS.Timeout,
                hintTimeouts: [NodeJS.Timeout],
                hintArray: ['_', '_', '_'],
                correctGuessers: [playerId],
                aiGuessedThisRound: boolean
            }
        }
        ```
*   **[handlers/roomHandler.js](file:///c:/Users/Admin/Documents/Projects/scribble-ai-platform/game-engine/src/handlers/roomHandler.js)**
    *   Controls player registration, disconnect cleanups, and game launches.
    *   Injects a persistent `🤖 AI Bot` user profile into the player pool of every active lobby.
    *   **Late Join Synchronization**: Restores canvas state for late joiners by fetching past strokes from Redis and sending them in a single batch.
*   **[handlers/drawingHandler.js](file:///c:/Users/Admin/Documents/Projects/scribble-ai-platform/game-engine/src/handlers/drawingHandler.js)**
    *   Bypasses drawing events to other room members and pushes stroke histories to Redis.
    *   **AI Gateway**: Catches the 15-second Base64 snapshot, unpacks the base64 string into a buffer, encapsulates it as a Multipart FormData payload, and posts it to the `/predict` FastAPI route.
    *   If the AI model's highest-probability prediction matches the target word, it sets the `aiGuessedThisRound` flag, awards scoring points to `🤖 AI Bot`, and broadcasts a victory message.
*   **[handlers/chatHandler.js](file:///c:/Users/Admin/Documents/Projects/scribble-ai-platform/game-engine/src/handlers/chatHandler.js)**
    *   Validates message content. If a guesser types the correct secret word, their score updates based on how quickly they guessed, and the engine evaluates if all human guessers have succeeded to terminate the round early.
*   **[utils/gameLogic.js](file:///c:/Users/Admin/Documents/Projects/scribble-ai-platform/game-engine/src/utils/gameLogic.js)**
    *   Starts/ends rounds, picks random keywords from `words.json` (skipping AI bot accounts when electing the drawer), and schedules progressive hints.
*   **[utils/words.json](file:///c:/Users/Admin/Documents/Projects/scribble-ai-platform/game-engine/src/utils/words.json)**
    *   Contains the collection of recognizable words mapped directly to the AI classes (e.g. apple, kangaroo, penguin).

---

### 🤖 Component C: AI Inference Microservice (`ai-service/`)
A Python-based, high-performance API endpoint that processes canvas drawings and applies a Convolutional Neural Network (CNN) to perform handwriting classification.

#### Core Files & Responsibilities
*   **[main.py](file:///c:/Users/Admin/Documents/Projects/scribble-ai-platform/ai-service/app/main.py)**
    *   Creates the FastAPI application exposing `/predict` (POST) and `/health` (GET) routes.
    *   Uses Uvicorn to serve the API asynchronously.
*   **[services/image_processing.py](file:///c:/Users/Admin/Documents/Projects/scribble-ai-platform/ai-service/app/services/image_processing.py)**
    *   Contains the mathematical preprocessing pipeline to format canvas sketches for the model:
        1.  **Flatten Alpha Channels**: Pastes the transparent PNG input onto a solid white background card.
        2.  **Grayscale**: Transforms the image matrix from RGB colors into a single $L$ channel (8-bit grayscale).
        3.  **Color Inversion**: Inverts gray intensities (Black inks on White backgrounds become **White inks on Black backgrounds**), matching the QuickDraw format.
        4.  **Tight Bounding Bounding Box Crop**: Trims outer empty space using `Image.getbbox()` to focus entirely on the drawn stroke.
        5.  **Resizing**: Scales down to the model's exact shape (e.g. 28x28 or 64x64) via Lanczos resampling.
        6.  **Normalization**: Divides pixel intensities by 255.0 to map range between `[0.0, 1.0]`. Reshapes array to a 4D tensor with shape `(1, target_size, target_size, 1)`.
*   **[services/model_service.py](file:///c:/Users/Admin/Documents/Projects/scribble-ai-platform/ai-service/app/services/model_service.py)**
    *   Lazy loads the compiled Keras `.h5` model file and labels list.
    *   Runs model inference and outputs the top 3 highest-probability classes and confidence percentages.
*   **[model/classes.txt](file:///c:/Users/Admin/Documents/Projects/scribble-ai-platform/ai-service/app/model/classes.txt)**
    *   The dictionary of 27 recognizable entities including:
        > `apple`, `banana`, `car`, `dog`, `elephant`, `fish`, `guitar`, `house`, `mountain`, `ocean`, `piano`, `snake`, `tiger`, `umbrella`, `zebra`, `bridge`, `castle`, `dragon`, `flower`, `hammer`, `kangaroo`, `lighthouse`, `mushroom`, `penguin`, `rainbow`, `submarine`, `tornado`.

---

## 3. Communication Protocols

### 📡 WebSocket API (Client ↔ Game Engine)

#### Client Emits
| Event Name | Payload Structure | Description |
| :--- | :--- | :--- |
| `join-room` | `{ roomId: String, username: String }` | Joins a room, creates state, and prompts Redis canvas synchronization. |
| `start-game` | `roomId` (String) | Starts the active round loop if at least 2 players are present. |
| `draw-data` | `{ roomId: String, data: { x, y, isNewStroke, size, color } }` | Transmits a continuous stroke coordinate. |
| `clear-canvas` | `roomId` (String) | Clears the drawings in the client canvases and removes history inside Redis. |
| `chat-message` | `{ roomId: String, message: String }` | Submits a guess or text message to the server chat. |
| `canvas-snapshot` | `{ roomId: String, image: Base64String }` | Uploads a canvas screenshot (every 15s) for AI evaluation. |

#### Server Emits
| Event Name | Payload Structure | Description |
| :--- | :--- | :--- |
| `score-update` | `[ { id, username, score, isBot } ]` | Broadcasts the updated leaderboard standings. |
| `load-history` | `[ { x, y, isNewStroke, size, color } ]` | Restores drawing details for late-joining players. |
| `clear-canvas` | *No Payload* | Commands all users to wipe their canvases. |
| `game-started` | `{ role: String, word: String, remainingTime: Number, drawerName: String }` | Triggers turn-based UI modifications. Drawer sees the full target word, while Guessers see blanks. |
| `round-over` | `{ word: String }` | Displays the final answer and ends drawing actions. |
| `word-hint-update` | `hintString` (e.g. `_ a _ a _ a`) | Reveals letters of the word dynamically over time. |
| `guess-success` | *No Payload* | Confirms a correct guess to the scoring client. |
| `system-message` | `messageString` | Emits scoring and event system bulletins to the chat panel. |
| `ai-guess` | `{ label: String, confidence: String }` | Displays the AI bot's real-time guesses. |
| `game-over` | `{ leaderboard: Array, winner: Object }` | Concludes active matches and displays the final score. |
| `error-msg` | `errorString` | Reports exceptions (e.g. invalid turn moves). |

---

## 4. Key Gameplay Rules & Math

### ⏱️ Hint Progressive Disclosure
At the start of the round, a secret keyword is picked. The server builds a blank representation (`hintArray`).
1. Immediately, **one random letter is revealed**.
2. A progressive timer schedules reveals up to $\max(0, \lfloor \frac{\text{WordLength}}{2} \rfloor - 1)$ hints at equal divisions of the 60-second timer.
3. For example, a 6-letter word reveals a random character at start, and schedules $3 - 1 = 2$ more reveals spaced evenly across the round.

### 🏆 Score Distribution Formula
Points awarded to a player (or `🤖 AI Bot`) who correctly identifies the drawing decrease as the 60-second timer advances:

$$\text{Points} = \begin{cases} 
100 & \text{if } t_{\text{elapsed}} \le 10\text{s} \\
75 & \text{if } 10\text{s} < t_{\text{elapsed}} \le 20\text{s} \\
50 & \text{if } 20\text{s} < t_{\text{elapsed}} \le 30\text{s} \\
30 & \text{if } 30\text{s} < t_{\text{elapsed}} \le 40\text{s} \\
20 & \text{if } 40\text{s} < t_{\text{elapsed}} \le 50\text{s} \\
10 & \text{if } t_{\text{elapsed}} > 50\text{s}
\end{cases}$$

#### Drawer Scoring Incentives
*   The drawer earns a flat **+50 bonus points** the instant the *first* player (human or AI bot) guesses the correct word, reward-incentivizing precise and clear drawings.

---

## 5. Operations & Execution Guide

To initialize the platform locally, follow this guide:

### 📋 Prerequisites
Ensure you have the following installed on your machine:
*   [Node.js (v16+)](https://nodejs.org/)
*   [Python (v3.9 - v3.11)](https://www.python.org/)

---

### Step 1: Set Up & Run the AI service

1. Navigate to the AI service folder:
   ```powershell
   cd ai-service
   ```
2. Build and register the python virtual environment:
   ```powershell
   python -m venv venv
   venv\Scripts\activate
   ```
3. Install the dependencies:
   ```powershell
   pip install -r requirements.txt
   ```
4. Start the microservice with Uvicorn:
   ```powershell
   python app/main.py
   ```
   *The service will start on `http://localhost:8000`. You can confirm health via `http://localhost:8000/health` in your browser.*

---

### Step 2: Set Up & Run the Game Engine

1. Open a new shell pane and go to the game engine folder:
   ```powershell
   cd game-engine
   ```
2. Install node dependencies:
   ```powershell
   npm install
   ```
3. Configure the environment:
   Make sure `game-engine/.env` has valid credentials (e.g. for AI URL and Redis state persistence).
   ```env
   PORT=3000
   REDIS_URL=redis://default:YOUR_REDIS_PASSWORD@YOUR_REDIS_ENDPOINT:PORT
   AI_SERVICE_URL=http://localhost:8000
   ```
4. Start the server:
   ```powershell
   node src/server.js
   ```
   *The server is now live at `http://localhost:3000` and serves the static frontend automatically.*

---

### Step 3: Run & Play!
1. Open your web browser and navigate to `http://localhost:3000`.
2. Input a username (e.g. `Leonardo`) and room code (e.g. `RoomA`), then click **Join Room**.
3. Open a second incognito browser panel (or separate browser program) and register another player (e.g. `Picasso`) to the same room code (`RoomA`).
4. Press **Start Game** and begin drawing! Watch the real-time drawing sync, progressive hints, and watch `🤖 AI Bot` guess what you draw every 15 seconds!

---

## 6. Key Architecture Features

*   **State Persistence & Resilience**: Using Redis list queues for room histories guarantees that client connection disruptions do not wipe the current drawing canvas. A joining player experiences a smooth restoration.
*   **Coordinate Scaling**: Coordinates are fully decoupled from device viewport sizes. A mobile drawer's canvas inputs render perfectly onto a desktop monitor.
*   **Efficient Tensor Preprocessing**: Handled natively in Python using PIL and NumPy, offloading CPU-intensive processing tasks from the game server. Grayscale inversion, bounding-box cropping, and normalization keep model inference execution speeds under **100 milliseconds**.

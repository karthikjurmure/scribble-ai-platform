# Backend (Game Engine) Flow ⚙️

The game engine is a Node.js application built with **Express**, **Socket.IO**, and **Redis**. It acts as the central authority for game logic, room state, and the bridge to the AI microservice.

## 📁 File Structure & Responsibilities

### Server Core
- **`src/server.js`**: The main entry point. 
    - **Dual Server**: It serves the static frontend assets (HTML/CSS/JS) via `express.static` and simultaneously hosts the WebSocket server.
    - **Redis Initialization**: Establishes a persistent connection to the Redis cloud for history storage.
    - **Middleware**: Configures CORS and environment variables via `dotenv`.

### Logical Handlers (`src/handlers/`)
- **`roomHandler.js`**: Manages the multiplayer lifecycle.
    - **Room State**: Tracks which users are in which rooms.
    - **Round Transitions**: Handles starting the game, picking words from `words.json`, and rotating roles.
    - **Timers**: Manages the 60-second countdown and periodic hint broadcasts.
- **`chatHandler.js`**: Processes all text interaction.
    - **Guess Validation**: Intercepts chat messages and compares them to the secret word.
    - **Scoring**: Calculates points based on the remaining time (e.g., faster guesses = more points).
- **`drawingHandler.js`**: Handles the flow of visual data.
    - **Broadcasting**: Forwards drawing strokes from the drawer to all other participants.
    - **AI Orchestration**: Receives periodic canvas snapshots from the drawer, forwards them to the **AI Service** via HTTP, and broadcasts the AI's "guess" back to the room.

---

## 💾 Data Flow & Connections

### 1. The Persistence Loop (Redis)
When a stroke is received in `drawingHandler.js`:
1. It is broadcast to all clients for real-time viewing.
2. It is **pushed to a Redis list** keyed by the Room ID.
3. When a new player joins, `roomHandler.js` fetches the entire list from Redis and sends it via `load-history`, allowing late-joiners to see the full drawing.

### 2. The AI Bridge (Inference)
Every 15 seconds, the client sends a `canvas-snapshot`.
1. `drawingHandler.js` receives the Base64 image.
2. It converts it to a `FormData` object and sends an asynchronous POST request to the **AI Inference Service** (`/predict`).
3. If the AI's top prediction matches the target word with >45% confidence, the backend awards points to the "AI Bot" player and broadcasts the victory message.

### 3. File Inter-dependencies
- `server.js` imports all handlers and registers them to the Socket.IO instance.
- All handlers share the same `redisClient` and `io` instance for consistent state updates across different game events.

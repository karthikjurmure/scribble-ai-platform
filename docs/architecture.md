# 🏛️ System Architecture Guide

This guide provides a detailed view of the technical architecture of the **Scribble AI Platform**. It describes the high-level system topology, the design of each component, and the communication protocols that connect them.

---

## 🌐 High-Level System Topology

The platform consists of a client application and two backend services that cooperate in real time. The layout below illustrates the communication paths and data formats:

```mermaid
graph TD
    %% Define Nodes
    subgraph Frontend [Client Browser]
        UI[UI View & Inputs]
        Canvas[Canvas Component]
        SocketIO_C[Socket.IO Client]
    end

    subgraph Backend [Node.js Game Engine]
        Server[Express Server]
        SocketIO_S[Socket.IO Server]
        RoomHandler[Lobby & Lifecycle Handler]
        ChatHandler[Guess & Score Handler]
        DrawHandler[Stroke & AI Gateway]
        Redis[(Redis Cloud)]
    end

    subgraph AIService [Python AI Microservice]
        FastAPI[FastAPI App]
        Preprocess[PIL/NumPy Preprocessing]
        TFModel[TensorFlow CNN Inference]
    end

    %% Communication Links
    Canvas -->|Local Vector Strokes| UI
    UI -->|Socket.IO Events| SocketIO_C
    SocketIO_C <-->|WebSockets| SocketIO_S
    
    SocketIO_S --> RoomHandler
    SocketIO_S --> ChatHandler
    SocketIO_S --> DrawHandler
    
    DrawHandler -->|1. Push Strokes (LPUSH, EXPIRE 2h)| Redis
    RoomHandler -->|2. Pull History (LRANGE)| Redis
    
    DrawHandler -->|3. POST Base64 image| FastAPI
    FastAPI --> Preprocess
    Preprocess -->|4D Normalized Tensor| TFModel
    TFModel -->|Guesses & Confidence| FastAPI
    FastAPI -->|JSON Response| DrawHandler
```

---

## 📦 Component Breakdown

The codebase is modular, separating execution concerns between visual UI rendering, state synchronization, and neural network calculations.

```
scribble-ai-platform/
├── frontend/                  # Browser client (static files)
│   └── public/
│       ├── index.html         # CSS Grid split-screen view
│       ├── style.css          # Responsive layouts & animations
│       └── js/
│           ├── socket.js      # WS connection manager
│           ├── canvas.js      # Vector brush & mouse/touch events
│           ├── game.js        # Game loops & AI snapshot uploads
│           └── ui.js          # Chat windows & leaderboards
├── game-engine/               # Node.js backend & websocket server
│   ├── src/
│   │   ├── server.js          # Express / HTTP entry point
│   │   ├── state.js           # Shared in-memory game room structures
│   │   ├── handlers/          # Event routers (chat, draw, rooms)
│   │   └── utils/             # Hint generators & scoring algorithms
└── ai-service/                # TensorFlow prediction backend
    └── app/
        ├── main.py            # FastAPI service exposing endpoints
        ├── services/          # Preprocessing & CNN inference tasks
        └── model/             # CNN binary weights & classes index
```

### 1. The Client-Side Frontend (`frontend/`)
The frontend is a vanilla JavaScript single-page application built around an HTML5 Canvas.
*   **Coordinate Scaling**: Different devices have different screen sizes and aspect ratios. To prevent layout stretching, drawings are normalized onto a virtual **800x500 logical canvas** before transmission:
    $$\text{Normalized } X = (X_{\text{screen}} - \text{rect}_{\text{left}}) \times \frac{\text{canvas}_{\text{width}}}{\text{rect}_{\text{width}}}$$
    $$\text{Normalized } Y = (Y_{\text{screen}} - \text{rect}_{\text{top}}) \times \frac{\text{canvas}_{\text{height}}}{\text{rect}_{\text{height}}}$$
*   **Vector Rendering**: Brush movements are captured via mouse or touch pointer events, grouped into coordinate lines, and rendered locally while emitting `draw-data` updates.
*   **AI Capture Cycle**: The drawing player's browser captures a base64-encoded PNG image using `canvas.toDataURL('image/png')` every 15 seconds, uploading it to the backend for the AI bot.

### 2. Node.js Game Engine (`game-engine/`)
The backend coordinates the game lobby and validates players' actions.
*   **Room Lifecycle Management**: Manages user entries and exits. Every active room is populated with a resident `🤖 AI Bot` profile that competes with human guessers.
*   **State Persistence**: Vector stroke segments are stored sequentially in a Redis list. When a player joins a room late, the entire list is fetched and sent to the client to reconstruct the drawing.
*   **AI Gateway**: Receives the drawer's canvas snapshots, maps them to a Multipart FormData payload, and posts them to the AI microservice. If a correct guess is returned, it awards points to the AI Bot.

### 3. FastAPI AI Inference Service (`ai-service/`)
A Python service optimized for quick predictions.
*   **Neural Network Inference**: A 3-block Convolutional Neural Network (CNN) trained on the Google QuickDraw dataset. It processes input shapes and scores them against the 27 target classes.
*   **Image Processing Pipeline**:
    1.  **Alpha Flattening**: Overlays transparent RGBA shapes onto a solid white canvas.
    2.  **Grayscale & Inversion**: Converts pixels to grayscale and inverts them (representing white ink on a black background) to match QuickDraw's formatting.
    3.  **Cropping**: Fits a bounding box (`Image.getbbox()`) tightly around the strokes to remove margin whitespace.
    4.  **Resizing & Normalization**: Rescales the cropped drawing to $28 \times 28$ pixels using Lanczos resampling and normalizes intensities to a floating-point range of `[0.0, 1.0]`.

---

## 📡 Data Protocols & API Definitions

### 1. WebSocket Protocol (Socket.IO client/server)

#### Client-to-Server Messages
-   `join-room` (`{ roomId: string, username: string }`): Places the client in a socket channel and initiates canvas state loading.
-   `start-game` (`roomId`): Initiates the turn loop if there are enough players.
-   `draw-data` (`{ roomId: string, data: { x, y, isNewStroke, size, color } }`): Sends stroke coordinates to all guessers.
-   `clear-canvas` (`roomId`): Wipes the canvas history in both the room and Redis.
-   `chat-message` (`{ roomId: string, message: string }`): Submits a chat message or guess.
-   `canvas-snapshot` (`{ roomId: string, image: base64 }`): Sends the drawing snapshot to be analyzed by the AI.

#### Server-to-Client Messages
-   `score-update` (`[ { id, username, score, isBot } ]`): Updates the leaderboard standings.
-   `load-history` (`[ strokeData ]`): Reconstructs drawing states for late-joining players.
-   `clear-canvas`: Wipes the local canvas elements.
-   `game-started` (`{ role, word, remainingTime, drawerName }`): Starts the turn.
-   `word-hint-update` (`hintText`): Discloses characters of the word over time (e.g., `_ a _ _ e`).
-   `ai-guess` (`{ label, confidence }`): Shares the AI's current predictions.
-   `round-over` (`{ word }`): Ends the turn, reveals the word, and locks the canvas.
-   `game-over` (`{ leaderboard, winner }`): Announces final scores.

### 2. HTTP Inference API (Backend ↔ AI Service)
The backend communicates with the FastAPI service using standard HTTP multipart requests.

-   **Endpoint**: `POST /predict`
-   **Headers**: `Content-Type: multipart/form-data`
-   **Request Body**:
    -   `file`: Binary file data (`drawing.png`)
-   **Response Format** (`200 OK`):
    ```json
    {
      "guesses": [
        { "label": "apple", "confidence": 0.942 },
        { "label": "circle", "confidence": 0.038 },
        { "label": "mushroom", "confidence": 0.020 }
      ]
    }
    ```

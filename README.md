# 🎨 Scribble AI Platform

Welcome to the **Scribble AI Platform**, a real-time, multiplayer drawing and guessing game (inspired by Skribbl.io) augmented with an artificial intelligence service that guesses sketches in real time!

The project is structured into three main components: a real-time game engine, a client-side frontend, and a Python-based AI prediction service.

---

## 📖 Project Documentation Index

For in-depth explanations of system design, code directories, and APIs, refer to the guides below:

*   🏛️ **[System Architecture Guide](file:///c:/Users/Admin/Documents/Projects/scribble-ai-platform/docs/architecture.md)**: High-level topology, component breakdowns, coordinates normalization math, and pipeline diagrams.
*   📂 **[Folder-by-Folder Guide](file:///c:/Users/Admin/Documents/Projects/scribble-ai-platform/docs/folder_structure.md)**: Details on file responsibilities and folder roles across the repository.
*   📡 **[API Reference Guide](file:///c:/Users/Admin/Documents/Projects/scribble-ai-platform/docs/api_reference.md)**: Detailed specifications of Socket.IO WebSocket events and FastAPI REST endpoints.
*   🔄 **[Workflows & Sequences Guide](file:///c:/Users/Admin/Documents/Projects/scribble-ai-platform/docs/workflows.md)**: Sequence and state charts representing round lifecycles, real-time drawing sync, AI loops, and guess evaluations.
*   📚 **[Supplemental Flows Guide](file:///c:/Users/Admin/Documents/Projects/scribble-ai-platform/flow.md)**: An overview linking various developer documentation sheets together.

---

## 🛠️ System Architecture Overview

The Scribble AI Platform coordinates three modular pillars:

```mermaid
graph LR
    Client[Client UI: HTML/CSS/JS] <-->|WebSockets: Socket.IO| Engine[Game Engine: Node.js & Express]
    Engine -->|Write Drawing Strokes| Redis[(Redis Cloud State Store)]
    Engine <-->|HTTP POST: base64 snapshots| AIService[AI Service: FastAPI & TensorFlow]
```

1.  **Frontend (Browser UI)**: A lightweight, responsive Vanilla JS interface managing client-side events, coordinate normalization (scaling strokes onto a logical $800 \times 500$ grid), and scoreboard updates.
2.  **Game Engine (Node.js & Redis)**: The central socket-driven state machine coordinating game rooms, drawing streams, guess intercepts, round clocks, and persistent Redis canvas histories.
3.  **AI Inference Service (Python FastAPI & TensorFlow)**: A high-performance neural network trained on the Google QuickDraw dataset to recognize drawings. Formats and processes sketches through a Pillow preprocessing pipeline.

---

## 🏁 Getting Started (Local Setup)

To spin up the Scribble AI Platform on your local machine, run the following setup steps:

### 📋 Prerequisites
Ensure you have the following installed:
*   [Node.js (v16+)](https://nodejs.org/)
*   [Python (v3.9 - v3.12)](https://www.python.org/)
*   An active Redis instance (or a Redis Cloud URI)

---

### Step 1: Run the AI Inference Service

1.  Navigate to the AI service directory:
    ```powershell
    cd ai-service
    ```
2.  Create and activate a Python virtual environment:
    ```powershell
    python -m venv venv
    venv\Scripts\activate
    ```
3.  Install Python dependencies:
    ```powershell
    pip install -r requirements.txt
    ```
4.  Start the FastAPI application:
    ```powershell
    python app/main.py
    ```
    *The service will start on `http://localhost:8000`. You can confirm health via `http://localhost:8000/health` in your browser.*

---

### Step 2: Run the Node.js Game Engine

1.  Open a new terminal pane and navigate to the game engine directory:
    ```powershell
    cd game-engine
    ```
2.  Install Node dependencies:
    ```powershell
    npm install
    ```
3.  Configure the environment:
    Create a `.env` file in the `game-engine/` folder with the following configuration:
    ```env
    PORT=3000
    REDIS_URL=redis://default:YOUR_REDIS_PASSWORD@YOUR_REDIS_ENDPOINT:PORT
    AI_SERVICE_URL=http://localhost:8000
    ```
4.  Start the Node server:
    ```powershell
    node src/server.js
    ```
    *The server runs on `http://localhost:3000` and serves the static frontend assets.*

---

### Step 3: Join and Play!

1.  Open your browser to `http://localhost:3000`.
2.  Type a username (e.g., `Leonardo`), enter a room ID (e.g., `RoomA`), and click **Join Room**.
3.  Open a second browser tab (in incognito mode), join with a different username (e.g., `Picasso`), and enter the same room ID (`RoomA`).
4.  Click **Start Game** to start the match! 
5.  The designated drawer starts sketching on the canvas. Guesser players type their guesses in the chat window, while the `🤖 AI Bot` uploads canvas snapshots every 15 seconds to make its own predictions!

---

## 🏆 Game Rules & Mechanics

### ⏱️ Progressive Hint Disclosure
Words have letters revealed automatically as the 60-second timer counts down:
*   **Turn start**: 1 random letter is revealed immediately.
*   **Remaining duration**: Additional letters are revealed at equal division intervals based on word length.

### 💯 Point Allocation Formula
Players earn points based on how quickly they guess the secret word:
*   **0s to 10s**: 100 points
*   **10s to 20s**: 75 points
*   **20s to 30s**: 50 points
*   **30s to 40s**: 30 points
*   **40s to 50s**: 20 points
*   **50s to 60s**: 10 points
*   **Drawer Bonus**: The drawer receives a flat **+50 bonus** points the moment the first player (human or AI Bot) correctly guesses the word.

# 📂 Folder-by-Folder Codebase Guide

This document provides a detailed, directory-by-directory breakdown of the **Scribble AI Platform** project. It outlines the responsibilities of each folder and describes the core files contained within them.

---

## 🎨 1. `frontend/` (Browser UI Client)
This folder holds the client-side user interface. The frontend is built using standard Vanilla HTML, CSS, and JS to keep performance high and dependencies minimal.

*   ### `frontend/assets/`
    *   Holds local static assets, logos, and media icons used in the game interface.

*   ### `frontend/public/`
    *   **[index.html](file:///c:/Users/Admin/Documents/Projects/scribble-ai-platform/frontend/public/index.html)**: The HTML structural blueprint. It uses a clean semantic layout, defining the main paint canvas, the player scorecard sidebar, and the right-hand chat interface.
    *   **[style.css](file:///c:/Users/Admin/Documents/Projects/scribble-ai-platform/frontend/public/style.css)**: The stylesheet containing layout rules. It defines responsive grid designs, glassmorphism card styling, drawing toolbars, and responsive layouts that adjust for desktop vs. mobile viewports.
    *   **[manifest.json](file:///c:/Users/Admin/Documents/Projects/scribble-ai-platform/frontend/public/manifest.json)**: The web app manifest that makes the platform installable as a Progressive Web App (PWA) on mobile home screens.

*   ### `frontend/public/js/`
    *   **[socket.js](file:///c:/Users/Admin/Documents/Projects/scribble-ai-platform/frontend/public/js/socket.js)**: Configures the client-side Socket.IO client, pointing to the local node server or Render cloud deployment and managing status badges (`🟢 Connected` / `🔴 Disconnected`).
    *   **[canvas.js](file:///c:/Users/Admin/Documents/Projects/scribble-ai-platform/frontend/public/js/canvas.js)**: Manages drawing activities. Captures mouse pointer movements and touch events, renders lines locally, scales inputs to a unified $800 \times 500$ logical coordinates grid, and transmits them to the server.
    *   **[game.js](file:///c:/Users/Admin/Documents/Projects/scribble-ai-platform/frontend/public/js/game.js)**: Manages local gameplay state. Handles starting games, locking/unlocking the drawing board based on player roles, displaying hints, and running the 15-second screenshot capture loop.
    *   **[ui.js](file:///c:/Users/Admin/Documents/Projects/scribble-ai-platform/frontend/public/js/ui.js)**: Manages user interface elements. It updates player scores on the leaderboard, appends system messages to the chat box, and styles live AI prediction bubbles.

---

## ⚙️ 2. `game-engine/` (Backend WebSocket Server)
This is the Node.js game engine responsible for room state synchronization, game timers, guess validation, scoring, and acting as the gateway to the AI service.

*   ### `game-engine/src/`
    *   **[server.js](file:///c:/Users/Admin/Documents/Projects/scribble-ai-platform/game-engine/src/server.js)**: The main entry point. Starts the Express HTTP server to serve the frontend, initializes Socket.IO connection routes, and opens the connection to the Redis cloud database.
    *   **[state.js](file:///c:/Users/Admin/Documents/Projects/scribble-ai-platform/game-engine/src/state.js)**: Holds shared, in-memory structures mapping room IDs to player lists, current words, timers, and scoring trackers.

*   ### `game-engine/src/handlers/`
    *   **[roomHandler.js](file:///c:/Users/Admin/Documents/Projects/scribble-ai-platform/game-engine/src/handlers/roomHandler.js)**: Manages player logins, lobby registration, and game launches. It also automatically spawns the `🤖 AI Bot` into the player pool and pulls canvas history from Redis for late-joining players.
    *   **[chatHandler.js](file:///c:/Users/Admin/Documents/Projects/scribble-ai-platform/game-engine/src/handlers/chatHandler.js)**: Listens for incoming chat messages. If a guess matches the target word, it computes player points based on elapsed time, updates the leaderboard, and triggers end-of-round state transitions.
    *   **[drawingHandler.js](file:///c:/Users/Admin/Documents/Projects/scribble-ai-platform/game-engine/src/handlers/drawingHandler.js)**: Broadcasts drawing data to other guessers and saves strokes in Redis. It also processes base64-encoded canvas snapshots by posting them to the AI microservice.

*   ### `game-engine/src/utils/`
    *   **[gameLogic.js](file:///c:/Users/Admin/Documents/Projects/scribble-ai-platform/game-engine/src/utils/gameLogic.js)**: Orchestrates game logic, schedules round timers, selects random words, and manages progressive letter reveals.
    *   **[words.json](file:///c:/Users/Admin/Documents/Projects/scribble-ai-platform/game-engine/src/utils/words.json)**: The dataset containing words select-eligible for rounds, matching the dictionary labels of the AI prediction model.

---

## 🤖 3. `ai-service/` (TensorFlow FastAPI Microservice)
This Python service processes canvas drawing screenshots and applies a Convolutional Neural Network (CNN) trained on the Google QuickDraw dataset to recognize drawings.

*   ### `ai-service/app/`
    *   **[main.py](file:///c:/Users/Admin/Documents/Projects/scribble-ai-platform/ai-service/app/main.py)**: The microservice entry point. Sets up the FastAPI framework, exposes `/predict` (POST) and `/health` (GET) routes, and configures Uvicorn.

*   ### `ai-service/app/services/`
    *   **[image_processing.py](file:///c:/Users/Admin/Documents/Projects/scribble-ai-platform/ai-service/app/services/image_processing.py)**: The image preprocessing pipeline. Converts RGBA canvas snapshots into grayscale, inverts colors to match QuickDraw's white-ink-on-black-background format, crops empty borders, rescales images to the model size, and normalizes array ranges.
    *   **[model_service.py](file:///c:/Users/Admin/Documents/Projects/scribble-ai-platform/ai-service/app/services/model_service.py)**: Loads the TensorFlow Keras model and predicts labels, returning the top 3 guesses and their confidence levels.

*   ### `ai-service/app/model/`
    *   **`model.h5`**: The binary neural network file storing trained weights and layers.
    *   **`classes.txt`**: The list of 27 recognizable categories (e.g. `apple`, `car`, `guitar`, `penguin`).

---

## 📚 4. `docs/` (System Flows & Guides)
Contains structured documentation detailing specific workflows and components.

*   **[architecture.md](file:///c:/Users/Admin/Documents/Projects/scribble-ai-platform/docs/architecture.md)**: High-level overview of topology, data routes, API payloads, and normalized coordinates math.
*   **[frontend_flow.md](file:///c:/Users/Admin/Documents/Projects/scribble-ai-platform/docs/frontend_flow.md)**: Details on browser modules, CSS structures, and drawing synchronization.
*   **[backend_flow.md](file:///c:/Users/Admin/Documents/Projects/scribble-ai-platform/docs/backend_flow.md)**: Explanations of Node.js room states, Redis configurations, and scoring.
*   **[ai_service_flow.md](file:///c:/Users/Admin/Documents/Projects/scribble-ai-platform/docs/ai_service_flow.md)**: Deep dive into python preprocessing routines and CNN inference.

# Project Architecture & Flows 📚

Welcome to the **Scribble AI Platform**! The project is a real-time, AI-augmented multiplayer game. For detailed technical flows and file-level documentation, please see the individual documentation files below:

0.  **[System Architecture Guide](file:///c:/Users/Admin/Documents/Projects/scribble-ai-platform/docs/architecture.md)**: 🏛️
    - **What it does**: High-level topology, component breakdowns, communication protocols, state schemas, and coordinates normalisation mathematics.

0.5. **[Folder-by-Folder Guide](file:///c:/Users/Admin/Documents/Projects/scribble-ai-platform/docs/folder_structure.md)**: 📂
    - **What it does**: Detailed file-by-file explanations grouped by directory layers.

0.7. **[API Reference Guide](file:///c:/Users/Admin/Documents/Projects/scribble-ai-platform/docs/api_reference.md)**: 📡
    - **What it does**: Specifications for WebSocket events and the AI service REST API endpoints.

0.9. **[System Workflows & Sequences](file:///c:/Users/Admin/Documents/Projects/scribble-ai-platform/docs/workflows.md)**: 🔄
    - **What it does**: Mermaid state and sequence charts detailing the game loop, stroke sync, chat scoring, and AI evaluation runs.

1.  **[Frontend Architecture (Browser)](docs/frontend_flow.md)**: 🎨 
    - **Key Tech**: Vanilla JS, CSS Grid, Socket.IO Client.
    - **What it does**: Handles touch/mouse drawing, coordinate normalization for responsiveness, and real-time UI updates (leaderboard/chat).

2.  **[Backend Engine (Node.js)](docs/backend_flow.md)**: ⚙️ 
    - **Key Tech**: Express, Socket.IO Server, Redis.
    - **What it does**: Manages multiplayer rooms, scoring logic, Redis-based canvas history persistence, and static file serving.

3.  **[AI Inference Service (Python)](docs/ai_service_flow.md)**: 🤖 
    - **Key Tech**: FastAPI, TensorFlow/Keras, Pillow.
    - **What it does**: Provides high-speed CNN predictions for drawing analysis, converting canvas snapshots into word guesses.

---

## 🚀 Connection Overview
- **Frontend ↔ Backend**: Bi-directional real-time communication via WebSockets (Socket.IO).
- **Backend ↔ AI Service**: Asynchronous request/response via HTTP POST.
- **Backend ↔ Redis**: Persistent state storage for canvas strokes.

## 🏁 Getting Started
1. **AI Service**: `cd ai-service && venv\Scripts\activate && python app/main.py`
2. **Game Engine**: `cd game-engine && node src/server.js` (Serves the frontend automatically)
3. **Play**: Open `http://localhost:3000` in your browser.

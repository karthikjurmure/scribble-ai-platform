# 📡 API Reference Guide

This document describes the application programming interfaces (APIs) and communication protocols for the **Scribble AI Platform**. It details the WebSocket events exchanged between the frontend client and the game engine, and the HTTP endpoints exposed by the AI service.

---

## 🔌 1. WebSocket API (Socket.IO)

Real-time interactions are powered by Socket.IO. Below is the specification for both client-emitted messages and server-broadcasted events.

### ⬆️ Client-to-Server Events

#### 1. `join-room`
Sent by the client to register a player in a specific lobby.
*   **Payload**:
    ```json
    {
      "roomId": "string",
      "username": "string"
    }
    ```
*   **Behavior**: Joins the socket to the specified room channel. Creates the in-memory room structure if it is the first player. Emits a `score-update` and loads canvas history using `load-history`.

#### 2. `start-game`
Sent by a player in the lobby to start the match.
*   **Payload**: `"string"` (The Room ID)
*   **Behavior**: Validates that at least 2 players are in the room. Selects the first drawer, sets game state to active, selects a word, and triggers the `game-started` event.

#### 3. `draw-data`
Sent by the drawer as they sketch on the canvas.
*   **Payload**:
    ```json
    {
      "roomId": "string",
      "data": {
        "x": 120.5,
        "y": 340.2,
        "isNewStroke": true,
        "size": 5,
        "color": "#000000"
      }
    }
    ```
    *   *Note: Coordinates $x$ and $y$ are normalized float percentages scaled to an $800 \times 500$ grid.*
*   **Behavior**: Appends the coordinates to the room's drawing list in Redis and broadcasts the coordinates to other players in the room.

#### 4. `clear-canvas`
Sent by the drawer to wipe the canvas clean.
*   **Payload**: `"string"` (The Room ID)
*   **Behavior**: Deletes the room history key in Redis and broadcasts the clear command to all players in the room.

#### 5. `chat-message`
Sent when a user submits text in the chat input.
*   **Payload**:
    ```json
    {
      "roomId": "string",
      "message": "string"
    }
    ```
*   **Behavior**:
    *   If the sender is the drawer, it ignores the guess and replies with an error event.
    *   If the message matches the secret word (case-insensitive), it registers a correct guess, awards points, and broadcasts a system notification.
    *   Otherwise, it forwards the chat message to all players.

#### 6. `canvas-snapshot`
Sent periodically (every 15 seconds) by the drawer to run AI prediction.
*   **Payload**:
    ```json
    {
      "roomId": "string",
      "image": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA..."
    }
    ```
*   **Behavior**: Converts the base64 string to a buffer, builds a multipart form payload, and sends it to the AI microservice.

---

### ⬇️ Server-to-Client Events

#### 1. `score-update`
Broadcast to update the list of players and scores.
*   **Payload**:
    ```json
    [
      { "id": "ai_bot", "username": "🤖 AI Bot", "score": 150, "isBot": true },
      { "id": "socket_id_1", "username": "Leonardo", "score": 220 },
      { "id": "socket_id_2", "username": "Picasso", "score": 90 }
    ]
    ```

#### 2. `load-history`
Sent to a newly connected player to draw existing strokes on their canvas.
*   **Payload**:
    ```json
    [
      { "x": 100.5, "y": 200.0, "isNewStroke": true, "size": 5, "color": "#000" },
      { "x": 105.2, "y": 202.4, "isNewStroke": false, "size": 5, "color": "#000" }
    ]
    ```

#### 3. `clear-canvas`
Sent to wipe the local canvas display.
*   **Payload**: *None*

#### 4. `game-started`
Sent to players when a round begins.
*   **Payload**:
    ```json
    {
      "role": "drawer" | "guesser",
      "word": "string",
      "remainingTime": 60000,
      "drawerName": "string"
    }
    ```
    *   *Note: For the drawer, the `word` property reveals the full word. For guessers, it contains blank letters (e.g., `_ _ _ _ _`).*

#### 5. `word-hint-update`
Sent to guessers as letters are revealed over time.
*   **Payload**: `"string"` (e.g., `a _ _ l e`)

#### 6. `guess-success`
Sent privately to a client when they guess the correct word.
*   **Payload**: *None*

#### 7. `ai-guess`
Broadcast to the room when the AI service returns a prediction that does not match the secret word.
*   **Payload**:
    ```json
    {
      "label": "string",
      "confidence": "string" // Percentage formatted as a string, e.g. "76"
    }
    ```

#### 8. `system-message`
System-wide messages (guesses, round outcomes, score alerts).
*   **Payload**: `"string"`

#### 9. `round-over`
Sent when a round completes.
*   **Payload**:
    ```json
    {
      "word": "string" // The complete secret word
    }
    ```

#### 10. `game-over`
Sent when all players have drawn and the game ends.
*   **Payload**:
    ```json
    {
      "leaderboard": [
        { "id": "socket_id_1", "username": "Leonardo", "score": 350 }
      ],
      "winner": { "id": "socket_id_1", "username": "Leonardo", "score": 350 }
    }
    ```

#### 11. `error-msg`
Sent privately to report an error (e.g., drawer attempting to chat).
*   **Payload**: `"string"`

---

## 🤖 2. HTTP REST API (AI Microservice)

The Python FastAPI microservice handles drawing analysis. It exposes two endpoints.

### 1. `POST /predict`
Submits a drawing snapshot for classification.
*   **Headers**: `Content-Type: multipart/form-data`
*   **Request Form Parameter**:
    -   `file`: Binary file upload (e.g. `drawing.png`)
*   **Response (`200 OK`)**:
    ```json
    {
      "guesses": [
        {
          "label": "guitar",
          "confidence": 0.923412024974823
        },
        {
          "label": "piano",
          "confidence": 0.04105234146118164
        },
        {
          "label": "umbrella",
          "confidence": 0.01254124982124503
        }
      ]
    }
    ```

### 2. `GET /health`
Returns service metadata and checks that the classification model is loaded.
*   **Response (`200 OK`)**:
    ```json
    {
      "status": "ok",
      "classes": 27,
      "img_size": 28
    }
    ```

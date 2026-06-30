# 🔄 System Workflows & Sequences

This document provides visual representations of the core workflows in the **Scribble AI Platform**. It uses Mermaid flowcharts and sequence diagrams to detail the game lifecycle, drawing synchronization, guess verification, and the AI prediction loops.

---

## 🏁 1. Game & Round Lifecycle
The state machine of a room progresses through three main phases: Lobby Setup, Round Loop, and Game Over.

```mermaid
stateDiagram-v2
    [*] --> Lobby : Players join room
    
    state Lobby {
        [*] --> WaitingForPlayers
        WaitingForPlayers --> ReadyToStart : Players >= 2 (includes AI Bot)
        ReadyToStart --> WaitingForPlayers : Player leaves (Players < 2)
    }

    Lobby --> RoundStart : Admin triggers 'start-game'
    
    state RoundLoop {
        [*] --> RoundStart
        RoundStart --> ActiveRound : Pick word & Assign drawer
        
        state ActiveRound {
            [*] --> InProgress
            InProgress --> Drawing : Drawer paints on canvas
            InProgress --> Guessing : Guessers type in chat
            InProgress --> AISnapshot : Periodic 15s snapshots uploaded
        }
        
        ActiveRound --> RoundEnd : All human players guess correctly OR 60s Timer expires
        RoundEnd --> ActiveRound : Increment drawer index & Start next round (if players remain)
    }

    RoundLoop --> GameOver : Drawer index matches player pool length
    
    state GameOver {
        [*] --> EvaluateScores
        EvaluateScores --> AnnounceWinner : Sort leaderboard
    }

    GameOver --> Lobby : Reset scores & Enable 'Start Game'
```

---

## 🎨 2. Real-Time Drawing Sync
Drawing coordination occurs as a stream of vector events. Coordinates are normalized on the drawer's client and restored on guesser canvases.

```mermaid
sequenceDiagram
    autonumber
    actor Drawer as Drawer (Client)
    participant Server as Game Server (Node.js)
    database Redis as Canvas Cache (Redis)
    actor Guesser as Guesser (Client)

    Note over Drawer, Guesser: Game in progress (Drawer drawing)
    
    Drawer->>Drawer: Capture mouse/touch coords
    Drawer->>Drawer: Convert coords to 800x500 normalized bounds
    Drawer->>Drawer: Draw local pixel coordinate on Canvas
    
    Drawer->>Server: Emit socket event 'draw-data' { roomId, coordinates }
    
    par Save & Broadcast
        Server->>Redis: LPUSH room:roomId:history { coordinates }
        Server->>Redis: EXPIRE room:roomId:history 7200s (2hr TTL)
    and
        Server->>Guesser: Broadcast socket event 'draw-data' { coordinates }
    end
    
    Guesser->>Guesser: Read brush parameters (color, size)
    Guesser->>Guesser: Map 800x500 coordinates back to local canvas bounds
    Guesser->>Guesser: Draw line segment
```

---

## 🤖 3. AI Prediction Pipeline
The AI loop runs automatically every 15 seconds. It handles image conversion on the server and runs inference inside the TensorFlow container.

```mermaid
sequenceDiagram
    autonumber
    actor Drawer as Drawer (Client)
    participant Server as Game Server (Node.js)
    participant AI as AI Service (FastAPI)
    actor Room as Room Broadcast (All Clients)

    loop Every 15 Seconds
        Drawer->>Drawer: Extract canvas canvas.toDataURL('image/png')
        Drawer->>Server: Emit socket 'canvas-snapshot' { roomId, Base64 }
        
        Server->>Server: Check if AI has already guessed correctly this round
        Note over Server: If already guessed, discard snapshot
        
        Server->>Server: Strip header & convert base64 to binary buffer
        Server->>AI: HTTP POST /predict (Multipart FormData: buffer)
        
        AI->>AI: Flatten RGBA alpha to solid white
        AI->>AI: Grayscale & invert (white strokes on black background)
        AI->>AI: Tight bounding-box crop (Image.getbbox)
        AI->>AI: Resize proportionally & normalize values [0.0 - 1.0]
        AI->>AI: tf.keras model inference prediction
        
        AI-->>Server: HTTP 200 OK: Guesses & confidence percentages
        
        alt Top Guess matches target word (Confidence > 45%)
            Server->>Server: Set room.aiGuessedThisRound = true
            Server->>Server: Add points to AI Bot score
            Server->>Room: Broadcast system-message "🤖 AI Bot guessed the word!"
            Server->>Room: Broadcast score-update
            Server->>Server: Trigger checkRoundStatus() to evaluate turn advancement
        else Top Guess is incorrect
            Server->>Room: Broadcast 'ai-guess' { label, confidence }
            Note over Room: Render blue "I think this is a..." bubble in chat log
        end
    end
```

---

## 💬 4. Guess & Scoring Evaluation
When human guessers submit chat messages, they are intercepted by the scoring engine rather than simply being relayed.

```mermaid
sequenceDiagram
    autonumber
    actor Guesser as Guesser (Client)
    participant Server as Game Server (Node.js)
    actor Room as Room Broadcast (All Clients)

    Guesser->>Server: Emit socket event 'chat-message' { roomId, message }
    
    alt Sender is the Drawer
        Server-->>Guesser: Emit 'error-msg' "Drawers cannot use the chat!"
    else Sender is a Guesser
        alt Message matches secret word (case-insensitive)
            alt Guesser already guessed correctly before
                Server-->>Guesser: Emit 'error-msg' "You cannot send the secret word!"
            else First time guessing correctly
                Server->>Server: Append player socket.id to correctGuessers list
                Server->>Server: Calculate points: f(elapsed_seconds)
                Server->>Server: Add points to Guesser's score
                
                alt If this is the FIRST correct guess in the round
                    Server->>Server: Add +50 points bonus to Drawer's score
                end
                
                Server->>Room: Broadcast system-message "🎉 User guessed the word!"
                Server->>Room: Broadcast score-update
                Server-->>Guesser: Emit 'guess-success' (locks local guess inputs)
                Server->>Server: Trigger checkRoundStatus() to see if all players have guessed
            end
        else Message is incorrect
            Server->>Room: Broadcast 'chat-message' { sender, message, isIncorrectGuess: true }
        end
    end
```

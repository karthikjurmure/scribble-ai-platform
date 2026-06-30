# Frontend Architecture & Flow 🎨

The Scribble AI frontend is a high-performance, vanilla JavaScript application optimized for both desktop and mobile devices. It manages real-time drawing, multiplayer synchronization, and AI interactions without the overhead of a heavy framework.

## 📁 File Structure & Responsibilities

### Core HTML & Styling
- **`index.html`**: Defines the structural layout. It uses a **CSS Grid** system to dynamically switch between a desktop sidebar layout and a mobile split-view (Top Canvas / Bottom Leaderboard+Chat). It also includes the PWA manifest and mobile-specific meta tags.
- **`style.css`**: Contains the complete design system. It implements:
    - **Desktop View**: Sidebar for scores, center for canvas, right for chat.
    - **Mobile View**: 40/60 split for interaction data below a square drawing canvas.
    - **Aesthetics**: Modern dark-mode theme with vibrant accents and a dedicated white-background chat mode for mobile users.

### JavaScript Modules (`public/js/`)
- **`socket.js`**: Initializes the `Socket.IO` client and handles the primary connection to the Node.js backend.
- **`canvas.js`**: The heart of the drawing logic.
    - **Normalization**: Uses a custom `getPos` function to map screen coordinates to a fixed 800x500 internal coordinate system. This ensures drawing is perfectly aligned across different screen sizes.
    - **Touch/Mouse Support**: Unified event listeners for `mousedown`/`mousemove` and `touchstart`/`touchmove`.
    - **Synchronization**: Emits `draw-data` (including size, color, and coordinates) to the server.
- **`ui.js`**: Manages all DOM updates.
    - **Leaderboard**: Dynamically builds the score list, switching to a compact column view on mobile.
    - **Notifications**: Handles success/error banners and AI thinking bubbles.
- **`game.js`**: The orchestration layer.
    - **Game Loop**: Listens for `game-started`, `round-over`, and `word-hint-update`.
    - **Role Management**: Disables/Enables tools (like the drawing toolbar and Clear button) based on whether the user is the `drawer` or `guesser`.

---

## 🔄 Inter-Module Connections

1.  **User Input** -> `game.js` (joins room) -> `socket.js` (emits to server).
2.  **Drawing Action** -> `canvas.js` (renders locally + calculates normalized coords) -> `socket.js` (broadcasts).
3.  **Incoming Stroke** -> `socket.js` (receives) -> `canvas.js` (renders remote stroke).
4.  **Score Update** -> `socket.js` (receives) -> `ui.js` (updates DOM).

## 📱 Mobile Optimizations
- **PWA Support**: `manifest.json` allows the app to be installed and run in standalone mode.
- **Drawing Toolbar**: A custom UI component that allows drawers to change brush size and color, which is then emitted as part of the `draw-data` payload.

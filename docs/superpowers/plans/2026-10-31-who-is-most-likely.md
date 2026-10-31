# Who Is Most Likely To? Implementation Plan

> **For agentic workers:** Follow this plan task by task and verify each task before continuing. Use test-first development for room rules and interactions. Do not commit or push unless explicitly requested.

**Goal:** Build a bilingual, real-time “Who Is Most Likely To?” party game at `game.man.ovh` in a project folder separate from `erik.man.ovh`.

**Architecture:** A React/Vite client provides host and phone interfaces. A Node.js HTTP server with Socket.IO owns ephemeral rooms and serves the production Vite build. Docker Compose attaches the game service to the existing Caddy Docker network, and Caddy reverse-proxies the hostname to the game service.

**Tech Stack:** React, Vite, TypeScript, Node.js, Socket.IO, Express, `qrcode.react`, Node built-in test runner, Playwright, Docker Compose, Caddy.

## Global Constraints

- Italian is the default room language; English is also supported and chosen per room.
- The host creates and controls a room; players join by QR code or short code from their phones.
- Votes remain private until the host reveals aggregate results; do not expose individual votes to any client.
- A player may change their vote until reveal; only the host can start, reveal, advance, or end a room.
- Any player may submit one custom question per round; trim and validate plain text with a maximum length of 160 characters.
- A queued custom question is used FIFO before built-in questions in the next round and is displayed in the room language as submitted.
- Room state and custom questions are in memory only; restart ends all active rooms and no account or database is introduced.
- Keep `game.man.ovh` as a standalone project directory beside `erik.man.ovh`; never put its code or dependencies into the portfolio project.
- Use Node.js 22 and ECMAScript modules for the server.
- Use the existing Caddy container on its confirmed external Docker network. Do not guess its network name or replace the active Caddy configuration.

---

### Task 1: Scaffold the standalone app

**Files:**
- Create: `package.json`, `package-lock.json`, `vite.config.ts`, `tsconfig.json`, `index.html`, `.gitignore`, `.dockerignore`.
- Create: `src/main.tsx`, `src/App.tsx`, `src/styles.css`.
- Create: `server/index.js` and `server/rooms.js`.
- Create: `shared/questions.json` with initial Italian/English prompt pairs.

**Steps:**
- Initialize an independent Git repository in `game.man.ovh` on `main`; set no remote unless the user provides one.
- Add runtime dependencies `express`, `socket.io`, `socket.io-client`, and `qrcode.react`; add development dependencies `vite`, `typescript`, `@vitejs/plugin-react`, `@types/react`, `@types/react-dom`, `@playwright/test`, and `concurrently`.
- Configure `npm run dev` to run Vite on port 5173 and the Socket.IO server on port 3001; proxy `/socket.io` from Vite to the Node server. Production sets `PORT=3000` inside its container for Caddy.
- Configure `npm run build` as `vite build`, `npm start` as `node server/index.js`, `npm test` as `node --test`, and `npm run test:e2e` as `playwright test`.
- Set `package.json` to `"type": "module"` so `server/index.js` and the Vite config use the same ESM format.
- Run `npm run build` and `npm test` to verify the scaffold and test runner work before implementing game rules.

**Expected result:** A clean, independently runnable client/server project with the development origins and production serving strategy fixed.

### Task 2: Implement and test authoritative room rules

**Files:**
- Create: `server/rooms.js` with `createRoom`, `joinRoom`, `submitQuestion`, `startRound`, `castVote`, `revealVotes`, `nextRound`, `endRoom`, and `getPublicRoomState`.
- Create: `tests/rooms.test.js` using `node:test` and `node:assert/strict`.
- Create/modify: `shared/questions.json` for built-in bilingual prompts.

**Interfaces:**
- `createRoom({ hostName, language })` returns `{ roomCode, hostPlayerId, sessionToken }`.
- `joinRoom({ roomCode, name })` returns `{ playerId, sessionToken, publicState }`.
- `reconnectRoom({ roomCode, sessionToken })` restores the same host/player identity while the room is alive.
- `submitQuestion({ roomCode, playerId, text })` returns `{ queuePosition }`.
- `startRound({ roomCode, actorId })`, `revealVotes({ roomCode, actorId })`, `nextRound({ roomCode, actorId })`, and `endRoom({ roomCode, actorId })` reject non-host actors or invalid phases.
- `castVote({ roomCode, playerId, targetPlayerId })` replaces that player's pending vote and rejects self-votes and unknown players.
- `getPublicRoomState(roomCode)` returns room code, language, host ID, phase, player IDs/names, current prompt, submitted count, queued-question count, and results only after reveal. It never includes voter-to-target mappings.

**Tests to write first:**
- Host creates a unique six-character room code; join succeeds with a valid code and rejects invalid code/name.
- Non-host cannot start, reveal, advance, or end a room.
- A player casts one vote, changes it before reveal, and cannot vote for themselves.
- Tally and ties are hidden before reveal and aggregate-only after host reveal.
- A player can submit one non-empty question per round, trimmed to 160 characters; blank, overlong, and second submissions are rejected.
- Submitted questions enter a FIFO queue and the oldest custom question becomes the next round's prompt before a built-in prompt.
- A custom question is shown verbatim for the room language; built-in prompts use the room's selected language.
- Room end clears it; inactive rooms are removed by the expiry sweep.

**Steps:**
- Write each rule test in `tests/rooms.test.js` and run `npm test` to observe expected failures.
- Implement the minimum room state and transitions in `server/rooms.js` until each test passes.
- Run `npm test` after each rule group.

**Expected result:** All room transitions, host permissions, vote privacy, custom prompt queue, and expiry are deterministic and tested without network or database dependencies.

### Task 3: Add the Socket.IO protocol

**Files:**
- Create: `server/socket-events.js` for validated event handlers and public room broadcasts.
- Modify: `server/index.js` to configure Express, static serving, Socket.IO, and the expiry sweep.
- Create: `tests/socket-flow.test.js` using real Socket.IO client connections against an ephemeral local server.

**Event contract:**
- Client to server: `room:create`, `room:join`, `room:reconnect`, `host:start`, `vote:cast`, `question:submit`, `host:reveal`, `host:next`, `host:end`.
- Server to client: `room:state`, `room:error`, `room:ended`.
- Every mutating request is checked against the authoritative room store. Broadcast `room:state` contains no votes before reveal and aggregate results only after reveal.

**Tests to write first:**
- A host creates a room; two players join; all three receive matching public roster state.
- A participant's custom question updates queue length but not current prompt, then becomes the prompt after the host advances.
- A non-host `host:reveal` request receives `room:error` and does not change phase.
- The room state payload has no voter ID, target ID, or raw vote map before reveal.
- Disconnect and reconnect with the same token restore the player while the room is alive.

**Steps:**
- Run the socket integration test before implementation and verify it fails because the server events are absent.
- Implement the listed handlers, acknowledgement/error payloads, and host-only guards.
- Run `npm test` and verify all room and socket tests pass.

### Task 4: Build host and phone interfaces

**Files:**
- Create: `src/lib/socket.ts` for one shared Socket.IO client connection.
- Create: `src/lib/i18n.ts` for Italian/English interface copy.
- Create: `src/components/CreateRoom.tsx`, `JoinRoom.tsx`, `HostScreen.tsx`, `PlayerScreen.tsx`, `PromptCard.tsx`, and `QuestionComposer.tsx`.
- Modify: `src/App.tsx` for create/join/host/player routes and state.
- Modify: `src/styles.css` for the shared-screen stage and phone-first voting view.
- Create: `playwright.config.ts` and `tests/game.spec.ts`.

**Behavior:**
- Landing page creates a room or joins using a short code; host creation chooses room language, default Italian.
- Host room view uses `/room/:code/host`; QR/link joins use `/room/:code/join`; a joined player is routed to `/room/:code/play`.
- Store only the room-specific `sessionToken` in `sessionStorage` to reconnect a host/player after a refresh; delete it on `room:ended` or room expiry.
- Host view displays the question, QR code, short room code, roster, ready/voted counts, and controls for start, reveal, next, and end.
- Player view displays the current prompt and large touch-friendly player choices; the player sees own submitted state but not live vote totals.
- While voting is open, each player can change their vote and can submit one room-language question, with remaining prompt length and queued count shown.
- Host reveal displays aggregate votes and tie state. Host next round consumes queued custom prompts FIFO before built-ins.
- Do not use persistent storage for votes or room content.

**Tests to write first:**
- Host starts a room and sees a scannable join QR/code.
- Three phone-sized clients join and their names appear on the host screen.
- A phone can vote/change vote but sees no tally before host reveal.
- The host sees aggregate counts and a tie; voter identities never appear.
- A custom question submitted in one round becomes the next prompt.
- Switching a room to English updates all client UI/prompts; Italian remains the default.
- The mobile view works at 390px without horizontal overflow; shared-screen view works at 1280x800.

**Steps:**
- Write Playwright cases and confirm they fail before building the host/player views.
- Implement the smallest accessible UI to satisfy the flow, keeping the host display and phone voting layout distinct.
- Run `npm run test:e2e` after each interaction group, then check keyboard focus and reduced motion.

### Task 5: Containerize and document Caddy deployment

**Files:**
- Create: `Dockerfile` with build and runtime stages.
- Create: `docker-compose.yml` with a `game-server` service and required external Caddy network.
- Create: `deploy/Caddyfile` with `game.man.ovh { reverse_proxy game-server:3000 }`.
- Create: `deploy/README.md` with domain, network discovery, deploy, and verification instructions.

**Steps:**
- Configure Compose network as external and require `CADDY_NETWORK` at startup rather than guessing the current network name:

```yaml
networks:
  caddy:
    external: true
    name: ${CADDY_NETWORK:?Set CADDY_NETWORK to the existing Caddy network}
```

- Attach `game-server` only to that external network, set `NODE_ENV=production`, and use `restart: unless-stopped`.
- Keep the service internal to Docker (no host-published port required); Caddy proxies to `game-server:3000`.
- Document `docker network inspect` for confirming Caddy's network, `docker compose up -d --build`, and `docker compose logs -f game-server`.
- Document the required DNS A record `game.man.ovh` to `130.136.3.17` and additive Caddy configuration/reload steps.
- Do not edit the live Caddy configuration or deploy to the server without access and explicit authorization.

**Expected result:** A buildable standalone Docker service and exact Caddy integration instructions that require the operator to provide the confirmed Docker network name.

### Task 6: Run complete checks and review deployment readiness

**Files:**
- Modify only files needed to fix test or build failures.

**Steps:**
- Run `npm test`, `npm run test:e2e`, `npm run lint`, and `npm run build`.
- Build the Docker image locally and run the service on an isolated local Docker network; verify host and player clients can finish a round through Socket.IO.
- Confirm Caddy's real external Docker network and DNS before attempting deployment.
- Verify `/`, a room join URL, and the WebSocket handshake through a staging hostname or approved local Caddy route before production.

**Expected result:** All unit, integration, and browser tests pass; the production image serves the static client and realtime endpoint; deployment prerequisites that require access to the server are documented and not claimed complete.

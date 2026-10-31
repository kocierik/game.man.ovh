# Who Is Most Likely To? Game Design

## Goal

Create a separate real-time party game at `game.man.ovh`. One host displays a room on a shared screen; players join from their phones and vote on who best fits each prompt. The host controls when votes are revealed.

## Audience and success criteria

The game is for a group playing together in person. A host should be able to create a room and display its QR code and short code. Players should join quickly on mobile, submit one vote per round, and understand when voting is open or results are revealed. The shared screen should clearly show the prompt, room/player state, aggregate result, and a tie when applicable.

## Game flow

1. The host creates a room and chooses Italian or English; Italian is the default.
2. The shared screen shows a QR code and short room code.
3. Each participant joins from a phone, enters a display name, and selects themselves as a player. Duplicate names are disambiguated in the room.
4. The host starts a round. A prompt from the built-in bilingual question bank is shown to everyone.
5. Each player selects one player as the answer. A vote can be changed until the host reveals results. Votes and live tallies remain hidden before reveal.
6. The host reveals the aggregate votes. The shared screen shows counts and the top choice; tied leaders are shown as a tie. Individual voter choices are never displayed.
7. During a round, any player can submit a custom question in the room language. Accepted questions enter a first-in, first-out room queue.
8. When the host starts the next round, the oldest queued question is used before a built-in prompt. The host can keep advancing rounds without waiting for every player to vote.
9. The host ends the room when the group is done.

Rooms are ephemeral and held in server memory. No account, personal profile, or persistent player/vote history is required. Idle rooms expire automatically. Custom questions are scoped to one room and disappear when the room ends.

## Language and content

All interface copy and built-in prompts are available in Italian and English. The host chooses one language per room, and all connected clients use that room language. Prompts are playful and suitable for a general adult audience; avoid humiliating, discriminatory, or explicit content. Example prompts include who might become famous, go to prison first, or disappear during a vacation.

Players submit custom questions in the language selected for their room. A submission is plain text, trimmed, non-empty, and limited to 160 characters. The same submitted text is shown verbatim to all clients in that room; no automatic translation is attempted. Each player may submit at most one question per round to keep the queue manageable.

## Architecture

- Create a standalone project at `C:/Users/ekoci/components/projects/game.man.ovh`, separate from `erik.man.ovh`.
- React, Vite, and TypeScript provide the responsive browser client.
- A Node.js server using Socket.IO serves the built client and manages rooms, players, round state, votes, and host actions over a single realtime connection.
- The first version uses in-memory room state. Restarting the service ends active rooms; no database is introduced.
- Package the app as its own Docker Compose service. Caddy routes `game.man.ovh` to the game service over a Docker network shared with the existing Caddy container.
- Add an additive Caddy site block for `game.man.ovh`; never replace the existing `erik.man.ovh` or finance site blocks.

The name of the existing Caddy Docker network and the server's Compose layout are deployment inputs that must be confirmed from the host before finalizing a production Compose override. Do not guess or silently create a network Caddy cannot reach.

## Room protocol and validation

The server is authoritative for room membership, host privileges, phase changes, votes, prompt queue, and reveal. Room codes are randomly generated and checked for collision. Validate display names, question text, selected player IDs, room codes, and allowed state transitions on the server. A participant can have only one active vote per round; changes replace the previous vote. Only the host can start/reveal/advance/end. Disconnects remove the player from the live roster; reconnects with the same per-session token may rejoin while the room is active. No votes are sent to clients before reveal.

## Interface and accessibility

Provide two clear responsive roles: a shared host screen and a compact mobile voting screen. Make the room code and QR scannable from across a room. Players should select with large touch targets, receive a clear submitted/waiting state, and be able to change their vote before reveal. Use semantic labels, visible focus, sufficient contrast, and reduced-motion support. The host should be able to advance without requiring every player to vote.

## Deployment

Use a separate Docker Compose project/service and a dedicated host directory for `game.man.ovh`. Caddy reverse-proxies to the service on the shared Docker network and handles HTTPS for the hostname. Document the required DNS record, service port, Docker network attachment, Caddy block, restart policy, and environment variables. Do not modify the live server or existing Caddy configuration without server access and explicit authorization.

## Validation

- Unit-test room code generation, host authorization, vote replacement, reveal gating, tie calculation, and room expiry.
- Unit-test custom question validation, one-question-per-player-per-round limits, FIFO queue order, and room-language prompt selection.
- Integration-test host/player joins, custom prompt submission/use in the following round, and the complete round lifecycle through Socket.IO.
- Browser-test a host and multiple phone-sized clients joining one room, voting, changing a vote, host-only reveal, tie display, language selection, and a subsequent round.
- Check the built Vite client is served by the Node service and the WebSocket endpoint works through Caddy's reverse proxy.
- Test mobile layouts at 390px width and a shared-screen layout at desktop dimensions.

## Out of scope

No accounts, persistent database, persistent user-generated prompt library, public room directory, analytics, or access to the live Docker host/Caddy configuration is included without separate authorization.

import assert from "node:assert/strict";
import test from "node:test";
import { createRoomManager } from "../server/rooms.js";

const questions = [
  { it: "Domanda italiana uno?", en: "English question one?" },
  { it: "Domanda italiana due?", en: "English question two?" },
];

function createManager(options = {}) {
  return createRoomManager({ questionBank: questions, ...options });
}

test("creates a room with a host and joins players", () => {
  const rooms = createManager();
  const room = rooms.createRoom({ hostName: "Host", language: "it" });
  const player = rooms.joinRoom({ roomCode: room.roomCode, name: "Alex" });
  const duplicate = rooms.joinRoom({ roomCode: room.roomCode, name: "Alex" });

  assert.match(room.roomCode, /^[A-Z0-9]{6}$/);
  assert.notEqual(player.playerId, room.hostPlayerId);
  assert.ok(room.sessionToken);
  assert.notEqual(player.playerId, duplicate.playerId);
  assert.deepEqual(
    rooms.getPublicRoomState(room.roomCode).players.map((entry) => entry.name),
    ["Host", "Alex", "Alex (2)"],
  );
});

test("reconnects a player with the same room session token", () => {
  const rooms = createManager();
  const room = rooms.createRoom({ hostName: "Host", language: "it" });
  const player = rooms.joinRoom({ roomCode: room.roomCode, name: "Alex" });

  const reconnected = rooms.reconnectRoom({ roomCode: room.roomCode, sessionToken: player.sessionToken });
  assert.equal(reconnected.playerId, player.playerId);
});

test("removes a disconnected player from the live roster and restores them on reconnect", () => {
  const rooms = createManager();
  const room = rooms.createRoom({ hostName: "Host", language: "it" });
  const alex = rooms.joinRoom({ roomCode: room.roomCode, name: "Alex" });
  const sam = rooms.joinRoom({ roomCode: room.roomCode, name: "Sam" });
  rooms.startRound({ roomCode: room.roomCode, actorId: room.hostPlayerId });
  rooms.castVote({ roomCode: room.roomCode, playerId: sam.playerId, targetPlayerId: alex.playerId });

  rooms.disconnectPlayer({ roomCode: room.roomCode, playerId: sam.playerId });
  const disconnectedState = rooms.getPublicRoomState(room.roomCode);
  assert.equal(disconnectedState.players.some((player) => player.playerId === sam.playerId), false);
  assert.equal(disconnectedState.votedCount, 0);

  const reconnected = rooms.reconnectRoom({ roomCode: room.roomCode, sessionToken: sam.sessionToken });
  assert.equal(reconnected.playerId, sam.playerId);
  assert.equal(reconnected.publicState.players.some((player) => player.playerId === sam.playerId), true);
});

test("selects built-in prompts in the room language", () => {
  const rooms = createManager();
  const room = rooms.createRoom({ hostName: "Host", language: "it" });

  rooms.startRound({ roomCode: room.roomCode, actorId: room.hostPlayerId });

  assert.equal(rooms.getPublicRoomState(room.roomCode).currentPrompt.it, questions[0].it);
});

test("keeps votes private until host reveal and reports aggregate ties", () => {
  const rooms = createManager();
  const room = rooms.createRoom({ hostName: "Host", language: "it" });
  const alex = rooms.joinRoom({ roomCode: room.roomCode, name: "Alex" });
  const sam = rooms.joinRoom({ roomCode: room.roomCode, name: "Sam" });
  rooms.startRound({ roomCode: room.roomCode, actorId: room.hostPlayerId });

  rooms.castVote({ roomCode: room.roomCode, playerId: alex.playerId, targetPlayerId: sam.playerId });
  rooms.castVote({ roomCode: room.roomCode, playerId: sam.playerId, targetPlayerId: alex.playerId });

  const hidden = rooms.getPublicRoomState(room.roomCode);
  assert.equal(hidden.results, null);
  assert.equal(hidden.votedCount, 2);
  assert.equal("votes" in hidden, false);

  rooms.revealVotes({ roomCode: room.roomCode, actorId: room.hostPlayerId });
  const revealed = rooms.getPublicRoomState(room.roomCode);
  assert.deepEqual(revealed.results.winners.sort(), [alex.playerId, sam.playerId].sort());
  assert.equal(revealed.results.counts[alex.playerId], 1);
  assert.equal(revealed.results.counts[sam.playerId], 1);
});

test("only the host can advance the room", () => {
  const rooms = createManager();
  const room = rooms.createRoom({ hostName: "Host", language: "en" });
  const player = rooms.joinRoom({ roomCode: room.roomCode, name: "Alex" });

  assert.throws(
    () => rooms.startRound({ roomCode: room.roomCode, actorId: player.playerId }),
    /host/i,
  );
});

test("allows a player to change their vote but rejects self votes", () => {
  const rooms = createManager();
  const room = rooms.createRoom({ hostName: "Host", language: "en" });
  const alex = rooms.joinRoom({ roomCode: room.roomCode, name: "Alex" });
  const sam = rooms.joinRoom({ roomCode: room.roomCode, name: "Sam" });
  rooms.startRound({ roomCode: room.roomCode, actorId: room.hostPlayerId });

  rooms.castVote({ roomCode: room.roomCode, playerId: alex.playerId, targetPlayerId: sam.playerId });
  rooms.castVote({ roomCode: room.roomCode, playerId: alex.playerId, targetPlayerId: room.hostPlayerId });
  assert.throws(
    () => rooms.castVote({ roomCode: room.roomCode, playerId: alex.playerId, targetPlayerId: alex.playerId }),
    /themselves/i,
  );
  assert.equal(rooms.getPublicRoomState(room.roomCode).votedCount, 1);
});

test("uses submitted questions FIFO in the following rounds", () => {
  const rooms = createManager();
  const room = rooms.createRoom({ hostName: "Host", language: "en" });
  const alex = rooms.joinRoom({ roomCode: room.roomCode, name: "Alex" });
  const sam = rooms.joinRoom({ roomCode: room.roomCode, name: "Sam" });
  rooms.startRound({ roomCode: room.roomCode, actorId: room.hostPlayerId });

  assert.equal(rooms.submitQuestion({ roomCode: room.roomCode, playerId: alex.playerId, text: "  Custom prompt one?  " }).queuePosition, 1);
  assert.equal(rooms.submitQuestion({ roomCode: room.roomCode, playerId: sam.playerId, text: "Custom prompt two?" }).queuePosition, 2);
  assert.equal(rooms.getPublicRoomState(room.roomCode).currentPrompt.en, "English question one?");

  rooms.revealVotes({ roomCode: room.roomCode, actorId: room.hostPlayerId });
  rooms.nextRound({ roomCode: room.roomCode, actorId: room.hostPlayerId });
  assert.equal(rooms.getPublicRoomState(room.roomCode).currentPrompt.en, "Custom prompt one?");
  rooms.revealVotes({ roomCode: room.roomCode, actorId: room.hostPlayerId });
  rooms.nextRound({ roomCode: room.roomCode, actorId: room.hostPlayerId });
  assert.equal(rooms.getPublicRoomState(room.roomCode).currentPrompt.en, "Custom prompt two?");
});

test("validates custom question length and allows one submission per player per round", () => {
  const rooms = createManager();
  const room = rooms.createRoom({ hostName: "Host", language: "it" });
  const player = rooms.joinRoom({ roomCode: room.roomCode, name: "Alex" });
  rooms.startRound({ roomCode: room.roomCode, actorId: room.hostPlayerId });

  assert.throws(() => rooms.submitQuestion({ roomCode: room.roomCode, playerId: player.playerId, text: "   " }), /empty/i);
  assert.throws(() => rooms.submitQuestion({ roomCode: room.roomCode, playerId: player.playerId, text: "x".repeat(161) }), /160/i);
  rooms.submitQuestion({ roomCode: room.roomCode, playerId: player.playerId, text: "  Una domanda?  " });
  assert.throws(() => rooms.submitQuestion({ roomCode: room.roomCode, playerId: player.playerId, text: "Un'altra?" }), /already submitted/i);
});

test("expires inactive rooms", () => {
  let now = 0;
  const rooms = createManager({ roomTtlMs: 1_000, now: () => now });
  const room = rooms.createRoom({ hostName: "Host", language: "it" });

  now = 1_001;
  assert.equal(rooms.expireInactiveRooms(), 1);
  assert.throws(() => rooms.getPublicRoomState(room.roomCode), /not found/i);
});

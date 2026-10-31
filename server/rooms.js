import { randomBytes, randomInt, randomUUID } from "node:crypto";

const ROOM_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const ROOM_CODE_LENGTH = 6;
const MAX_NAME_LENGTH = 24;
const MAX_QUESTION_LENGTH = 160;
const SUPPORTED_LANGUAGES = new Set(["it", "en"]);

export function createRoomManager({ questionBank, roomTtlMs = 2 * 60 * 60 * 1000, now = Date.now }) {
  if (!Array.isArray(questionBank) || questionBank.length === 0) {
    throw new TypeError("A non-empty bilingual question bank is required");
  }

  const rooms = new Map();
  let nextQuestionIndex = 0;

  function createSessionToken() {
    return randomBytes(32).toString("base64url");
  }

  function createRoomCode() {
    let roomCode;
    do {
      roomCode = Array.from({ length: ROOM_CODE_LENGTH }, () =>
        ROOM_CODE_ALPHABET[randomInt(ROOM_CODE_ALPHABET.length)],
      ).join("");
    } while (rooms.has(roomCode));
    return roomCode;
  }

  function getRoom(roomCode) {
    const room = rooms.get(String(roomCode ?? "").trim().toUpperCase());
    if (!room) throw new Error("Room not found");
    return room;
  }

  function touch(room) {
    room.lastActivity = now();
  }

  function getPlayer(room, playerId) {
    const player = room.players.get(playerId);
    if (!player) throw new Error("Player not found in room");
    if (!player.connected) throw new Error("Player is not connected");
    return player;
  }

  function requireHost(room, actorId) {
    if (actorId !== room.hostPlayerId) throw new Error("Only the host can perform this action");
  }

  function requirePhase(room, phase) {
    if (room.phase !== phase) throw new Error(`Action is not allowed during ${room.phase}`);
  }

  function normalizeName(value) {
    const name = String(value ?? "").trim().replace(/\s+/g, " ");
    if (!name) throw new Error("Name cannot be empty");
    if (name.length > MAX_NAME_LENGTH) throw new Error(`Name cannot exceed ${MAX_NAME_LENGTH} characters`);
    return name;
  }

  function makeUniqueName(room, requestedName) {
    const existing = new Set([...room.players.values()].map((player) => player.name.toLocaleLowerCase()));
    if (!existing.has(requestedName.toLocaleLowerCase())) return requestedName;

    let suffix = 2;
    let name = `${requestedName} (${suffix})`;
    while (existing.has(name.toLocaleLowerCase())) name = `${requestedName} (${++suffix})`;
    return name;
  }

  function selectPrompt(room) {
    if (room.customQuestions.length > 0) {
      const customQuestion = room.customQuestions.shift();
      return { it: customQuestion.text, en: customQuestion.text, custom: true };
    }

    const question = questionBank[nextQuestionIndex % questionBank.length];
    nextQuestionIndex += 1;
    if (!question?.it || !question?.en) throw new Error("Question bank entries must include Italian and English text");
    return { it: question.it, en: question.en, custom: false };
  }

  function beginRound(room) {
    room.roundNumber += 1;
    room.phase = "voting";
    room.currentPrompt = selectPrompt(room);
    room.votes.clear();
    room.submittedByPlayers.clear();
    room.results = null;
    touch(room);
  }

  function getPublicRoomState(roomCode) {
    const room = getRoom(roomCode);
    return {
      roomCode: room.roomCode,
      language: room.language,
      hostPlayerId: room.hostPlayerId,
      phase: room.phase,
      roundNumber: room.roundNumber,
      players: [...room.players.values()].filter((player) => player.connected).map((player) => ({
        playerId: player.playerId,
        name: player.name,
        isHost: player.playerId === room.hostPlayerId,
        hasVoted: room.votes.has(player.playerId),
        hasSubmittedQuestion: room.submittedByPlayers.has(player.playerId),
      })),
      currentPrompt: room.currentPrompt ? { ...room.currentPrompt } : null,
      votedCount: room.votes.size,
      queuedQuestionCount: room.customQuestions.length,
      results: room.phase === "revealed" && room.results ? {
        counts: { ...room.results.counts },
        winners: [...room.results.winners],
        totalVotes: room.results.totalVotes,
      } : null,
    };
  }

  function createRoom({ hostName, language = "it" }) {
    if (!SUPPORTED_LANGUAGES.has(language)) throw new Error("Unsupported room language");

    const roomCode = createRoomCode();
    const hostPlayerId = randomUUID();
    const sessionToken = createSessionToken();
    const host = {
      playerId: hostPlayerId,
      sessionToken,
      name: normalizeName(hostName),
      connected: true,
    };

    const room = {
      roomCode,
      language,
      hostPlayerId,
      players: new Map([[hostPlayerId, host]]),
      sessionToPlayer: new Map([[sessionToken, hostPlayerId]]),
      phase: "lobby",
      roundNumber: 0,
      currentPrompt: null,
      votes: new Map(),
      results: null,
      customQuestions: [],
      submittedByPlayers: new Set(),
      lastActivity: now(),
    };

    rooms.set(roomCode, room);
    return { roomCode, hostPlayerId, sessionToken, publicState: getPublicRoomState(roomCode) };
  }

  function joinRoom({ roomCode, name }) {
    const room = getRoom(roomCode);
    if (room.phase === "ended") throw new Error("Room has ended");

    const playerId = randomUUID();
    const sessionToken = createSessionToken();
    const player = {
      playerId,
      sessionToken,
      name: makeUniqueName(room, normalizeName(name)),
      connected: true,
    };
    room.players.set(playerId, player);
    room.sessionToPlayer.set(sessionToken, playerId);
    touch(room);

    return { playerId, name: player.name, sessionToken, publicState: getPublicRoomState(roomCode) };
  }

  function reconnectRoom({ roomCode, sessionToken }) {
    const room = getRoom(roomCode);
    const playerId = room.sessionToPlayer.get(sessionToken);
    if (!playerId) throw new Error("Invalid room session token");
    const player = room.players.get(playerId);
    if (!player) throw new Error("Player not found in room");
    player.connected = true;
    touch(room);
    return {
      playerId,
      name: player.name,
      isHost: playerId === room.hostPlayerId,
      publicState: getPublicRoomState(roomCode),
    };
  }

  function disconnectPlayer({ roomCode, playerId }) {
    const room = getRoom(roomCode);
    const player = room.players.get(playerId);
    if (!player) return false;

    player.connected = false;
    room.votes.delete(playerId);
    for (const [voterId, targetPlayerId] of room.votes) {
      if (targetPlayerId === playerId) room.votes.delete(voterId);
    }
    touch(room);
    return true;
  }

  function startRound({ roomCode, actorId }) {
    const room = getRoom(roomCode);
    requireHost(room, actorId);
    requirePhase(room, "lobby");
    beginRound(room);
    return getPublicRoomState(roomCode);
  }

  function castVote({ roomCode, playerId, targetPlayerId }) {
    const room = getRoom(roomCode);
    requirePhase(room, "voting");
    getPlayer(room, playerId);
    getPlayer(room, targetPlayerId);
    if (playerId === targetPlayerId) throw new Error("Players cannot vote for themselves");
    room.votes.set(playerId, targetPlayerId);
    touch(room);
    return getPublicRoomState(roomCode);
  }

  function submitQuestion({ roomCode, playerId, text }) {
    const room = getRoom(roomCode);
    requirePhase(room, "voting");
    getPlayer(room, playerId);

    const questionText = String(text ?? "").trim();
    if (!questionText) throw new Error("Question cannot be empty");
    if (questionText.length > MAX_QUESTION_LENGTH) {
      throw new Error(`Question cannot exceed ${MAX_QUESTION_LENGTH} characters`);
    }
    if (room.submittedByPlayers.has(playerId)) throw new Error("Player has already submitted a question this round");

    room.customQuestions.push({ text: questionText, language: room.language, authorPlayerId: playerId });
    room.submittedByPlayers.add(playerId);
    touch(room);
    return { queuePosition: room.customQuestions.length, publicState: getPublicRoomState(roomCode) };
  }

  function revealVotes({ roomCode, actorId }) {
    const room = getRoom(roomCode);
    requireHost(room, actorId);
    requirePhase(room, "voting");

    const connectedPlayerIds = [...room.players.values()]
      .filter((player) => player.connected)
      .map((player) => player.playerId);
    const counts = Object.fromEntries(connectedPlayerIds.map((playerId) => [playerId, 0]));
    for (const targetPlayerId of room.votes.values()) counts[targetPlayerId] += 1;
    const highestCount = Math.max(0, ...Object.values(counts));
    const winners = highestCount === 0
      ? []
      : Object.entries(counts).filter(([, count]) => count === highestCount).map(([playerId]) => playerId);

    room.results = { counts, winners, totalVotes: room.votes.size };
    room.phase = "revealed";
    touch(room);
    return getPublicRoomState(roomCode);
  }

  function nextRound({ roomCode, actorId }) {
    const room = getRoom(roomCode);
    requireHost(room, actorId);
    requirePhase(room, "revealed");
    beginRound(room);
    return getPublicRoomState(roomCode);
  }

  function endRoom({ roomCode, actorId }) {
    const room = getRoom(roomCode);
    requireHost(room, actorId);
    rooms.delete(room.roomCode);
    return { roomCode: room.roomCode, ended: true };
  }

  function expireInactiveRooms() {
    const expiryTime = now() - roomTtlMs;
    let expiredCount = 0;
    for (const [roomCode, room] of rooms) {
      if (room.lastActivity <= expiryTime) {
        rooms.delete(roomCode);
        expiredCount += 1;
      }
    }
    return expiredCount;
  }

  return {
    createRoom,
    joinRoom,
    reconnectRoom,
    disconnectPlayer,
    submitQuestion,
    startRound,
    castVote,
    revealVotes,
    nextRound,
    endRoom,
    getPublicRoomState,
    expireInactiveRooms,
  };
}

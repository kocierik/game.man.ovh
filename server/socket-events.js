export function attachSocketHandlers(io, roomManager) {
  io.on("connection", (socket) => {
    function reply(acknowledge, payload) {
      if (typeof acknowledge === "function") acknowledge(payload);
    }

    function fail(error, acknowledge) {
      const payload = { ok: false, error: error instanceof Error ? error.message : "Unexpected error" };
      socket.emit("room:error", payload);
      reply(acknowledge, payload);
    }

    function broadcastRoom(roomCode) {
      const state = roomManager.getPublicRoomState(roomCode);
      io.to(roomCode).emit("room:state", state);
      return state;
    }

    function withRoomAction(acknowledge, operation) {
      try {
        const result = operation();
        reply(acknowledge, { ok: true, ...result });
      } catch (error) {
        fail(error, acknowledge);
      }
    }

    function rememberSession(roomCode, playerId, sessionToken) {
      socket.data.roomCode = roomCode;
      socket.data.playerId = playerId;
      socket.data.sessionToken = sessionToken;
      socket.join(roomCode);
    }

    function actor() {
      return { roomCode: socket.data.roomCode, actorId: socket.data.playerId };
    }

    socket.on("room:create", (payload = {}, acknowledge) => {
      withRoomAction(acknowledge, () => {
        const created = roomManager.createRoom(payload);
        rememberSession(created.roomCode, created.hostPlayerId, created.sessionToken);
        const state = broadcastRoom(created.roomCode);
        return {
          roomCode: created.roomCode,
          playerId: created.hostPlayerId,
          sessionToken: created.sessionToken,
          state,
        };
      });
    });

    socket.on("room:join", (payload = {}, acknowledge) => {
      withRoomAction(acknowledge, () => {
        const joined = roomManager.joinRoom(payload);
        rememberSession(payload.roomCode.trim().toUpperCase(), joined.playerId, joined.sessionToken);
        const state = broadcastRoom(socket.data.roomCode);
        return { roomCode: socket.data.roomCode, playerId: joined.playerId, name: joined.name, sessionToken: joined.sessionToken, state };
      });
    });

    socket.on("room:reconnect", (payload = {}, acknowledge) => {
      withRoomAction(acknowledge, () => {
        const reconnected = roomManager.reconnectRoom(payload);
        rememberSession(payload.roomCode.trim().toUpperCase(), reconnected.playerId, payload.sessionToken);
        const state = broadcastRoom(socket.data.roomCode);
        return { roomCode: socket.data.roomCode, playerId: reconnected.playerId, name: reconnected.name, isHost: reconnected.isHost, state };
      });
    });

    socket.on("room:state:get", (_payload = {}, acknowledge) => {
      withRoomAction(acknowledge, () => {
        if (!socket.data.roomCode || !socket.data.playerId) throw new Error("Join a room first");
        return { state: roomManager.getPublicRoomState(socket.data.roomCode) };
      });
    });

    socket.on("host:start", (_payload = {}, acknowledge) => {
      withRoomAction(acknowledge, () => {
        const { roomCode, actorId } = actor();
        roomManager.startRound({ roomCode, actorId });
        return { state: broadcastRoom(roomCode) };
      });
    });

    socket.on("vote:cast", (payload = {}, acknowledge) => {
      withRoomAction(acknowledge, () => {
        const { roomCode } = actor();
        roomManager.castVote({ roomCode, playerId: socket.data.playerId, targetPlayerId: payload.targetPlayerId });
        return { state: broadcastRoom(roomCode) };
      });
    });

    socket.on("question:submit", (payload = {}, acknowledge) => {
      withRoomAction(acknowledge, () => {
        const { roomCode } = actor();
        const result = roomManager.submitQuestion({ roomCode, playerId: socket.data.playerId, text: payload.text });
        return { queuePosition: result.queuePosition, state: broadcastRoom(roomCode) };
      });
    });

    socket.on("host:reveal", (_payload = {}, acknowledge) => {
      withRoomAction(acknowledge, () => {
        const { roomCode, actorId } = actor();
        roomManager.revealVotes({ roomCode, actorId });
        return { state: broadcastRoom(roomCode) };
      });
    });

    socket.on("host:next", (_payload = {}, acknowledge) => {
      withRoomAction(acknowledge, () => {
        const { roomCode, actorId } = actor();
        roomManager.nextRound({ roomCode, actorId });
        return { state: broadcastRoom(roomCode) };
      });
    });

    socket.on("host:end", (_payload = {}, acknowledge) => {
      withRoomAction(acknowledge, () => {
        const { roomCode, actorId } = actor();
        roomManager.endRoom({ roomCode, actorId });
        io.to(roomCode).emit("room:ended", { roomCode });
        io.in(roomCode).socketsLeave(roomCode);
        return { roomCode, ended: true };
      });
    });

    socket.on("disconnect", () => {
      if (!socket.data.roomCode || !socket.data.playerId) return;
      try {
        roomManager.disconnectPlayer({ roomCode: socket.data.roomCode, playerId: socket.data.playerId });
        broadcastRoom(socket.data.roomCode);
      } catch {
        // The room may already have ended or expired.
      }
    });
  });

  return io;
}

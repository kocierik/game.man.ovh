import express from "express";
import { createServer } from "node:http";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Server } from "socket.io";
import { createRoomManager } from "./rooms.js";
import { attachSocketHandlers } from "./socket-events.js";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const questionBank = JSON.parse(readFileSync(path.join(projectRoot, "shared", "questions.json"), "utf8"));

export function createGameServer({ questionBank: prompts = questionBank, roomTtlMs } = {}) {
  const app = express();
  const httpServer = createServer(app);
  const io = new Server(httpServer);
  const rooms = createRoomManager({ questionBank: prompts, roomTtlMs });
  const distDirectory = path.join(projectRoot, "dist");
  const indexFile = path.join(distDirectory, "index.html");

  app.use(express.static(distDirectory));
  app.get("/", (_request, response) => {
    if (!existsSync(indexFile)) return response.status(503).send("Client bundle is not built yet");
    return response.sendFile(indexFile);
  });
  app.get("/room/:roomCode/:view", (_request, response) => {
    if (!existsSync(indexFile)) return response.status(503).send("Client bundle is not built yet");
    return response.sendFile(indexFile);
  });

  attachSocketHandlers(io, rooms);

  const expiryTimer = setInterval(() => rooms.expireInactiveRooms(), 60_000);
  expiryTimer.unref();

  return {
    app,
    httpServer,
    io,
    rooms,
    listen(port = Number(process.env.PORT ?? 3001), host = "0.0.0.0") {
      return new Promise((resolve, reject) => {
        const onError = (error) => reject(error);
        httpServer.once("error", onError);
        httpServer.listen(port, host, () => {
          httpServer.off("error", onError);
          resolve(httpServer.address());
        });
      });
    },
    close() {
      clearInterval(expiryTimer);
      return new Promise((resolve) => io.close(() => resolve()));
    },
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const gameServer = createGameServer();
  const port = Number(process.env.PORT ?? 3001);
  gameServer.listen(port).then(() => {
    console.log(`Game server listening on port ${port}`);
  });
}

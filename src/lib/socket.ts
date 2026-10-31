import { io } from "socket.io-client";
import type { AckResult } from "./types";

export const socket = io({ autoConnect: false, reconnection: true });

export function connectSocket(): Promise<void> {
  if (socket.connected) return Promise.resolve();

  return new Promise((resolve, reject) => {
    const onConnect = () => {
      socket.off("connect_error", onError);
      resolve();
    };
    const onError = (error: Error) => {
      socket.off("connect", onConnect);
      reject(error);
    };

    socket.once("connect", onConnect);
    socket.once("connect_error", onError);
    socket.connect();
  });
}

export function emitAck(eventName: string, payload: Record<string, unknown> = {}): Promise<AckResult> {
  return new Promise((resolve, reject) => {
    socket.timeout(8_000).emit(eventName, payload, (error: Error | null, response: AckResult) => {
      if (error) reject(error);
      else resolve(response);
    });
  });
}

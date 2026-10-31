import { useEffect, useState } from "react";
import { CreateRoom } from "./components/CreateRoom";
import { HostScreen } from "./components/HostScreen";
import { JoinRoom } from "./components/JoinRoom";
import { PlayerScreen } from "./components/PlayerScreen";
import { connectSocket, emitAck, socket } from "./lib/socket";
import type { Language, RoomSession, RoomState } from "./lib/types";

const SESSION_KEY = "who-is-most-likely-room";

function readSession(): RoomSession | null {
  try {
    const value = sessionStorage.getItem(SESSION_KEY);
    return value ? JSON.parse(value) as RoomSession : null;
  } catch {
    return null;
  }
}

function routeTo(path: string, setPathname: (path: string) => void) {
  window.history.pushState({}, "", path);
  setPathname(window.location.pathname);
}

function getLanguageFromSearch(): Language {
  return new URLSearchParams(window.location.search).get("lang") === "en" ? "en" : "it";
}

export default function App() {
  const [pathname, setPathname] = useState(window.location.pathname);
  const [session, setSession] = useState<RoomSession | null>(readSession);
  const [roomState, setRoomState] = useState<RoomState | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const handlePopState = () => setPathname(window.location.pathname);
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  useEffect(() => {
    if (!session) return;
    const activeSession = session;
    let active = true;

    const handleRoomState = (state: RoomState) => {
      if (state.roomCode === activeSession.roomCode) setRoomState(state);
    };
    const handleRoomError = (payload: { error?: string }) => {
      if (active) setError(payload.error ?? "Room action failed");
    };
    const handleRoomEnded = () => {
      sessionStorage.removeItem(SESSION_KEY);
      setSession(null);
      setRoomState(null);
      setError("");
      routeTo("/", setPathname);
    };

    socket.on("room:state", handleRoomState);
    socket.on("room:error", handleRoomError);
    socket.on("room:ended", handleRoomEnded);

    async function reconnect() {
      try {
        await connectSocket();
        const response = await emitAck("room:reconnect", {
          roomCode: activeSession.roomCode,
          sessionToken: activeSession.sessionToken,
        });
        if (!response.ok) throw new Error(response.error ?? "Could not reconnect to room");
        if (response.state) setRoomState(response.state);
        setError("");
      } catch (reconnectError) {
        if (active) setError(reconnectError instanceof Error ? reconnectError.message : "Could not reconnect to room");
      }
    }

    void reconnect();
    return () => {
      active = false;
      socket.off("room:state", handleRoomState);
      socket.off("room:error", handleRoomError);
      socket.off("room:ended", handleRoomEnded);
      socket.disconnect();
    };
  }, [session]);

  async function createRoom(input: { hostName: string; language: Language }) {
    setError("");
    try {
      await connectSocket();
      const response = await emitAck("room:create", input);
      if (!response.ok || !response.roomCode || !response.playerId || !response.sessionToken || !response.state) {
        throw new Error(response.error ?? "Could not create room");
      }
      const newSession: RoomSession = {
        roomCode: response.roomCode,
        playerId: response.playerId,
        sessionToken: response.sessionToken,
        role: "host",
      };
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(newSession));
      setSession(newSession);
      setRoomState(response.state);
      routeTo(`/room/${response.roomCode}/host`, setPathname);
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Could not create room");
    }
  }

  async function joinRoom(input: { roomCode: string; name: string }) {
    setError("");
    try {
      await connectSocket();
      const response = await emitAck("room:join", input);
      if (!response.ok || !response.roomCode || !response.playerId || !response.sessionToken || !response.state) {
        throw new Error(response.error ?? "Could not join room");
      }
      const newSession: RoomSession = {
        roomCode: response.roomCode,
        playerId: response.playerId,
        sessionToken: response.sessionToken,
        role: "player",
      };
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(newSession));
      setSession(newSession);
      setRoomState(response.state);
      routeTo(`/room/${response.roomCode}/play`, setPathname);
    } catch (joinError) {
      setError(joinError instanceof Error ? joinError.message : "Could not join room");
    }
  }

  async function roomAction(eventName: string, payload: Record<string, unknown> = {}) {
    setError("");
    const response = await emitAck(eventName, payload);
    if (!response.ok) {
      const message = response.error ?? "Room action failed";
      setError(message);
      throw new Error(message);
    }
    if (response.state) setRoomState(response.state);
  }

  async function endRoom() {
    if (!window.confirm(roomState ? (roomState.language === "it" ? "Vuoi terminare questa stanza?" : "End this room?") : "End room?")) return;
    try {
      await roomAction("host:end");
      sessionStorage.removeItem(SESSION_KEY);
      setSession(null);
      setRoomState(null);
      routeTo("/", setPathname);
    } catch {
      // The room error is already displayed by roomAction.
    }
  }

  const routeMatch = pathname.match(/^\/room\/([A-Z0-9]{6})\/(host|join|play)$/i);
  if (!routeMatch) {
    return (
      <CreateRoom
        onCreate={createRoom}
        onJoinCode={({ roomCode, name, language }) => {
          routeTo(`/room/${roomCode}/join?lang=${language}&name=${encodeURIComponent(name)}`, setPathname);
        }}
        error={error}
      />
    );
  }

  const roomCode = routeMatch[1].toUpperCase();
  const view = routeMatch[2].toLowerCase();
  if (view === "join") {
    const query = new URLSearchParams(window.location.search);
    return (
      <JoinRoom
        roomCode={roomCode}
        language={getLanguageFromSearch()}
        initialName={query.get("name") ?? ""}
        error={error}
        onJoin={joinRoom}
      />
    );
  }

  if (!session || session.roomCode !== roomCode || !roomState) {
    return <main className="connecting-screen" role="status">{error || "Connecting to room…"}</main>;
  }

  if (view === "host" && session.role === "host") {
    return <HostScreen roomState={roomState} error={error} onAction={roomAction} onEnd={endRoom} />;
  }

  if (view === "play" && session.role === "player") {
    return <PlayerScreen roomState={roomState} playerId={session.playerId} error={error} onAction={roomAction} />;
  }

  return <main className="connecting-screen" role="alert">Room session does not match this view.</main>;
}

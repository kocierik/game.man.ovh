export type Language = "it" | "en";
export type RoomPhase = "lobby" | "voting" | "revealed";

export interface Prompt {
  it: string;
  en: string;
  custom: boolean;
}

export interface RoomPlayer {
  playerId: string;
  name: string;
  isHost: boolean;
  hasVoted: boolean;
  hasSubmittedQuestion: boolean;
}

export interface RoomResults {
  counts: Record<string, number>;
  winners: string[];
  totalVotes: number;
}

export interface RoomState {
  roomCode: string;
  language: Language;
  hostPlayerId: string;
  phase: RoomPhase;
  roundNumber: number;
  players: RoomPlayer[];
  currentPrompt: Prompt | null;
  votedCount: number;
  queuedQuestionCount: number;
  results: RoomResults | null;
}

export interface RoomSession {
  roomCode: string;
  playerId: string;
  sessionToken: string;
  role: "host" | "player";
}

export interface AckResult {
  ok: boolean;
  error?: string;
  roomCode?: string;
  playerId?: string;
  sessionToken?: string;
  name?: string;
  isHost?: boolean;
  queuePosition?: number;
  state?: RoomState;
  ended?: boolean;
}

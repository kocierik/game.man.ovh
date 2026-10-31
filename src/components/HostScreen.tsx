import { QRCodeSVG } from "qrcode.react";
import { PromptCard } from "./PromptCard";
import { QuestionComposer } from "./QuestionComposer";
import { t } from "../lib/i18n";
import type { RoomState } from "../lib/types";

type HostScreenProps = {
  roomState: RoomState;
  error: string;
  onAction: (eventName: string, payload?: Record<string, unknown>) => Promise<void>;
  onEnd: () => void;
};

export function HostScreen({ roomState, error, onAction, onEnd }: HostScreenProps) {
  const language = roomState.language;
  const copy = (key: Parameters<typeof t>[1]) => t(language, key);
  const joinUrl = `${window.location.origin}/room/${roomState.roomCode}/join?lang=${language}`;
  const namesById = new Map(roomState.players.map((player) => [player.playerId, player.name]));
  const results = roomState.results;

  return (
    <main className="game-room host-room">
      <header className="game-topbar room-topbar">
        <a className="game-wordmark" href="/" aria-label={copy("title")}>
          <span className="wordmark-mark" aria-hidden="true">W?</span>
          <span>WHO&apos;S MOST LIKELY?</span>
        </a>
        <div className="room-topbar-meta">
          <span>{copy("roomCode")}</span>
          <strong data-testid="room-code">{roomState.roomCode}</strong>
        </div>
        <button className="button button-quiet" type="button" onClick={onEnd}>{copy("endRoom")}</button>
      </header>

      <div className="host-layout">
        <section className={`host-stage phase-${roomState.phase}`}>
          {roomState.phase === "lobby" && (
            <div className="lobby-stage">
              <p className="eyebrow-label">{copy("shareCode")}</p>
              <h1>{copy("waiting")}</h1>
              <p className="stage-support">{copy("scanQr")}</p>
              <button className="button button-primary stage-action" type="button" onClick={() => void onAction("host:start")}>
                {copy("startRound")} <span aria-hidden="true">↗</span>
              </button>
            </div>
          )}

          {roomState.phase === "voting" && roomState.currentPrompt && (
            <div className="round-stage">
              <PromptCard prompt={roomState.currentPrompt} language={language} roundNumber={roomState.roundNumber} />
              <p className="voting-progress" data-testid="voting-progress">
                {roomState.votedCount === 0 ? copy("noVotes") : `${roomState.votedCount} ${copy("votes")}`}
                <span> / {roomState.players.length}</span>
              </p>
              <button className="button button-primary stage-action" type="button" onClick={() => void onAction("host:reveal")}>
                {copy("revealResults")} <span aria-hidden="true">↗</span>
              </button>
            </div>
          )}

          {roomState.phase === "revealed" && results && (
            <div className="result-stage">
              <PromptCard prompt={roomState.currentPrompt} language={language} roundNumber={roomState.roundNumber} />
              <section className="results-panel" data-testid="results-panel" aria-labelledby="results-title">
                <p className="eyebrow-label" id="results-title">{copy("results")}</p>
                {results.winners.length > 1 && <h2 className="tie-label">{copy("tie")}</h2>}
                <div className="result-list">
                  {Object.entries(results.counts)
                    .filter(([, count]) => count > 0)
                    .sort((left, right) => right[1] - left[1])
                    .map(([playerId, count]) => (
                      <div className={`result-row${results.winners.includes(playerId) ? " is-winner" : ""}`} key={playerId}>
                        <strong>{namesById.get(playerId) ?? "?"}</strong>
                        <span>{count} {copy("votes")}</span>
                      </div>
                    ))}
                </div>
                <button className="button button-primary stage-action" type="button" onClick={() => void onAction("host:next")}>
                  {copy("nextRound")} <span aria-hidden="true">→</span>
                </button>
              </section>
            </div>
          )}
        </section>

        <aside className="host-sidebar">
          <div className="qr-frame" data-testid="join-qr">
            <QRCodeSVG value={joinUrl} size={188} level="M" includeMargin />
          </div>
          <p className="eyebrow-label">{copy("scanQr")}</p>
          <p className="join-code-display" aria-label={`${copy("roomCode")} ${roomState.roomCode}`}>{roomState.roomCode}</p>
          <div className="roster-heading">
            <h2>{copy("players")}</h2>
            <span data-testid="player-count">{roomState.players.length}</span>
          </div>
          <ul className="player-roster">
            {roomState.players.map((player) => (
              <li key={player.playerId}>
                <span className="player-status-dot" aria-hidden="true" />
                <span>{player.name}</span>
                {player.isHost && <span className="host-tag">{copy("host")}</span>}
              </li>
            ))}
          </ul>
          {roomState.phase === "voting" && (
            <QuestionComposer
              language={language}
              queuedCount={roomState.queuedQuestionCount}
              disabled={roomState.players.find((player) => player.playerId === roomState.hostPlayerId)?.hasSubmittedQuestion}
              onSubmit={(text) => onAction("question:submit", { text })}
            />
          )}
          {error && <p className="form-error" role="alert">{error}</p>}
        </aside>
      </div>
    </main>
  );
}

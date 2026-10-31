import { useEffect, useState } from "react";
import { t } from "../lib/i18n";
import type { RoomState } from "../lib/types";
import { PromptCard } from "./PromptCard";
import { QuestionComposer } from "./QuestionComposer";

type PlayerScreenProps = {
  roomState: RoomState;
  playerId: string;
  error: string;
  onAction: (eventName: string, payload?: Record<string, unknown>) => Promise<void>;
};

export function PlayerScreen({ roomState, playerId, error, onAction }: PlayerScreenProps) {
  const language = roomState.language;
  const copy = (key: Parameters<typeof t>[1]) => t(language, key);
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const player = roomState.players.find((entry) => entry.playerId === playerId);

  useEffect(() => setSelectedPlayerId(null), [roomState.roundNumber]);

  async function castVote(targetPlayerId: string) {
    try {
      await onAction("vote:cast", { targetPlayerId });
      setSelectedPlayerId(targetPlayerId);
    } catch {
      setSelectedPlayerId(null);
    }
  }

  return (
    <main className="player-screen">
      <header className="player-topbar">
        <a className="game-wordmark" href="/" aria-label={copy("title")}>
          <span className="wordmark-mark" aria-hidden="true">W?</span>
          <span>WHO&apos;S MOST LIKELY?</span>
        </a>
        <span className="player-room-code">{roomState.roomCode}</span>
      </header>

      {roomState.phase === "lobby" && (
        <section className="player-waiting">
          <span className="waiting-mark" aria-hidden="true">…</span>
          <h1>{copy("waitingForHost")}</h1>
          <p>{player?.name}</p>
        </section>
      )}

      {roomState.phase !== "lobby" && roomState.currentPrompt && (
        <>
          <section className="player-round">
            <PromptCard prompt={roomState.currentPrompt} language={language} roundNumber={roomState.roundNumber} />
            {roomState.phase === "voting" && (
              <div className="vote-section">
                <p className="vote-question">{copy("choosePlayer")}</p>
                <div className="vote-options">
                  {roomState.players.filter((other) => other.playerId !== playerId).map((other) => (
                    <button
                      className={`vote-option${selectedPlayerId === other.playerId ? " is-selected" : ""}`}
                      type="button"
                      aria-pressed={selectedPlayerId === other.playerId}
                      key={other.playerId}
                      onClick={() => void castVote(other.playerId)}
                    >
                      <span>{other.name}</span><span className="vote-arrow" aria-hidden="true">↗</span>
                    </button>
                  ))}
                </div>
                {selectedPlayerId && <p className="vote-feedback" role="status">{copy("voteSaved")}</p>}
              </div>
            )}
            {roomState.phase === "revealed" && roomState.results && (
              <section className="results-panel player-results" data-testid="results-panel" aria-labelledby="player-results-title">
                <p className="eyebrow-label" id="player-results-title">{copy("results")}</p>
                {roomState.results.winners.length > 1 && <h2 className="tie-label">{copy("tie")}</h2>}
                <div className="result-list">
                  {Object.entries(roomState.results.counts)
                    .filter(([, count]) => count > 0)
                    .sort((left, right) => right[1] - left[1])
                    .map(([targetId, count]) => (
                      <div className={`result-row${roomState.results?.winners.includes(targetId) ? " is-winner" : ""}`} key={targetId}>
                        <strong>{roomState.players.find((entry) => entry.playerId === targetId)?.name ?? "?"}</strong>
                        <span>{count} {copy("votes")}</span>
                      </div>
                    ))}
                </div>
              </section>
            )}
          </section>

          {roomState.phase === "voting" && (
            <QuestionComposer
              language={language}
              queuedCount={roomState.queuedQuestionCount}
              disabled={player?.hasSubmittedQuestion}
              onSubmit={(text) => onAction("question:submit", { text })}
            />
          )}
        </>
      )}

      {error && <p className="form-error player-error" role="alert">{error}</p>}
    </main>
  );
}

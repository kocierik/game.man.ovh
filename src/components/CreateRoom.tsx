import { useState, type FormEvent } from "react";
import { t, type Language } from "../lib/i18n";

type CreateRoomProps = {
  onCreate: (input: { hostName: string; language: Language }) => Promise<void>;
  onJoinCode: (input: { roomCode: string; name: string; language: Language }) => void;
  error: string;
};

export function CreateRoom({ onCreate, onJoinCode, error }: CreateRoomProps) {
  const [name, setName] = useState("");
  const [language, setLanguage] = useState<Language>("it");
  const [roomCode, setRoomCode] = useState("");
  const copy = (key: Parameters<typeof t>[1]) => t(language, key);

  function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void onCreate({ hostName: name, language });
  }

  function handleJoin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onJoinCode({ roomCode: roomCode.trim().toUpperCase(), name, language });
  }

  return (
    <main className="landing-screen">
      <header className="game-topbar landing-topbar">
        <a className="game-wordmark" href="/" aria-label="Who Is Most Likely To home">
          <span className="wordmark-mark" aria-hidden="true">W?</span>
          <span>WHO&apos;S MOST LIKELY?</span>
        </a>
        <span className="topbar-note">{language === "it" ? "IL PARTY GAME DEL GRUPPO" : "THE GROUP PARTY GAME"}</span>
      </header>

      <section className="landing-content">
        <div className="landing-copy">
          <p className="eyebrow-label">{language === "it" ? "UN GIOCO DI SCELTE IMPOSSIBILI" : "A GAME OF IMPOSSIBLE CHOICES"}</p>
          <h1>{copy("title")}<span className="headline-mark">!</span></h1>
          <p className="landing-tagline">{copy("tagline")}</p>
          <div className="landing-stamps" aria-hidden="true">
            <span>01 — ASK</span><span>02 — VOTE</span><span>03 — REVEAL</span>
          </div>
        </div>

        <div className="landing-actions">
          <form className="create-form" onSubmit={handleCreate}>
            <label htmlFor="host-name">{copy("hostName")}</label>
            <input id="host-name" autoComplete="nickname" maxLength={24} required value={name} onChange={(event) => setName(event.target.value)} />
            <label htmlFor="room-language">{copy("roomLanguage")}</label>
            <select id="room-language" value={language} onChange={(event) => setLanguage(event.target.value as Language)}>
              <option value="it">{copy("italian")}</option>
              <option value="en">{copy("english")}</option>
            </select>
            <button className="button button-primary" type="submit">{copy("createRoom")} <span aria-hidden="true">↗</span></button>
          </form>

          <form className="join-code-form" onSubmit={handleJoin}>
            <label htmlFor="join-code">{copy("joinWithCode")}</label>
            <div className="join-code-row">
              <input id="join-code" autoComplete="off" maxLength={6} minLength={6} required value={roomCode} onChange={(event) => setRoomCode(event.target.value.toUpperCase())} placeholder="ABC123" />
              <button className="button button-secondary" type="submit" aria-label={copy("joinRoom")}>→</button>
            </div>
          </form>
          {error && <p className="form-error" role="alert">{error}</p>}
        </div>
      </section>

      <footer className="landing-footer">
        <span>game.man.ovh</span>
        <span>{language === "it" ? "FATTO PER GIOCARE INSIEME" : "MADE TO PLAY TOGETHER"}</span>
      </footer>
    </main>
  );
}

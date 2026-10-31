import { useState, type FormEvent } from "react";
import { t, type Language } from "../lib/i18n";

type JoinRoomProps = {
  roomCode: string;
  language: Language;
  initialName: string;
  error: string;
  onJoin: (input: { roomCode: string; name: string }) => Promise<void>;
};

export function JoinRoom({ roomCode, language, initialName, error, onJoin }: JoinRoomProps) {
  const [name, setName] = useState(initialName);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void onJoin({ roomCode, name });
  }

  return (
    <main className="join-screen">
      <p className="eyebrow-label">{t(language, "roomCode")}</p>
      <p className="join-room-code">{roomCode}</p>
      <h1>{t(language, "joinRoom")}</h1>
      <form className="join-form" onSubmit={handleSubmit}>
        <label htmlFor="player-name">{t(language, "hostName")}</label>
        <input id="player-name" autoComplete="nickname" maxLength={24} required value={name} onChange={(event) => setName(event.target.value)} />
        <button className="button button-primary" type="submit">{t(language, "joinRoom")} <span aria-hidden="true">↗</span></button>
      </form>
      {error && <p className="form-error" role="alert">{error}</p>}
    </main>
  );
}

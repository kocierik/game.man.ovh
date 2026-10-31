import { useState, type FormEvent } from "react";
import { t, type Language } from "../lib/i18n";

type QuestionComposerProps = {
  language: Language;
  queuedCount: number;
  disabled?: boolean;
  onSubmit: (text: string) => Promise<void>;
};

export function QuestionComposer({ language, queuedCount, disabled = false, onSubmit }: QuestionComposerProps) {
  const [text, setText] = useState("");
  const [status, setStatus] = useState("");
  const strings = t;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!text.trim() || disabled) return;

    try {
      await onSubmit(text);
      setText("");
      setStatus(strings(language, "questionQueued"));
    } catch (error) {
      setStatus(error instanceof Error ? error.message : strings(language, "error"));
    }
  }

  return (
    <form className="question-composer" onSubmit={handleSubmit}>
      <label htmlFor="custom-question">{strings(language, "submitQuestion")}</label>
      <textarea
        id="custom-question"
        maxLength={160}
        placeholder={strings(language, "questionPlaceholder")}
        value={text}
        onChange={(event) => setText(event.target.value)}
        disabled={disabled}
      />
      <div className="question-composer-footer">
        <span className="queue-count" data-testid="queued-count">{strings(language, "queueCount")}: {queuedCount}</span>
        <span className="character-count">{text.length}/160</span>
        <button type="submit" disabled={disabled || !text.trim()}>{strings(language, "sendQuestion")}</button>
      </div>
      {status && <p className="question-status" role="status">{status}</p>}
    </form>
  );
}

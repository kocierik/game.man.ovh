import type { Language, Prompt } from "../lib/types";
import { t } from "../lib/i18n";

type PromptCardProps = {
  prompt: Prompt | null;
  language: Language;
  roundNumber: number;
};

export function PromptCard({ prompt, language, roundNumber }: PromptCardProps) {
  return (
    <article className="prompt-stage" aria-live="polite">
      <p className="prompt-kicker">{t(language, "round")} {roundNumber.toString().padStart(2, "0")}</p>
      <h2 data-testid="current-prompt">{prompt?.[language] ?? "…"}</h2>
      {prompt?.custom && <span className="custom-prompt-label">{t(language, "communityPrompt")}</span>}
    </article>
  );
}

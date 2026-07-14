"use client";

import { FormEvent, KeyboardEvent, useRef, useState } from "react";

type Entry = {
  type: "noun" | "verb" | "adjective" | "phrase" | "other";
  word: string;
  translation: string;
  article: "der" | "die" | "das" | null;
  plural: string | null;
  gender: "maskulin" | "feminin" | "neutral" | null;
  infinitive: string | null;
  preterite: string | null;
  participle: string | null;
  auxiliary: "haben" | "sein" | null;
  comparative: string | null;
  superlative: string | null;
  government: string | null;
  examples: Array<{
    german: string;
    russian: string;
  }>;
};

type TranslationResult = {
  kind: "term" | "sentence";
  correctedInput: string | null;
  translation: string;
  explanation: string;
  entries: Entry[];
  sourceLanguage: "ru" | "de";
  targetLanguage: "ru" | "de";
  query: string;
};

export default function Home() {
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const requestInFlightRef = useRef(false);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<TranslationResult | null>(null);
  const hasCurrentTranslation = Boolean(result && text === result.query);

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      event.currentTarget.blur();
      event.currentTarget.form?.requestSubmit();
    }
  }

  async function requestTranslation(value: string) {
    const submittedText = value.trim();
    if (!submittedText || requestInFlightRef.current) return;

    requestInFlightRef.current = true;
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: submittedText })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Не удалось выполнить перевод.");
      setResult({ ...data, query: value });
    } catch (requestError) {
      setResult(null);
      setError(requestError instanceof Error ? requestError.message : "Неизвестная ошибка.");
    } finally {
      requestInFlightRef.current = false;
      setLoading(false);
    }
  }

  function translate(event: FormEvent) {
    event.preventDefault();
    inputRef.current?.blur();
    void requestTranslation(text);
  }

  function handlePrimaryAction() {
    if (hasCurrentTranslation) {
      setText("");
      setResult(null);
      setError("");
      if (inputRef.current) inputRef.current.style.height = "auto";
      return;
    }

    inputRef.current?.blur();
    void requestTranslation(text);
  }

  function translateWord(word: string) {
    if (requestInFlightRef.current) return;
    setText(word);
    requestAnimationFrame(() => {
      const input = inputRef.current;
      if (!input) return;
      input.style.height = "0px";
      input.style.height = `${Math.min(input.scrollHeight, 240)}px`;
    });
    void requestTranslation(word);
  }

  return (
    <main className="shell">
      <header className="topbar">
        <span className="wordmark" aria-label="Wortklar">
          <span>wort</span><strong>klar</strong><i />
        </span>
      </header>

      <div className="workspace">
        <form className="composer" onSubmit={translate}>
          <div className="inputRow">
            <textarea
              ref={inputRef}
              value={text}
              onChange={(event) => {
                setText(event.target.value);
                event.target.style.height = "0px";
                event.target.style.height = `${Math.min(event.target.scrollHeight, 240)}px`;
              }}
              onKeyDown={handleKeyDown}
              placeholder="Слово или фраза"
              maxLength={1200}
              rows={1}
            />
            <button
              className={`submitButton${hasCurrentTranslation ? " clear" : ""}`}
              type="button"
              disabled={!text.trim() || loading}
              aria-label={hasCurrentTranslation ? "Очистить" : "Перевести"}
              onClick={handlePrimaryAction}
              onTouchEnd={(event) => {
                event.preventDefault();
                handlePrimaryAction();
              }}
            >
              {loading ? <span className="loader" /> : hasCurrentTranslation ? <CloseIcon /> : <ArrowIcon />}
            </button>
          </div>
        </form>

        {error && <p className="errorMessage">{error}</p>}

        {result && (
          <section className="results" aria-live="polite">
            <div className="answer">
              <p className="answerWord" lang={result.targetLanguage}>
                {result.kind === "sentence" ? (
                  <ClickableText text={result.translation} onWord={translateWord} disabled={loading} />
                ) : (
                  <AnswerText value={result.translation} entry={result.entries[0]} targetLanguage={result.targetLanguage} />
                )}
              </p>
              {result.correctedInput && result.correctedInput.trim() !== result.query.trim() && (
                <p className="correction">
                  <s>{result.query}</s><i>→</i><span>{result.correctedInput}</span>
                </p>
              )}
              {result.kind === "term" && result.entries.length === 1 && result.entries[0]?.type === "noun" && (
                <NounMeta entry={result.entries[0]} showHeadword={result.targetLanguage !== "de"} />
              )}
              {result.explanation && !sameText(result.explanation, result.translation) && (
                <span lang="ru">{result.explanation}</span>
              )}
            </div>

            {result.kind === "term" && result.entries.length > 0 && (
              <div className={`entries${result.entries.length === 1 ? " single" : ""}`}>
                {result.entries.map((entry, index) => (
                  <EntryView
                    entry={entry}
                    answer={result.translation}
                    query={result.query}
                    showMeaning={result.entries.length > 1}
                    showSeparator={index > 0}
                    onWord={translateWord}
                    disabled={loading}
                    key={`${entry.word}-${index}`}
                  />
                ))}
              </div>
            )}
          </section>
        )}
      </div>

    </main>
  );
}

function EntryView({ entry, answer, query, showMeaning, showSeparator, onWord, disabled }: {
  entry: Entry;
  answer: string;
  query: string;
  showMeaning: boolean;
  showSeparator: boolean;
  onWord: (word: string) => void;
  disabled: boolean;
}) {
  const term = entry.type === "noun" && entry.article ? `${entry.article} ${entry.word}` : entry.word;
  const queryRepeatsTerm = sameText(query, term) || (entry.type !== "noun" && sameText(query, entry.word));
  const showTerm = !containsText(answer, term) && !queryRepeatsTerm;
  const showTranslation = showMeaning && !containsText(answer, entry.translation) && !sameText(query, entry.translation);
  const forms = morphologyForms(entry);

  return (
    <article className={`entry${showSeparator ? " separated" : ""}`}>
      {showMeaning && showTerm && (
        <div className="term" lang="de">
          {entry.type === "noun" && entry.article && (
            <span className={`article ${genderClass(entry.article)}`}>{entry.article}</span>
          )}
          <strong>{entry.word}</strong>
        </div>
      )}

      {showTranslation && <p className="entryTranslation" lang="ru">{entry.translation}</p>}

      {forms.length > 0 && (
        <p className="morphology" lang="de">
          {forms.map((form, index) => (
            <span key={form}>
              {index > 0 && <i>·</i>}
              {form}
            </span>
          ))}
        </p>
      )}

      {entry.government && (
        <p className="government" lang="de">{entry.government}</p>
      )}

      {entry.examples.length > 0 && (
        <div className="examples">
          {entry.examples.map((example, index) => (
            <div className="example" key={`${example.german}-${index}`}>
              <p lang="de"><ClickableText text={example.german} onWord={onWord} disabled={disabled} /></p>
              <span lang="ru"><ClickableText text={example.russian} onWord={onWord} disabled={disabled} /></span>
            </div>
          ))}
        </div>
      )}
    </article>
  );
}

function morphologyForms(entry: Entry) {
  if (entry.type === "verb") {
    return [
      entry.infinitive ?? entry.word,
      entry.preterite,
      entry.participle ? `${entry.auxiliary === "sein" ? "ist" : "hat"} ${entry.participle}` : null
    ].filter((item): item is string => Boolean(item));
  }

  if (entry.type === "adjective") {
    return [
      entry.word,
      entry.comparative,
      entry.superlative
    ].filter((item): item is string => Boolean(item));
  }

  return [];
}

function cleanText(value: string | null | undefined) {
  return (value ?? "").toLocaleLowerCase("de-DE").replace(/[.,!?;:()[\]{}„“\"'’]/g, "").replace(/\s+/g, " ").trim();
}

function sameText(first: string | null | undefined, second: string | null | undefined) {
  const a = cleanText(first);
  const b = cleanText(second);
  return Boolean(a && b && a === b);
}

function containsText(container: string | null | undefined, value: string | null | undefined) {
  const a = cleanText(container);
  const b = cleanText(value);
  return Boolean(a && b && (a === b || a.includes(b)));
}

function genderClass(article: "der" | "die" | "das") {
  return article === "der" ? "masculine" : article === "die" ? "feminine" : "neutral";
}

function AnswerText({ value, entry, targetLanguage }: {
  value: string;
  entry?: Entry;
  targetLanguage: "ru" | "de";
}) {
  if (targetLanguage === "ru") {
    return value.replace(/^(der|die|das)\s+(?=[А-Яа-яЁё])/i, "");
  }

  if (targetLanguage === "de" && entry?.type === "noun" && entry.article) {
    const hasArticle = /^(der|die|das)\s+/i.test(value);
    const noun = hasArticle ? value : `${entry.article} ${value}`;
    return <span className={`answerGender ${genderClass(entry.article)}`}>{noun}</span>;
  }

  return value;
}

function NounMeta({ entry, showHeadword }: { entry: Entry; showHeadword: boolean }) {
  if (!entry.article && !entry.plural) return null;
  const plural = entry.plural?.replace(/^die\s+/i, "");

  return (
    <p className="nounMeta" lang="de">
      {showHeadword && entry.article && (
        <span className={genderClass(entry.article)}>{entry.article} {entry.word}</span>
      )}
      {showHeadword && entry.article && plural && <i>·</i>}
      {plural && <span>die {plural}</span>}
    </p>
  );
}

function ClickableText({ text, onWord, disabled }: {
  text: string;
  onWord: (word: string) => void;
  disabled: boolean;
}) {
  const parts = text.split(/(\p{L}[\p{L}\p{M}]*(?:[’'-][\p{L}\p{M}]+)*)/gu);

  return parts.map((part, index) => {
    if (!/^\p{L}/u.test(part)) return part;

    return (
      <button
        className="wordToken"
        type="button"
        disabled={disabled}
        onClick={() => onWord(part)}
        onTouchEnd={(event) => {
          event.preventDefault();
          onWord(part);
        }}
        key={`${part}-${index}`}
      >
        {part}
      </button>
    );
  });
}

function ArrowIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h13M13 7l5 5-5 5" /></svg>;
}

function CloseIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 7l10 10M17 7L7 17" /></svg>;
}

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
  government: Array<{
    pattern: string;
    case: "Akkusativ" | "Dativ" | "Genitiv" | null;
    meaning: string;
  }>;
  grammarNotes: Array<{
    label: string;
    value: string;
  }>;
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
  const primaryEntry = result?.entries[0];
  const hasSourceDetails = Boolean(
    result?.kind === "term" &&
    result.sourceLanguage === "de" &&
    primaryEntry &&
    (primaryEntry.type === "noun" || morphologyForms(primaryEntry).length > 0)
  );

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
          <section className={`results${hasSourceDetails ? " sourceDetails" : ""}`} aria-live="polite">
            {hasSourceDetails && primaryEntry && (
              <div className="sourceLexemeDetails">
                {primaryEntry.type === "noun" ? (
                  <NounMeta entry={primaryEntry} showHeadword />
                ) : (
                  <Morphology entry={primaryEntry} />
                )}
              </div>
            )}

            <div className="answer">
              <p className="answerWord" lang={result.targetLanguage}>
                {result.kind === "sentence" ? (
                  <ClickableText text={result.translation} onWord={translateWord} disabled={loading} />
                ) : (
                  <AnswerText value={result.translation} entry={result.entries[0]} targetLanguage={result.targetLanguage} />
                )}
              </p>
              <AlternativeMeanings
                entries={result.entries}
                targetLanguage={result.targetLanguage}
                query={result.query}
              />
              {result.kind === "term" && result.sourceLanguage !== "de" && primaryEntry && (
                <Morphology entry={primaryEntry} />
              )}
              {result.correctedInput && result.correctedInput.trim() !== result.query.trim() && (
                <p className="correction">
                  <s>{result.query}</s><i>→</i><span>{result.correctedInput}</span>
                </p>
              )}
              {result.kind === "term" && result.targetLanguage === "de" && primaryEntry?.type === "noun" && (
                <NounMeta entry={primaryEntry} showHeadword={false} />
              )}
            </div>

            {result.kind === "term" && result.entries.length > 0 && (
              <div className={`entries ${result.entries.length === 1 ? "single" : "multiple"}`}>
                {result.entries.map((entry, index) => (
                  <EntryView
                    entry={entry}
                    onWord={translateWord}
                    disabled={loading}
                    key={`${entry.word}-${index}`}
                  />
                ))}
              </div>
            )}

            {result.kind === "term" && <GrammarDisclosure entries={result.entries} />}
          </section>
        )}
      </div>

    </main>
  );
}

function EntryView({ entry, onWord, disabled }: {
  entry: Entry;
  onWord: (word: string) => void;
  disabled: boolean;
}) {
  return (
    <article className="entry">
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

function Morphology({ entry }: { entry: Entry }) {
  const forms = morphologyForms(entry);
  if (forms.length === 0) return null;

  return (
    <p className="morphology" lang="de">
      {forms.map((form, index) => (
        <span key={form}>
          {index > 0 && <i>·</i>}
          {form}
        </span>
      ))}
    </p>
  );
}

function GovernmentOverview({ entries }: { entries: Entry[] }) {
  const rules = entries.flatMap((entry) => entry.government);
  const uniqueRules = rules.filter((rule, index) => (
    rules.findIndex((candidate) => (
      candidate.pattern === rule.pattern &&
      candidate.case === rule.case &&
      candidate.meaning === rule.meaning
    )) === index
  ));

  if (uniqueRules.length === 0) return null;

  return (
    <div className="governmentList">
      {uniqueRules.map((rule, index) => (
        <div className="governmentRule" key={`${rule.pattern}-${index}`}>
          <span lang="de">{rule.pattern}</span>
          {rule.case && <small>{caseLabel(rule.case)}</small>}
          <i>—</i>
          <span lang="ru">{rule.meaning}</span>
        </div>
      ))}
    </div>
  );
}

function GrammarDisclosure({ entries }: { entries: Entry[] }) {
  const notes = entries.flatMap((entry) => entry.grammarNotes);
  const uniqueNotes = notes.filter((note, index) => (
    notes.findIndex((candidate) => (
      candidate.label === note.label && candidate.value === note.value
    )) === index
  ));
  const hasGovernment = entries.some((entry) => entry.government.length > 0);

  if (uniqueNotes.length === 0 && !hasGovernment) return null;

  return (
    <details className="grammarDisclosure">
      <summary aria-label="Грамматика" title="Грамматика">
        <QuestionIcon />
      </summary>
      <div className="grammarContent">
        {uniqueNotes.length > 0 && (
          <dl className="grammarNotes">
            {uniqueNotes.map((note, index) => (
              <div className="grammarNote" key={`${note.label}-${note.value}-${index}`}>
                <dt>{note.label}</dt>
                <dd>{note.value}</dd>
              </div>
            ))}
          </dl>
        )}
        {hasGovernment && <GovernmentOverview entries={entries} />}
      </div>
    </details>
  );
}

function AlternativeMeanings({ entries, targetLanguage, query }: {
  entries: Entry[];
  targetLanguage: "ru" | "de";
  query: string;
}) {
  const alternatives = entries.slice(1);
  if (alternatives.length === 0) return null;

  return (
    <p className="alternativeMeanings" lang={targetLanguage}>
      {alternatives.map((entry, index) => {
        const mainLexeme = entries[0]?.infinitive ?? entries[0]?.word;
        const entryLexeme = entry.infinitive ?? entry.word;
        const germanTerm = entry.type === "noun" && entry.article
          ? `${entry.article} ${entry.word}`
          : entryLexeme;
        const label = targetLanguage === "ru"
          ? addQualifier(entry.translation, sameText(entryLexeme, mainLexeme) ? null : entryLexeme)
          : germanTerm;
        const qualifier = targetLanguage === "de" && !sameText(entry.translation, query)
          ? entry.translation
          : null;

        return (
          <span className="alternativeMeaning" key={`${entry.word}-${entry.translation}-${index}`}>
            <span className={targetLanguage === "de" && entry.article ? genderClass(entry.article) : undefined}>
              {label}
            </span>
            {qualifier && <small> ({qualifier})</small>}
          </span>
        );
      })}
    </p>
  );
}

function addQualifier(value: string, qualifier: string | null) {
  if (!qualifier) return value;
  return value.trim().endsWith(")")
    ? value.trim().replace(/\)$/, `; ${qualifier})`)
    : `${value.trim()} (${qualifier})`;
}

function caseLabel(value: "Akkusativ" | "Dativ" | "Genitiv") {
  if (value === "Akkusativ") return "Akk. (винительный)";
  if (value === "Dativ") return "Dat. (дательный)";
  return "Gen. (родительный)";
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

function QuestionIcon() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <circle cx="8" cy="8" r="6.25" />
      <path d="M6.35 6.25a1.75 1.75 0 0 1 3.4.58c0 1.42-1.75 1.55-1.75 2.7M8 11.8h.01" />
    </svg>
  );
}

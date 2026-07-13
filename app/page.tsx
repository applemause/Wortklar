"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type Direction = "ru-de" | "de-ru";
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
  note: string | null;
  example: string;
  exampleTranslation: string;
};

type TranslationResult = {
  translation: string;
  explanation: string;
  entries: Entry[];
};

const STORAGE_KEY = "wortklar-settings";

export default function Home() {
  const [direction, setDirection] = useState<Direction>("ru-de");
  const [text, setText] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState("gpt-5.6-luna");
  const [rememberKey, setRememberKey] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<TranslationResult | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return;
    try {
      const settings = JSON.parse(saved) as { apiKey?: string; model?: string; rememberKey?: boolean };
      setApiKey(settings.apiKey ?? "");
      setModel(settings.model ?? "gpt-5.6-luna");
      setRememberKey(settings.rememberKey ?? true);
    } catch {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  const labels = useMemo(
    () =>
      direction === "ru-de"
        ? { from: "Русский", to: "Deutsch", placeholder: "Напишите слово или фразу по-русски…" }
        : { from: "Deutsch", to: "Русский", placeholder: "Schreib ein Wort oder einen Satz…" },
    [direction]
  );

  function saveSettings() {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ apiKey: rememberKey ? apiKey.trim() : "", model: model.trim(), rememberKey })
    );
    setSettingsOpen(false);
  }

  function swapDirection() {
    setDirection((current) => (current === "ru-de" ? "de-ru" : "ru-de"));
    setResult(null);
    setError("");
  }

  async function translate(event: FormEvent) {
    event.preventDefault();
    if (!text.trim()) return;
    if (!apiKey.trim()) {
      setSettingsOpen(true);
      setError("Добавьте API-ключ в настройках.");
      return;
    }

    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: text.trim(), direction, apiKey: apiKey.trim(), model: model.trim() })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Не удалось выполнить перевод.");
      setResult(data);
    } catch (requestError) {
      setResult(null);
      setError(requestError instanceof Error ? requestError.message : "Неизвестная ошибка.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="shell">
      <header className="topbar">
        <a className="brand" href="#" aria-label="Wortklar, главная">Wort<span>klar</span></a>
        <button className="gearButton" type="button" onClick={() => setSettingsOpen(true)} aria-label="Настройки">⚙</button>
      </header>

      <section className="hero">
        <p className="eyebrow">Переводчик, который объясняет</p>
        <h1>Понимай немецкий,<br />а не просто переводи.</h1>
        <p className="intro">Перевод, формы слов, род существительных и живые примеры — спокойно и без лишнего шума.</p>
      </section>

      <form className="translator" onSubmit={translate}>
        <div className="languageBar">
          <span>{labels.from}</span>
          <button className="swapButton" type="button" onClick={swapDirection} aria-label="Поменять языки местами">⇄</button>
          <span>{labels.to}</span>
        </div>
        <textarea value={text} onChange={(event) => setText(event.target.value)} placeholder={labels.placeholder} maxLength={1200} autoFocus />
        <div className="inputFooter">
          <span>{text.length} / 1200</span>
          <button className="primaryButton" type="submit" disabled={!text.trim() || loading}>{loading ? "Разбираю…" : "Перевести и разобрать"}</button>
        </div>
      </form>

      {error && <p className="errorMessage">{error}</p>}

      {result && (
        <section className="results" aria-live="polite">
          <div className="translationHero">
            <small>Перевод</small>
            <p>{result.translation}</p>
            {result.explanation && <span>{result.explanation}</span>}
          </div>

          {result.entries.map((entry, index) => (
            <article className="resultCard" key={`${entry.word}-${index}`}>
              <div className="cardTopline"><span className="kind">{typeLabel(entry.type)}</span></div>

              {entry.type === "noun" && entry.article ? (
                <div className="wordLine">
                  <span className={`article ${genderClass(entry.article)}`}>{entry.article}</span>
                  <strong>{entry.word}</strong>
                </div>
              ) : <strong className="mainWord">{entry.word}</strong>}

              <p className="translation">{entry.translation}</p>

              {entry.type === "noun" && (
                <div className="facts">
                  <span><small>Род</small>{entry.gender ?? "—"}</span>
                  <span><small>Множественное число</small>{entry.plural ?? "—"}</span>
                </div>
              )}

              {entry.type === "verb" && (
                <div className="verbForms">
                  <span><small>Infinitiv</small>{entry.infinitive ?? entry.word}</span>
                  <span><small>Präteritum</small>{entry.preterite ?? "—"}</span>
                  <span><small>Partizip II</small>{entry.participle ?? "—"}</span>
                  <span><small>Perfekt с</small>{entry.auxiliary ?? "—"}</span>
                </div>
              )}

              {entry.type === "adjective" && (
                <div className="facts">
                  <span><small>Komparativ</small>{entry.comparative ?? "—"}</span>
                  <span><small>Superlativ</small>{entry.superlative ?? "—"}</span>
                </div>
              )}

              {entry.government && <p className="government">Управление: <strong>{entry.government}</strong></p>}
              {entry.note && <p className="note">{entry.note}</p>}
              <div className="exampleBlock">
                <p>{entry.example}</p>
                <span>{entry.exampleTranslation}</span>
              </div>
            </article>
          ))}
        </section>
      )}

      {!result && !loading && (
        <section className="emptyState">
          <p>Введите слово или фразу. Wortklar покажет перевод и разложит немецкий по полочкам.</p>
        </section>
      )}

      <footer><span>Wortklar</span><p>Сделано для тех, кто действительно учит язык.</p></footer>

      {settingsOpen && (
        <div className="modalBackdrop" onMouseDown={() => setSettingsOpen(false)}>
          <section className="settingsModal" onMouseDown={(event) => event.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="settings-title">
            <div className="modalHeader">
              <div><small>Настройки</small><h2 id="settings-title">Подключение API</h2></div>
              <button type="button" className="closeButton" onClick={() => setSettingsOpen(false)}>×</button>
            </div>
            <label className="fieldLabel">OpenAI API key
              <input type="password" value={apiKey} onChange={(event) => setApiKey(event.target.value)} placeholder="sk-…" autoComplete="off" />
            </label>
            <p className="fieldHint">Ключ передаётся только вашему серверному маршруту и OpenAI. В репозиторий он не попадает.</p>
            <label className="fieldLabel">Модель
              <select value={model} onChange={(event) => setModel(event.target.value)}>
                <option value="gpt-5.6-luna">GPT-5.6 Luna — экономно</option>
                <option value="gpt-5.6-terra">GPT-5.6 Terra — точнее</option>
                <option value="gpt-5.6">GPT-5.6 Sol — максимум качества</option>
              </select>
            </label>
            <label className="checkLabel"><input type="checkbox" checked={rememberKey} onChange={(event) => setRememberKey(event.target.checked)} />Сохранить ключ в этом браузере</label>
            <button className="primaryButton modalSave" type="button" onClick={saveSettings}>Сохранить</button>
          </section>
        </div>
      )}
    </main>
  );
}

function typeLabel(type: Entry["type"]) {
  return ({ noun: "Существительное", verb: "Глагол", adjective: "Прилагательное", phrase: "Фраза", other: "Разбор" })[type];
}

function genderClass(article: "der" | "die" | "das") {
  return article === "der" ? "masculine" : article === "die" ? "feminine" : "neutral";
}

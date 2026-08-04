import { useMemo, useState } from "react";
import "./App.css";
import { CopyButton } from "./components/CopyButton";
import { PlatformRow } from "./components/PlatformRow";
import { SettingsPanel } from "./components/SettingsPanel";
import { loadSettings, saveSettings, Settings } from "./lib/storage";
import { tmdbSearch, TmdbResult } from "./lib/tmdb";
import { postToBluesky } from "./lib/bluesky";
import {
  ReviewInput,
  ratingTag,
  ratingStars,
  findEmDashes,
  blueskyCaption,
  ghostBody,
  notionSummary,
  letterboxdReviewText,
  letterboxdSearchUrl,
  imdbSearchUrl,
  rottenTomatoesSearchUrl,
  parseImportBlock,
} from "./lib/format";

const RATING_OPTIONS = Array.from({ length: 10 }, (_, i) => 0.5 * (i + 1));

export default function App() {
  const [settings, setSettings] = useState<Settings>(loadSettings());
  const [showSettings, setShowSettings] = useState(false);

  const [title, setTitle] = useState("");
  const [year, setYear] = useState("");
  const [haikuLines, setHaikuLines] = useState<[string, string, string]>(["", "", ""]);
  const [rating, setRating] = useState(4.0);
  const [notes, setNotes] = useState("");

  const [posterUrl, setPosterUrl] = useState<string | null>(null);
  const [tmdbMeta, setTmdbMeta] = useState<TmdbResult | null>(null);
  const [tmdbError, setTmdbError] = useState<string | null>(null);
  const [lookingUp, setLookingUp] = useState(false);

  const [showImdb, setShowImdb] = useState(false);
  const [showRT, setShowRT] = useState(false);

  const [showImport, setShowImport] = useState(false);
  const [importText, setImportText] = useState("");
  const [importError, setImportError] = useState<string | null>(null);

  const [blueskyStatus, setBlueskyStatus] = useState<
    { state: "idle" } | { state: "posting" } | { state: "posted"; url: string } | { state: "error"; message: string }
  >({ state: "idle" });

  function updateSettings(next: Settings) {
    setSettings(next);
    saveSettings(next);
  }

  function setLine(i: number, value: string) {
    setHaikuLines((prev) => {
      const copy = [...prev] as [string, string, string];
      copy[i] = value;
      return copy;
    });
  }

  async function runLookup() {
    if (!title.trim()) return;
    if (!settings.tmdbKey) {
      setTmdbError("Add a TMDB API key in settings first.");
      return;
    }
    setLookingUp(true);
    setTmdbError(null);
    const result = await tmdbSearch(settings.tmdbKey, title.trim(), year.trim());
    setLookingUp(false);
    if ("error" in result) {
      setTmdbError(result.error);
      setTmdbMeta(null);
      return;
    }
    setTmdbMeta(result);
    setPosterUrl(result.posterUrl);
    if (!year && result.releaseYear) setYear(result.releaseYear);
  }

  const input: ReviewInput = useMemo(
    () => ({ title, year, haikuLines, rating, notes, posterUrl }),
    [title, year, haikuLines, rating, notes, posterUrl]
  );

  const emDashFields: string[] = useMemo(() => {
    const flagged: string[] = [];
    if (haikuLines.some(findEmDashes)) flagged.push("haiku");
    if (findEmDashes(notes)) flagged.push("extended notes");
    return flagged;
  }, [haikuLines, notes]);

  const readyForPlatforms = title.trim() && haikuLines.every((l) => l.trim());

  const blueskyText = blueskyCaption(input);
  const blueskyOverLimit = blueskyText.length > 300;

  async function handleBlueskyPost() {
    if (!settings.blueskyHandle || !settings.blueskyAppPassword) {
      setBlueskyStatus({ state: "error", message: "Add your Bluesky handle and app password in settings first." });
      return;
    }
    const confirmed = window.confirm(
      `Post this to Bluesky as ${settings.blueskyHandle}?\n\n${blueskyText}`
    );
    if (!confirmed) return;

    setBlueskyStatus({ state: "posting" });
    try {
      const { url } = await postToBluesky(
        settings.blueskyHandle,
        settings.blueskyAppPassword,
        blueskyText,
        "filmreviewhaiku"
      );
      setBlueskyStatus({ state: "posted", url });
    } catch (err) {
      setBlueskyStatus({ state: "error", message: err instanceof Error ? err.message : "Post failed." });
    }
  }

  function handleImport() {
    const result = parseImportBlock(importText);
    if ("error" in result) {
      setImportError(result.error);
      return;
    }
    setImportError(null);
    setTitle(result.title);
    setYear(result.year);
    setRating(result.rating);
    setHaikuLines(result.haikuLines);
    setNotes(result.notes);
    setPosterUrl(result.posterUrl);
    setTmdbMeta(null);
    setTmdbError(null);
    setImportText("");
    setShowImport(false);
  }

  return (
    <div className="app">
      <header className="app__header">
        <div>
          <h1 className="app__title">
            film<span>post</span>
          </h1>
          <p className="app__subtitle">haiku pipeline &middot; rathbone.dev</p>
        </div>
        <button className="icon-btn" onClick={() => setShowSettings(true)} aria-label="Open settings" title="Keys & credentials">
          &#9881;
        </button>
      </header>

      <section className="slate slate--import">
        <div className="import-toggle">
          <button className="btn btn--ghost" onClick={() => setShowImport((v) => !v)} type="button">
            {showImport ? "Hide import" : "Paste from Notion / Claude"}
          </button>
          {!showImport && <span className="import-toggle__hint">Or fill in the fields below by hand.</span>}
        </div>
        {showImport && (
          <div className="import-block">
            <textarea
              rows={6}
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              placeholder={"Film Title: The Odyssey\nYear: 2026\nRating: 5.0\nHaiku: line one / line two / line three\nExtended Notes: (none)\nPoster URL: https://..."}
            />
            {importError && <div className="error">{importError}</div>}
            <button className="btn" onClick={handleImport} type="button" disabled={!importText.trim()}>
              Fill in fields
            </button>
          </div>
        )}
      </section>

      <section className="slate">
        <div className="lookup-row">
          <label className="field">
            <span>Film title</span>
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="The Odyssey" />
          </label>
          <label className="field" style={{ maxWidth: 110 }}>
            <span>Year</span>
            <input value={year} onChange={(e) => setYear(e.target.value)} placeholder="2026" />
          </label>
          <button className="btn" onClick={runLookup} disabled={lookingUp || !title.trim()}>
            {lookingUp ? "Looking up..." : "Look up poster"}
          </button>
        </div>

        {tmdbError && <div className="error">{tmdbError}</div>}

        {tmdbMeta && (
          <div className="poster-preview">
            {posterUrl && <img src={posterUrl} alt={`${tmdbMeta.title} poster`} />}
            <div className="poster-preview__meta">
              <strong>{tmdbMeta.title}</strong> ({tmdbMeta.releaseYear || "year unknown"})
              <br />
              TMDB id {tmdbMeta.id}
              {tmdbMeta.lowConfidence && (
                <>
                  <br />
                  <span style={{ color: "var(--warn)" }}>
                    Low confidence: {tmdbMeta.matchCount} results, no year given to disambiguate.
                  </span>
                </>
              )}
            </div>
          </div>
        )}

        <div className="haiku-lines">
          <span className="haiku-lines__label">Haiku</span>
          {haikuLines.map((line, i) => (
            <input
              key={i}
              value={line}
              onChange={(e) => setLine(i, e.target.value)}
              placeholder={["five syllables", "seven syllables", "five syllables"][i]}
            />
          ))}
        </div>

        <div className="slate__grid">
          <label className="field">
            <span>Extended notes (optional, Notion only)</span>
            <textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </label>
          <label className="field">
            <span>Rating</span>
            <select value={rating} onChange={(e) => setRating(parseFloat(e.target.value))}>
              {RATING_OPTIONS.map((r) => (
                <option key={r} value={r}>
                  {r.toFixed(1)} &middot; {ratingStars(r)}
                </option>
              ))}
            </select>
          </label>
        </div>

        {emDashFields.length > 0 && (
          <div className="warning">
            Em dash found in: {emDashFields.join(", ")}. Restructure with a comma before publishing.
          </div>
        )}
      </section>

      {readyForPlatforms && (
        <>
          <p className="reel-heading">Publish &middot; frame 1 of 6</p>

          <PlatformRow frame="01" name="Notion" status="manual">
            <p className="frame__preview">{notionSummary(input)}</p>
            <div className="frame__actions">
              <CopyButton text={notionSummary(input)} label="Copy record" />
            </div>
          </PlatformRow>

          <PlatformRow frame="02" name="Ghost" status="manual">
            <p className="frame__preview">{ghostBody(input)}</p>
            <div className="frame__actions">
              <CopyButton text={ghostBody(input)} label="Copy body" />
              <CopyButton text={ratingTag(rating)} label={`Copy tag ${ratingTag(rating)}`} />
              <span className="char-count">template: custom-film-review.hbs</span>
            </div>
          </PlatformRow>

          <PlatformRow frame="03" name="Letterboxd" status="manual">
            <p className="frame__preview">{letterboxdReviewText(input)}</p>
            <div className="frame__actions">
              <CopyButton text={letterboxdReviewText(input)} label="Copy review text" />
              <a className="link-out" href={letterboxdSearchUrl(title)} target="_blank" rel="noreferrer">
                Open Letterboxd search &rarr;
              </a>
            </div>
          </PlatformRow>

          <PlatformRow
            frame="04"
            name="Bluesky"
            status={blueskyStatus.state === "posted" ? "posted" : "auto"}
          >
            <p className="frame__preview">{blueskyText}</p>
            <div className="frame__actions">
              <span className={`char-count${blueskyOverLimit ? " char-count--over" : ""}`}>
                {blueskyText.length} / 300
              </span>
              <CopyButton text={blueskyText} label="Copy caption" />
              <button
                className="btn"
                onClick={handleBlueskyPost}
                disabled={blueskyStatus.state === "posting" || blueskyOverLimit}
              >
                {blueskyStatus.state === "posting" ? "Posting..." : "Post to Bluesky"}
              </button>
            </div>
            {blueskyStatus.state === "posted" && (
              <a className="posted-note" href={blueskyStatus.url} target="_blank" rel="noreferrer">
                Posted &middot; view on Bluesky &rarr;
              </a>
            )}
            {blueskyStatus.state === "error" && <div className="error">{blueskyStatus.message}</div>}
          </PlatformRow>

          <PlatformRow
            frame="05"
            name="IMDb"
            status={showImdb ? "manual" : "off"}
            toggle={
              <label className="toggle">
                <input type="checkbox" checked={showImdb} onChange={(e) => setShowImdb(e.target.checked)} />
                include this review
              </label>
            }
          >
            {showImdb ? (
              <>
                <p className="frame__preview">{letterboxdReviewText(input)}</p>
                <div className="frame__actions">
                  <CopyButton text={letterboxdReviewText(input)} label="Copy review text" />
                  <a className="link-out" href={imdbSearchUrl(title)} target="_blank" rel="noreferrer">
                    Open IMDb search &rarr;
                  </a>
                </div>
              </>
            ) : (
              <p className="frame__preview">Off by default. Turn on only for this specific review.</p>
            )}
          </PlatformRow>

          <PlatformRow
            frame="06"
            name="Rotten Tomatoes"
            status={showRT ? "manual" : "off"}
            toggle={
              <label className="toggle">
                <input type="checkbox" checked={showRT} onChange={(e) => setShowRT(e.target.checked)} />
                include this review
              </label>
            }
          >
            {showRT ? (
              <>
                <p className="frame__preview">{letterboxdReviewText(input)}</p>
                <div className="frame__actions">
                  <CopyButton text={letterboxdReviewText(input)} label="Copy review text" />
                  <a className="link-out" href={rottenTomatoesSearchUrl(title)} target="_blank" rel="noreferrer">
                    Open Rotten Tomatoes search &rarr;
                  </a>
                </div>
              </>
            ) : (
              <p className="frame__preview">Off by default. Turn on only for this specific review.</p>
            )}
          </PlatformRow>
        </>
      )}

      {showSettings && (
        <SettingsPanel settings={settings} onChange={updateSettings} onClose={() => setShowSettings(false)} />
      )}
    </div>
  );
}

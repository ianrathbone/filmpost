import { useEffect, useMemo, useState } from "react";
import "./App.css";
import { CopyButton } from "./components/CopyButton";
import { PlatformRow } from "./components/PlatformRow";
import { SettingsPanel } from "./components/SettingsPanel";
import { loadSettings, saveSettings, Settings } from "./lib/storage";
import { tmdbSearch, tmdbExternalIds, TmdbResult } from "./lib/tmdb";
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
  formatDisplayDate,
  blueskyCreatedAt,
  ghostTitle,
  ghostTags,
  imdbReviewsUrl,
  imdbRatingOutOf10,
  imdbDefaultReviewText,
  IMDB_REVIEW_TITLE,
  rottenTomatoesGuessedUrl,
  rottenTomatoesReviewText,
  metacriticGuessedUrl,
  metacriticSearchUrl,
  metacriticReviewText,
} from "./lib/format";

const RATING_OPTIONS = Array.from({ length: 10 }, (_, i) => 0.5 * (i + 1));

// Maps Filmpost's platform names to the exact option labels used in the
// Notion "Platforms" multi-select property, so the paste works without
// creating duplicate/mismatched tags.
const NOTION_PLATFORM_LABEL: Record<string, string> = {
  Ghost: "Blog",
  Letterboxd: "Letterboxd",
  Bluesky: "Bluesky",
  IMDb: "IMDb",
  "Rotten Tomatoes": "Rotten Tomatoes",
  Metacritic: "Metacritic",
};

export default function App() {
  const [settings, setSettings] = useState<Settings>(loadSettings());
  const [showSettings, setShowSettings] = useState(false);

  const [title, setTitle] = useState("");
  const [year, setYear] = useState("");
  const [haikuLines, setHaikuLines] = useState<[string, string, string]>(["", "", ""]);
  const [rating, setRating] = useState(4.0);
  const [notes, setNotes] = useState("");
  const [watchedDate, setWatchedDate] = useState("");

  const [posterUrl, setPosterUrl] = useState<string | null>(null);
  const [tmdbMeta, setTmdbMeta] = useState<TmdbResult | null>(null);
  const [tmdbError, setTmdbError] = useState<string | null>(null);
  const [lookingUp, setLookingUp] = useState(false);
  const [imdbId, setImdbId] = useState<string | null>(null);

  const [imdbReviewText, setImdbReviewText] = useState("");

  const [showImport, setShowImport] = useState(false);
  const [importText, setImportText] = useState("");
  const [importError, setImportError] = useState<string | null>(null);

  const [postedGhost, setPostedGhost] = useState(false);
  const [postedLetterboxd, setPostedLetterboxd] = useState(false);
  const [postedImdb, setPostedImdb] = useState(false);
  const [postedRT, setPostedRT] = useState(false);
  const [postedMetacritic, setPostedMetacritic] = useState(false);

  const [blueskyStatus, setBlueskyStatus] = useState<
    | { state: "idle" }
    | { state: "posting" }
    | { state: "posted"; url: string; imageEmbedded: boolean; posterError: string | null }
    | { state: "error"; message: string }
  >({ state: "idle" });

  const [ghostDownloadError, setGhostDownloadError] = useState<string | null>(null);

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
    setImdbId(null);
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
    tmdbExternalIds(settings.tmdbKey, result.id).then(setImdbId);
  }

  const input: ReviewInput = useMemo(
    () => ({ title, year, haikuLines, rating, notes, posterUrl, watchedDate }),
    [title, year, haikuLines, rating, notes, posterUrl, watchedDate]
  );

  const emDashFields: string[] = useMemo(() => {
    const flagged: string[] = [];
    if (haikuLines.some(findEmDashes)) flagged.push("haiku");
    if (findEmDashes(notes)) flagged.push("extended notes");
    return flagged;
  }, [haikuLines, notes]);

  const readyForPlatforms = title.trim() && haikuLines.every((l) => l.trim());

  // IMDb's review text is editable (needs to clear a 300-char minimum the
  // haiku alone can't reach), so it's only pre-filled once, the first time
  // there's a haiku to build from, never overwritten after that.
  useEffect(() => {
    if (readyForPlatforms && !imdbReviewText) {
      setImdbReviewText(imdbDefaultReviewText(input));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [readyForPlatforms]);

  const blueskyText = blueskyCaption(input);
  const blueskyOverLimit = blueskyText.length > 300;

  async function handleBlueskyPost() {
    if (!settings.blueskyHandle || !settings.blueskyAppPassword) {
      setBlueskyStatus({ state: "error", message: "Add your Bluesky handle and app password in settings first." });
      return;
    }
    const createdAt = blueskyCreatedAt(watchedDate);
    const dateLabel = new Date(createdAt).toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
    const confirmed = window.confirm(
      `Post this to Bluesky as ${settings.blueskyHandle}, dated ${dateLabel}${
        watchedDate ? " (your watched date)" : " (no watched date set, using now)"
      }${posterUrl ? ", poster attached" : ", no poster to attach"}?\n\n${blueskyText}`
    );
    if (!confirmed) return;

    setBlueskyStatus({ state: "posting" });
    try {
      const { url, imageEmbedded, posterError } = await postToBluesky(
        settings.blueskyHandle,
        settings.blueskyAppPassword,
        blueskyText,
        "filmreviewhaiku",
        posterUrl,
        createdAt
      );
      setBlueskyStatus({ state: "posted", url, imageEmbedded, posterError });
    } catch (err) {
      setBlueskyStatus({ state: "error", message: err instanceof Error ? err.message : "Post failed." });
    }
  }

  async function downloadPoster() {
    if (!posterUrl) return;
    setGhostDownloadError(null);
    try {
      const res = await fetch(posterUrl);
      if (!res.ok) throw new Error(`Fetch failed (${res.status})`);
      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objectUrl;
      a.download = `${title || "poster"}-poster.jpg`.replace(/\s+/g, "-").toLowerCase();
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(objectUrl);
    } catch {
      setGhostDownloadError(
        "Could not download automatically. Right-click the poster preview above and choose \"Save image as\" instead."
      );
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
    setWatchedDate(result.watchedDate);
    setTmdbMeta(null);
    setTmdbError(null);
    setImdbId(null);
    setImportText("");
    setShowImport(false);
  }

  const postedPlatformLabels: string[] = useMemo(() => {
    const labels: string[] = [];
    if (postedGhost) labels.push(NOTION_PLATFORM_LABEL["Ghost"]);
    if (postedLetterboxd) labels.push(NOTION_PLATFORM_LABEL["Letterboxd"]);
    if (blueskyStatus.state === "posted") labels.push(NOTION_PLATFORM_LABEL["Bluesky"]);
    if (postedImdb) labels.push(NOTION_PLATFORM_LABEL["IMDb"]);
    if (postedRT) labels.push(NOTION_PLATFORM_LABEL["Rotten Tomatoes"]);
    if (postedMetacritic) labels.push(NOTION_PLATFORM_LABEL["Metacritic"]);
    return labels;
  }, [postedGhost, postedLetterboxd, blueskyStatus, postedImdb, postedRT, postedMetacritic]);

  const notionPlatformsPaste = postedPlatformLabels.join(", ");
  const notionStatusPaste = postedPlatformLabels.length > 0 ? "🚀 Published" : "✏️ Drafting";

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

        <label className="field" style={{ maxWidth: 220, marginBottom: 16 }}>
          <span>Watched date (Bluesky's archive date)</span>
          <input type="date" value={watchedDate} onChange={(e) => setWatchedDate(e.target.value)} />
        </label>

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
          <p className="reel-heading">Publish &middot; frame 1 of 7</p>

          <PlatformRow frame="01" name="Notion" status="manual">
            <p className="frame__preview">{notionSummary(input)}</p>
            <div className="frame__actions">
              <CopyButton text={notionSummary(input)} label="Copy record" />
            </div>
          </PlatformRow>

          <PlatformRow frame="02" name="Ghost" status="manual">
            <p className="frame__preview">{ghostBody(input)}</p>
            <div className="frame__actions">
              <CopyButton text={ghostTitle(input)} label="Copy title" />
              <CopyButton text={ghostBody(input)} label="Copy body" />
              <CopyButton text={ghostTags(input)} label="Copy tags" />
              <CopyButton text={ratingTag(rating)} label={`Copy rating tag`} />
              <button className="btn btn--ghost" onClick={downloadPoster} type="button" disabled={!posterUrl}>
                Download poster
              </button>
              <span className="char-count">template: custom-film-review.hbs</span>
              <label className="toggle">
                <input type="checkbox" checked={postedGhost} onChange={(e) => setPostedGhost(e.target.checked)} />
                posted
              </label>
            </div>
            {ghostDownloadError && <div className="error">{ghostDownloadError}</div>}
          </PlatformRow>

          <PlatformRow frame="03" name="Letterboxd" status="manual">
            <p className="frame__preview">{letterboxdReviewText(input)}</p>
            <p className="frame__helper">
              Watched {watchedDate ? formatDisplayDate(watchedDate) : "(no date set above)"} &middot; Rating{" "}
              {rating.toFixed(1)} ({ratingStars(rating)})
            </p>
            <div className="frame__actions">
              <CopyButton text={letterboxdReviewText(input)} label="Copy review text" />
              <a className="link-out" href={letterboxdSearchUrl(title)} target="_blank" rel="noreferrer">
                Open Letterboxd search &rarr;
              </a>
              <label className="toggle">
                <input
                  type="checkbox"
                  checked={postedLetterboxd}
                  onChange={(e) => setPostedLetterboxd(e.target.checked)}
                />
                posted
              </label>
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
              <>
                <a className="posted-note" href={blueskyStatus.url} target="_blank" rel="noreferrer">
                  Posted &middot; view on Bluesky &rarr;
                </a>
                {!blueskyStatus.imageEmbedded && posterUrl && (
                  <div className="warning">
                    Posted, but the poster couldn't be attached
                    {blueskyStatus.posterError ? `: ${blueskyStatus.posterError}` : "."}
                  </div>
                )}
              </>
            )}
            {blueskyStatus.state === "error" && <div className="error">{blueskyStatus.message}</div>}
          </PlatformRow>

          <PlatformRow frame="05" name="IMDb" status="manual">
            <p className="frame__helper">
              Rating to select: {imdbRatingOutOf10(rating)}/10 &middot; Review title: {IMDB_REVIEW_TITLE}
            </p>
            <textarea
              className="imdb-review-input"
              rows={6}
              value={imdbReviewText}
              onChange={(e) => setImdbReviewText(e.target.value)}
            />
            <p
              className={`char-count ${imdbReviewText.length >= 300 ? "char-count--good" : "char-count--warn"}`}
            >
              {imdbReviewText.length} / 300 minimum
              {imdbReviewText.length < 300 ? " — IMDb will reject it below this" : ""}
            </p>
            <div className="frame__actions">
              <CopyButton text={IMDB_REVIEW_TITLE} label="Copy review title" />
              <CopyButton text={imdbReviewText} label="Copy review text" />
              {imdbId ? (
                <a className="link-out" href={imdbReviewsUrl(imdbId)} target="_blank" rel="noreferrer">
                  Open IMDb reviews page &rarr;
                </a>
              ) : (
                <a className="link-out" href={imdbSearchUrl(title)} target="_blank" rel="noreferrer">
                  Open IMDb search (no direct match found) &rarr;
                </a>
              )}
              <label className="toggle">
                <input type="checkbox" checked={postedImdb} onChange={(e) => setPostedImdb(e.target.checked)} />
                posted
              </label>
            </div>
          </PlatformRow>

          <PlatformRow frame="06" name="Rotten Tomatoes" status="manual">
            <p className="frame__preview">{rottenTomatoesReviewText(input)}</p>
            <p className="frame__helper">Rating to select: {rating.toFixed(1)} ({ratingStars(rating)})</p>
            <div className="frame__actions">
              <CopyButton text={rottenTomatoesReviewText(input)} label="Copy review text" />
              <a
                className="link-out"
                href={rottenTomatoesGuessedUrl(title, year)}
                target="_blank"
                rel="noreferrer"
              >
                Try direct page (guess) &rarr;
              </a>
              <a className="link-out" href={rottenTomatoesSearchUrl(title)} target="_blank" rel="noreferrer">
                Open RT search (if guess is wrong) &rarr;
              </a>
              <label className="toggle">
                <input type="checkbox" checked={postedRT} onChange={(e) => setPostedRT(e.target.checked)} />
                posted
              </label>
            </div>
          </PlatformRow>

          <PlatformRow frame="07" name="Metacritic" status="manual">
            <p className="frame__preview">{metacriticReviewText(input)}</p>
            <p className="frame__helper">My Score: {imdbRatingOutOf10(rating)}/10</p>
            <div className="frame__actions">
              <CopyButton text={metacriticReviewText(input)} label="Copy review text" />
              <a className="link-out" href={metacriticGuessedUrl(title, year)} target="_blank" rel="noreferrer">
                Try direct page (guess) &rarr;
              </a>
              <a className="link-out" href={metacriticSearchUrl(title)} target="_blank" rel="noreferrer">
                Open Metacritic search (if guess is wrong) &rarr;
              </a>
              <label className="toggle">
                <input
                  type="checkbox"
                  checked={postedMetacritic}
                  onChange={(e) => setPostedMetacritic(e.target.checked)}
                />
                posted
              </label>
            </div>
          </PlatformRow>

          <section className="notion-update">
            <h3>Update the Notion record</h3>
            <p className="notion-update__hint">
              In Notion's table view, click into the Status cell and paste the first value, then the
              Platforms cell and paste the second, comma-separated values create/select tags automatically.
            </p>
            <div className="notion-update__row">
              <span className="notion-update__label mono">Status</span>
              <span className="notion-update__value mono">{notionStatusPaste}</span>
              <CopyButton text={notionStatusPaste} label="Copy" />
            </div>
            <div className="notion-update__row">
              <span className="notion-update__label mono">Platforms</span>
              <span className="notion-update__value mono">{notionPlatformsPaste || "(none marked posted yet)"}</span>
              <CopyButton text={notionPlatformsPaste} label="Copy" />
            </div>
          </section>
        </>
      )}

      {showSettings && (
        <SettingsPanel settings={settings} onChange={updateSettings} onClose={() => setShowSettings(false)} />
      )}
    </div>
  );
}

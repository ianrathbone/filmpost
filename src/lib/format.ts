export interface ReviewInput {
  title: string;
  year: string;
  haikuLines: [string, string, string];
  rating: number; // 0.5 - 5.0, half steps
  notes: string;
  posterUrl: string | null;
  watchedDate: string; // YYYY-MM-DD, may be empty
}

export function ratingTag(rating: number): string {
  const whole = Math.floor(rating);
  const frac = rating - whole === 0.5 ? "5" : "0";
  return `#rating-${whole}-${frac}`;
}

export function ratingStars(rating: number): string {
  const full = Math.floor(rating);
  const half = rating - full === 0.5;
  return "\u2605".repeat(full) + (half ? "\u00bd" : "");
}

const EM_DASH = "\u2014";

export function findEmDashes(text: string): boolean {
  return text.includes(EM_DASH);
}

export function haikuBlock(lines: [string, string, string]): string {
  return lines.join(" / ");
}

export function haikuMultiline(lines: [string, string, string]): string {
  return lines.join("\n");
}

export function letterboxdReviewText(input: ReviewInput): string {
  return haikuMultiline(input.haikuLines);
}

export function blueskyCaption(input: ReviewInput): string {
  const label = input.year ? `${input.title} (${input.year})` : input.title;
  const stars = ratingStars(input.rating);
  return `${label} - #filmreviewhaiku\n\n${haikuMultiline(input.haikuLines)}\n\n${stars}`;
}

export function ghostBody(input: ReviewInput): string {
  return `> ${haikuBlock(input.haikuLines)}`;
}

export function ghostTitle(input: ReviewInput): string {
  return input.year ? `${input.title} (${input.year})` : input.title;
}

export function ghostTags(input: ReviewInput): string {
  return [ratingTag(input.rating), "filmreviewhaiku", "film", "review", "haiku"].join(", ");
}

/**
 * The ISO timestamp to use as the Bluesky post's createdAt. If a watched
 * date is set, the post is backdated to that date (noon UTC) so Bluesky
 * shows it as archived from when the film was actually watched, matching
 * how the rest of the review history is dated. Falls back to the current
 * moment if no watched date is set or it doesn't parse.
 */
export function blueskyCreatedAt(watchedDate: string): string {
  if (!watchedDate) return new Date().toISOString();
  const d = new Date(`${watchedDate}T12:00:00Z`);
  if (isNaN(d.getTime())) return new Date().toISOString();
  return d.toISOString();
}

export function formatDisplayDate(watchedDate: string): string {
  if (!watchedDate) return "";
  const d = new Date(`${watchedDate}T00:00:00Z`);
  if (isNaN(d.getTime())) return watchedDate;
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}

export function notionSummary(input: ReviewInput): string {
  const lines = [
    `Film Title: ${input.title}`,
    `Year: ${input.year || "(unknown)"}`,
    `Rating: ${input.rating.toFixed(1)}`,
    `Haiku: ${haikuBlock(input.haikuLines)}`,
    `Extended Notes: ${input.notes || "(none)"}`,
    `Poster URL: ${input.posterUrl || "(none)"}`,
  ];
  return lines.join("\n");
}

export interface ImportResult {
  title: string;
  year: string;
  rating: number;
  haikuLines: [string, string, string];
  notes: string;
  posterUrl: string | null;
  watchedDate: string;
}

/**
 * Parses the block from Notion's "Filmpost Import" formula column (the same
 * content the "Open in Filmpost" link carries):
 *
 * Film Title: <title>
 * Year: <year>
 * Rating: <rating>
 * Haiku: <line> / <line> / <line>
 * Extended Notes: <notes or (none)>
 * Poster URL: <url or (none)>
 * Watched Date: <YYYY-MM-DD or (unknown)>
 */
export function parseImportBlock(raw: string): ImportResult | { error: string } {
  const lines = raw.split("\n").map((l) => l.trim()).filter(Boolean);
  const fields: Record<string, string> = {};
  for (const line of lines) {
    const idx = line.indexOf(":");
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim().toLowerCase();
    const value = line.slice(idx + 1).trim();
    fields[key] = value;
  }

  if (!fields["film title"]) return { error: "No 'Film Title:' line found." };
  if (!fields["haiku"]) return { error: "No 'Haiku:' line found." };

  const haikuParts = fields["haiku"].split("/").map((s) => s.trim());
  if (haikuParts.length !== 3) {
    return { error: "Haiku line should have exactly three parts separated by '/'." };
  }

  const ratingNum = parseFloat(fields["rating"] ?? "");
  const notesRaw = fields["extended notes"] ?? "";
  const posterRaw = fields["poster url"] ?? "";
  const watchedDateRaw = fields["watched date"] ?? "";

  return {
    title: fields["film title"],
    year: fields["year"] === "(unknown)" ? "" : fields["year"] ?? "",
    rating: Number.isFinite(ratingNum) ? ratingNum : 4.0,
    haikuLines: [haikuParts[0], haikuParts[1], haikuParts[2]],
    notes: notesRaw === "(none)" ? "" : notesRaw,
    posterUrl: !posterRaw || posterRaw === "(none)" ? null : posterRaw,
    watchedDate: watchedDateRaw === "(unknown)" ? "" : watchedDateRaw,
  };
}

export function letterboxdSearchUrl(title: string): string {
  return `https://letterboxd.com/search/films/${encodeURIComponent(title)}/`;
}

export function imdbSearchUrl(title: string): string {
  return `https://www.imdb.com/find/?q=${encodeURIComponent(title)}`;
}

export function imdbReviewsUrl(imdbId: string): string {
  return `https://www.imdb.com/title/${imdbId}/reviews/`;
}

/**
 * IMDb rates on a whole-number 1-10 scale. The house 0.5-5.0 half-star
 * scale maps onto it exactly (each half-star step is one IMDb point), so
 * this is a straight doubling, not a rounding approximation.
 */
export function imdbRatingOutOf10(rating: number): number {
  return Math.round(rating * 2);
}

export const IMDB_REVIEW_TITLE = "Film Review Haiku";

/**
 * IMDb requires at least 300 characters in the review body, well beyond
 * a haiku on its own. This is only a starting point for the editable IMDb
 * review field in Filmpost, haiku first (each line as its own paragraph,
 * unlike Letterboxd's single block), then extended notes if there are any
 * to draw on.
 */
export function imdbDefaultReviewText(input: ReviewInput): string {
  const haikuParagraphs = input.haikuLines.join("\n\n");
  return input.notes ? `${haikuParagraphs}\n\n${input.notes}` : haikuParagraphs;
}

export function rottenTomatoesSearchUrl(title: string): string {
  return `https://www.rottentomatoes.com/search?search=${encodeURIComponent(title)}`;
}

/**
 * Best-effort guess at Rotten Tomatoes' own slug convention (/m/title_year).
 * RT has no public lookup API and no cross-reference on TMDB the way IMDb
 * does, so unlike imdbReviewsUrl this is a guess, not a confirmed match.
 * Strip punctuation, lowercase, underscores for spaces, year appended when
 * known. Callers should offer the search URL alongside this as a fallback.
 */
export function rottenTomatoesGuessedUrl(title: string, year: string): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .trim()
    .replace(/\s+/g, "_");
  return year ? `https://www.rottentomatoes.com/m/${slug}_${year}` : `https://www.rottentomatoes.com/m/${slug}`;
}

/**
 * Rotten Tomatoes' audience review format: hashtag first, blank line, then
 * the haiku as one slash-separated line (matches what's shown under the
 * star picker), same 0.5-5.0 scale as the house rating, no conversion.
 */
export function rottenTomatoesReviewText(input: ReviewInput): string {
  return `#filmreviewhaiku\n\n${haikuBlock(input.haikuLines)}`;
}

/**
 * Best-effort guess at Metacritic's slug convention (/movie/title-year/).
 * Same caveat as Rotten Tomatoes: no public lookup API, no cross-reference
 * on TMDB, so this is a guess, pair with a search fallback.
 */
export function metacriticGuessedUrl(title: string, year: string): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .trim()
    .replace(/\s+/g, "-");
  return year ? `https://www.metacritic.com/movie/${slug}-${year}/` : `https://www.metacritic.com/movie/${slug}/`;
}

export function metacriticSearchUrl(title: string): string {
  return `https://www.metacritic.com/search/${encodeURIComponent(title)}/`;
}

/**
 * Metacritic's user score box: haiku first (single slash-separated line),
 * blank line, then the hashtag, the reverse order from Rotten Tomatoes.
 * Score is whole-number 1-10, same doubling as IMDb.
 */
export function metacriticReviewText(input: ReviewInput): string {
  return `${haikuBlock(input.haikuLines)}\n\n#filmreviewhaiku`;
}

/**
 * TMDB movie page URL, built from the numeric id we already have from the
 * lookup, this one is reliable (not a guess like RT/Metacritic) since the
 * slug portion is cosmetic, TMDB routes on the id prefix.
 */
export function tmdbMovieUrl(id: number, title: string): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .trim()
    .replace(/\s+/g, "-");
  return `https://www.themoviedb.org/movie/${id}-${slug}`;
}

/**
 * TMDB's review box supports Markdown, but Ian's actual usage matches the
 * same haiku-then-hashtag format as Metacritic and Plex, not a blockquote.
 */
export function tmdbReviewBody(input: ReviewInput): string {
  return `${haikuBlock(input.haikuLines)}\n\n#filmreviewhaiku`;
}

export const TMDB_REVIEW_MIN_CHARS = 100;

/**
 * TMDB also enforces a minimum length (100 characters), same problem as
 * IMDb's 300-character floor, just a lower bar. A bare haiku plus hashtag
 * often falls short, so this is a starting point for an editable field:
 * haiku, then extended notes if there are any to draw on, then the hashtag.
 */
export function tmdbDefaultReviewText(input: ReviewInput): string {
  const base = haikuBlock(input.haikuLines);
  const withNotes = input.notes ? `${base}\n\n${input.notes}` : base;
  return `${withNotes}\n\n#filmreviewhaiku`;
}

/**
 * Best-effort guess at Plex Watch's slug convention
 * (/en-GB/movie/title-year/review). No public lookup API, no cross-reference
 * on TMDB, same caveat as RT/Metacritic, pair with a search fallback.
 * Locale prefix (en-GB) matches Ian's account, may differ for others.
 */
export function plexGuessedUrl(title: string, year: string): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .trim()
    .replace(/\s+/g, "-");
  return year
    ? `https://watch.plex.tv/en-GB/movie/${slug}-${year}/review`
    : `https://watch.plex.tv/en-GB/movie/${slug}/review`;
}

export function plexSearchUrl(title: string): string {
  return `https://watch.plex.tv/en-GB/search?query=${encodeURIComponent(title)}`;
}

/**
 * Plex's review box: haiku (single slash-separated line), blank line,
 * hashtag, same as Metacritic and TMDB. Rating is its own 5-star scale,
 * same as the house rating, no conversion needed.
 */
export function plexReviewText(input: ReviewInput): string {
  return `${haikuBlock(input.haikuLines)}\n\n#filmreviewhaiku`;
}

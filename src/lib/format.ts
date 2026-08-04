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
 * Parses the block produced by the film-haiku-publish skill or Notion's
 * "Filmpost Import" formula column:
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

export function rottenTomatoesSearchUrl(title: string): string {
  return `https://www.rottentomatoes.com/search?search=${encodeURIComponent(title)}`;
}

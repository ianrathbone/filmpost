export interface ReviewInput {
  title: string;
  year: string;
  haikuLines: [string, string, string];
  rating: number; // 0.5 - 5.0, half steps
  notes: string;
  posterUrl: string | null;
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
  return `${haikuMultiline(input.haikuLines)}\n\n${label} - #filmreviewhaiku`;
}

export function ghostBody(input: ReviewInput): string {
  const quote = `> ${haikuBlock(input.haikuLines)}`;
  return input.notes ? `${quote}\n\n${input.notes}` : quote;
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

export function letterboxdSearchUrl(title: string): string {
  return `https://letterboxd.com/search/films/${encodeURIComponent(title)}/`;
}

export function imdbSearchUrl(title: string): string {
  return `https://www.imdb.com/find/?q=${encodeURIComponent(title)}`;
}

export function rottenTomatoesSearchUrl(title: string): string {
  return `https://www.rottentomatoes.com/search?search=${encodeURIComponent(title)}`;
}

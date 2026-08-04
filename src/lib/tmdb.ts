export interface TmdbResult {
  id: number;
  title: string;
  releaseYear: string;
  posterUrl: string | null;
  lowConfidence: boolean;
  matchCount: number;
}

export async function tmdbSearch(
  apiKey: string,
  title: string,
  year: string
): Promise<TmdbResult | { error: string }> {
  const params = new URLSearchParams({
    api_key: apiKey,
    query: title,
  });
  if (year) params.set("year", year);

  let res: Response;
  try {
    res = await fetch(`https://api.themoviedb.org/3/search/movie?${params.toString()}`);
  } catch {
    return { error: "Could not reach TMDB. Check your connection." };
  }

  if (!res.ok) {
    if (res.status === 401) return { error: "TMDB rejected the API key." };
    return { error: `TMDB search failed (${res.status}).` };
  }

  const data = await res.json();
  const results: any[] = data.results ?? [];
  if (results.length === 0) {
    return { error: "No TMDB match found. Enter a poster URL manually." };
  }

  const top = results[0];
  const posterPath: string | null = top.poster_path ?? null;
  const releaseYear = (top.release_date ?? "").slice(0, 4);

  return {
    id: top.id,
    title: top.title,
    releaseYear,
    posterUrl: posterPath ? `https://image.tmdb.org/t/p/w500${posterPath}` : null,
    lowConfidence: results.length > 1 && !year,
    matchCount: results.length,
  };
}

/**
 * TMDB carries a cross-reference to the matching IMDb title id (tt1234567),
 * which is the only reliable way to link straight to a film's IMDb reviews
 * page, IMDb itself has no public search API. Returns null if TMDB has no
 * IMDb id on file for this title or the lookup fails, callers should fall
 * back to a plain IMDb title search in that case.
 */
export async function tmdbExternalIds(apiKey: string, tmdbId: number): Promise<string | null> {
  try {
    const res = await fetch(
      `https://api.themoviedb.org/3/movie/${tmdbId}/external_ids?api_key=${encodeURIComponent(apiKey)}`
    );
    if (!res.ok) return null;
    const data = await res.json();
    return data.imdb_id || null;
  } catch {
    return null;
  }
}

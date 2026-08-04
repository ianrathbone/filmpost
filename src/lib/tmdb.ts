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
 * TMDB rating requires writing to Ian's actual account, not just reading
 * public data, so it needs a real login-and-approve flow (there's no app
 * password equivalent). This is TMDB's v3 auth dance:
 * 1. Get a request token
 * 2. Send the user to TMDB to approve it (redirect, not a popup, TMDB
 *    blocks embedding its auth page in an iframe/popup)
 * 3. TMDB redirects back with ?approved=true&request_token=..., exchange
 *    that for a session_id, which doesn't expire until revoked
 */
export async function tmdbCreateRequestToken(apiKey: string): Promise<string | { error: string }> {
  try {
    const res = await fetch(`https://api.themoviedb.org/3/authentication/token/new?api_key=${encodeURIComponent(apiKey)}`);
    if (!res.ok) return { error: `TMDB token request failed (${res.status}).` };
    const data = await res.json();
    if (!data.success) return { error: "TMDB rejected the token request." };
    return data.request_token as string;
  } catch {
    return { error: "Could not reach TMDB." };
  }
}

export function tmdbApproveUrl(requestToken: string, redirectTo: string): string {
  return `https://www.themoviedb.org/authenticate/${requestToken}?redirect_to=${encodeURIComponent(redirectTo)}`;
}

export async function tmdbCreateSession(apiKey: string, requestToken: string): Promise<string | { error: string }> {
  try {
    const res = await fetch(`https://api.themoviedb.org/3/authentication/session/new?api_key=${encodeURIComponent(apiKey)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ request_token: requestToken }),
    });
    if (!res.ok) return { error: `TMDB session creation failed (${res.status}).` };
    const data = await res.json();
    if (!data.success) return { error: "TMDB rejected the session request." };
    return data.session_id as string;
  } catch {
    return { error: "Could not reach TMDB." };
  }
}

export async function tmdbSubmitRating(
  apiKey: string,
  sessionId: string,
  movieId: number,
  value: number
): Promise<{ ok: true } | { error: string }> {
  try {
    const res = await fetch(
      `https://api.themoviedb.org/3/movie/${movieId}/rating?api_key=${encodeURIComponent(apiKey)}&session_id=${encodeURIComponent(sessionId)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value }),
      }
    );
    if (!res.ok) {
      const body = await res.text();
      return { error: `TMDB rating failed (${res.status}): ${body}` };
    }
    return { ok: true };
  } catch {
    return { error: "Could not reach TMDB." };
  }
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

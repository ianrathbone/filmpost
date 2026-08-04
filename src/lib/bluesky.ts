const ENTRYWAY = "https://bsky.social";

interface Session {
  accessJwt: string;
  did: string;
}

async function createSession(handle: string, appPassword: string): Promise<Session> {
  const res = await fetch(`${ENTRYWAY}/xrpc/com.atproto.server.createSession`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ identifier: handle, password: appPassword }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Bluesky login failed (${res.status}): ${body}`);
  }
  const data = await res.json();
  return { accessJwt: data.accessJwt, did: data.did };
}

function utf8ByteOffsets(text: string, substring: string): { start: number; end: number } | null {
  const idx = text.indexOf(substring);
  if (idx === -1) return null;
  const encoder = new TextEncoder();
  const start = encoder.encode(text.slice(0, idx)).length;
  const end = start + encoder.encode(substring).length;
  return { start, end };
}

async function uploadImageBlob(accessJwt: string, imageUrl: string): Promise<any> {
  const imgRes = await fetch(imageUrl);
  if (!imgRes.ok) {
    throw new Error(`Could not fetch the poster image (${imgRes.status}).`);
  }
  const contentType = imgRes.headers.get("content-type") || "image/jpeg";
  const bytes = await imgRes.arrayBuffer();

  const res = await fetch(`${ENTRYWAY}/xrpc/com.atproto.repo.uploadBlob`, {
    method: "POST",
    headers: {
      "Content-Type": contentType,
      Authorization: `Bearer ${accessJwt}`,
    },
    body: bytes,
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Bluesky image upload failed (${res.status}): ${body}`);
  }
  const data = await res.json();
  return data.blob;
}

export async function postToBluesky(
  handle: string,
  appPassword: string,
  text: string,
  hashtag: string,
  posterUrl?: string | null
): Promise<{ url: string; imageEmbedded: boolean; posterError: string | null }> {
  const session = await createSession(handle, appPassword);

  let embed: any = undefined;
  let imageEmbedded = false;
  let posterError: string | null = null;

  if (posterUrl) {
    try {
      const blob = await uploadImageBlob(session.accessJwt, posterUrl);
      embed = {
        $type: "app.bsky.embed.images",
        images: [{ image: blob, alt: "Film poster" }],
      };
      imageEmbedded = true;
    } catch (err) {
      // Don't block the post over a failed image fetch/upload, just post without it
      // and tell the caller so it can be surfaced to the user.
      posterError = err instanceof Error ? err.message : "Could not attach the poster image.";
    }
  }

  const facets: any[] = [];
  const tagWithHash = `#${hashtag}`;
  const offsets = utf8ByteOffsets(text, tagWithHash);
  if (offsets) {
    facets.push({
      index: { byteStart: offsets.start, byteEnd: offsets.end },
      features: [{ $type: "app.bsky.richtext.facet#tag", tag: hashtag }],
    });
  }

  // createdAt reflects the actual moment this post is sent, in UTC, as Bluesky expects.
  const record = {
    $type: "app.bsky.feed.post",
    text,
    createdAt: new Date().toISOString(),
    ...(facets.length ? { facets } : {}),
    ...(embed ? { embed } : {}),
  };

  const res = await fetch(`${ENTRYWAY}/xrpc/com.atproto.repo.createRecord`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.accessJwt}`,
    },
    body: JSON.stringify({
      repo: session.did,
      collection: "app.bsky.feed.post",
      record,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Bluesky post failed (${res.status}): ${body}`);
  }

  const data = await res.json();
  const rkey = (data.uri as string).split("/").pop();
  const handleClean = handle.replace(/^@/, "");
  return { url: `https://bsky.app/profile/${handleClean}/post/${rkey}`, imageEmbedded, posterError };
}

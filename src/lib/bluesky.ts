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

export async function postToBluesky(
  handle: string,
  appPassword: string,
  text: string,
  hashtag: string
): Promise<{ url: string }> {
  const session = await createSession(handle, appPassword);

  const facets: any[] = [];
  const tagWithHash = `#${hashtag}`;
  const offsets = utf8ByteOffsets(text, tagWithHash);
  if (offsets) {
    facets.push({
      index: { byteStart: offsets.start, byteEnd: offsets.end },
      features: [{ $type: "app.bsky.richtext.facet#tag", tag: hashtag }],
    });
  }

  const record = {
    $type: "app.bsky.feed.post",
    text,
    createdAt: new Date().toISOString(),
    ...(facets.length ? { facets } : {}),
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
  return { url: `https://bsky.app/profile/${handleClean}/post/${rkey}` };
}

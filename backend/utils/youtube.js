const YOUTUBE_ID_REGEX = /^[a-zA-Z0-9_-]{11}$/;

const parseUrl = (value) => {
  try {
    return new URL(String(value || "").trim());
  } catch {
    return null;
  }
};

const normalizeHost = (host) => host.toLowerCase().replace(/^www\./, "");

const isYouTubeHost = (host) =>
  host === "youtube.com" ||
  host.endsWith(".youtube.com") ||
  host === "youtu.be";

export const extractYouTubeVideoId = (value) => {
  const url = parseUrl(value);
  if (!url) return null;

  const host = normalizeHost(url.hostname);
  if (!isYouTubeHost(host)) return null;

  let candidate = "";

  if (host === "youtu.be") {
    candidate = url.pathname.split("/").filter(Boolean)[0] || "";
  } else {
    candidate = url.searchParams.get("v") || "";
    if (!candidate) {
      const parts = url.pathname.split("/").filter(Boolean);
      if (
        parts.length >= 2 &&
        ["embed", "shorts", "live", "v"].includes(parts[0])
      ) {
        candidate = parts[1];
      }
    }
  }

  if (!YOUTUBE_ID_REGEX.test(candidate)) return null;
  return candidate;
};

export const isValidYouTubeUrl = (value) =>
  Boolean(extractYouTubeVideoId(value));

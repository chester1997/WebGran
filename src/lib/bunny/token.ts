import crypto from "crypto";

export interface GeneratePlaybackTokenOptions {
  videoId: string;
  expiresInSeconds?: number;
  tokenKey?: string;
  cdnHostname?: string;
}

export interface PlaybackAuthorization {
  videoId: string;
  playbackUrl: string;
  directUrl: string;
  expiresAt: number; // UNIX timestamp in seconds
}

/**
 * Generates a secure, temporary Bunny Stream playback token URL.
 * NEVER exposes Bunny API keys or secrets to the browser.
 */
export function generateBunnyPlaybackToken({
  videoId,
  expiresInSeconds = 3600,
  tokenKey = process.env.BUNNY_STREAM_TOKEN_KEY || process.env.BUNNY_STREAM_API_KEY || "",
  cdnHostname = process.env.BUNNY_STREAM_CDN_HOSTNAME || "video.bunnycdn.com",
}: GeneratePlaybackTokenOptions): PlaybackAuthorization {
  if (!tokenKey) {
    throw new Error(
      "[BunnyToken] Token Authentication Key is missing. BUNNY_STREAM_TOKEN_KEY must be configured in environment variables."
    );
  }

  const cleanCdnHostname = cdnHostname.replace(/^https?:\/\//, "").replace(/\/$/, "");
  const expiresAt = Math.floor(Date.now() / 1000) + expiresInSeconds;

  const dirPath = `/${videoId}/`;
  const playlistPath = `/${videoId}/playlist.m3u8`;
  const directPath = `/${videoId}/play_360p.mp4`;

  // Bunny CDN Directory Token Auth for HLS:
  // sha256_base64url(tokenKey + dirPath + expiresAt)
  // With token_path=/<videoId>/ query parameter so sub-playlists and .ts/.m4s segments are authorized
  const hashHls = crypto
    .createHash("sha256")
    .update(`${tokenKey}${dirPath}${expiresAt}`)
    .digest("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");

  // File Token Auth for MP4 fallback:
  // sha256_base64url(tokenKey + directPath + expiresAt)
  const hashMp4 = crypto
    .createHash("sha256")
    .update(`${tokenKey}${directPath}${expiresAt}`)
    .digest("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");

  const tokenParam = `?token=${hashHls}&expires=${expiresAt}&token_path=${encodeURIComponent(dirPath)}`;
  const directTokenParam = `?token=${hashMp4}&expires=${expiresAt}`;

  const playbackUrl = `https://${cleanCdnHostname}${playlistPath}${tokenParam}`;
  const directUrl = `https://${cleanCdnHostname}${directPath}${directTokenParam}`;

  return {
    videoId,
    playbackUrl,
    directUrl,
    expiresAt,
  };
}

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
  const cleanCdnHostname = cdnHostname.replace(/^https?:\/\//, "").replace(/\/$/, "");
  const expiresAt = Math.floor(Date.now() / 1000) + expiresInSeconds;

  const path = `/${videoId}/playlist.m3u8`;
  const directPath = `/${videoId}/play_360p.mp4`;

  let tokenParam = "";
  let directTokenParam = "";

  if (tokenKey) {
    // Bunny CDN Standard Token Auth:
    // sha256_base64url(tokenKey + path + expiresAt)
    const hashHls = crypto
      .createHash("sha256")
      .update(`${tokenKey}${path}${expiresAt}`)
      .digest("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=/g, "");

    const hashMp4 = crypto
      .createHash("sha256")
      .update(`${tokenKey}${directPath}${expiresAt}`)
      .digest("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=/g, "");

    tokenParam = `?token=${hashHls}&expires=${expiresAt}`;
    directTokenParam = `?token=${hashMp4}&expires=${expiresAt}`;
  }

  const playbackUrl = `https://${cleanCdnHostname}${path}${tokenParam}`;
  const directUrl = `https://${cleanCdnHostname}${directPath}${directTokenParam}`;

  return {
    videoId,
    playbackUrl,
    directUrl,
    expiresAt,
  };
}

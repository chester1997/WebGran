import { describe, test, expect, beforeEach, afterAll } from "vitest";
import { generateBunnyPlaybackToken } from "../token";

describe("Bunny Stream Playback Token Authentication", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    process.env.BUNNY_STREAM_TOKEN_KEY = "mock_token_auth_key_123";
    process.env.BUNNY_STREAM_API_KEY = "mock_management_api_key_456";
    process.env.BUNNY_STREAM_CDN_HOSTNAME = "vz-mock-cdn.b-cdn.net";
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  test("1 & 6 & 7. Generates valid HLS and MP4 playback URLs using BUNNY_STREAM_TOKEN_KEY", () => {
    const res = generateBunnyPlaybackToken({ videoId: "video_guid_123" });

    expect(res.videoId).toBe("video_guid_123");
    expect(res.playbackUrl).toContain("https://vz-mock-cdn.b-cdn.net/video_guid_123/playlist.m3u8?token=");
    expect(res.playbackUrl).toContain("&expires=");
    expect(res.playbackUrl).toContain("&token_path=%2Fvideo_guid_123%2F");

    expect(res.directUrl).toContain("https://vz-mock-cdn.b-cdn.net/video_guid_123/play_360p.mp4?token=");
    expect(res.directUrl).toContain("&expires=");
  });

  test("2. Uses BUNNY_STREAM_TOKEN_KEY explicitly over BUNNY_STREAM_API_KEY", () => {
    delete process.env.BUNNY_STREAM_TOKEN_KEY;
    process.env.BUNNY_STREAM_API_KEY = "api_key_only";

    const tokenResApiOnly = generateBunnyPlaybackToken({ videoId: "video_guid_123" });

    process.env.BUNNY_STREAM_TOKEN_KEY = "token_key_different";
    const tokenResTokenKey = generateBunnyPlaybackToken({ videoId: "video_guid_123" });

    expect(tokenResApiOnly.playbackUrl).not.toEqual(tokenResTokenKey.playbackUrl);
  });

  test("3 & 4. Token expiration calculation is correct", () => {
    const nowSec = Math.floor(Date.now() / 1000);
    const res = generateBunnyPlaybackToken({ videoId: "video_guid_123", expiresInSeconds: 1800 });

    expect(res.expiresAt).toBeGreaterThanOrEqual(nowSec + 1795);
    expect(res.expiresAt).toBeLessThanOrEqual(nowSec + 1805);
    expect(res.playbackUrl).toContain(`expires=${res.expiresAt}`);
  });

  test("5. Generates correct path and URL structure", () => {
    const res = generateBunnyPlaybackToken({
      videoId: "abc-def-789",
      cdnHostname: "custom-cdn.b-cdn.net/",
    });

    expect(res.playbackUrl.startsWith("https://custom-cdn.b-cdn.net/abc-def-789/playlist.m3u8")).toBe(true);
    expect(res.directUrl.startsWith("https://custom-cdn.b-cdn.net/abc-def-789/play_360p.mp4")).toBe(true);
  });

  test("8. Throws explicit and safe security error when Token Key is missing", () => {
    delete process.env.BUNNY_STREAM_TOKEN_KEY;
    delete process.env.BUNNY_STREAM_API_KEY;

    expect(() => {
      generateBunnyPlaybackToken({ videoId: "video_guid_123", tokenKey: "" });
    }).toThrow("[BunnyToken] Token Authentication Key is missing. BUNNY_STREAM_TOKEN_KEY must be configured in environment variables.");
  });

  test("9. Never leaks secret keys inside output URLs or object properties", () => {
    const secretTokenKey = "super_secret_token_key_999";
    const res = generateBunnyPlaybackToken({
      videoId: "video_guid_123",
      tokenKey: secretTokenKey,
    });

    const jsonStr = JSON.stringify(res);
    expect(jsonStr).not.toContain(secretTokenKey);
    expect(res.playbackUrl).not.toContain(secretTokenKey);
    expect(res.directUrl).not.toContain(secretTokenKey);
  });
});

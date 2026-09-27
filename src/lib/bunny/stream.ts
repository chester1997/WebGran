import crypto from "crypto";

export interface BunnyVideoDetails {
  guid: string;
  videoLibraryId: number;
  title: string;
  dateCreated: string;
  views: number;
  length: number;
  status: number; // 0 = Created, 1 = Uploading/Processing, 2 = Encoding Failed, 3 = Transcoded/Ready
  framerate: number;
  width: number;
  height: number;
  availableResolutions: string;
  thumbnailFileName: string;
  hasMP4Fallback: boolean;
}

export class BunnyStreamService {
  private static getConfig() {
    const libraryId = process.env.BUNNY_STREAM_LIBRARY_ID;
    const apiKey = process.env.BUNNY_STREAM_API_KEY;
    const cdnHostname = process.env.BUNNY_STREAM_CDN_HOSTNAME;

    if (!libraryId || !apiKey || !cdnHostname) {
      throw new Error(
        "[BunnyStream] Missing mandatory configuration: BUNNY_STREAM_LIBRARY_ID, BUNNY_STREAM_API_KEY, or BUNNY_STREAM_CDN_HOSTNAME must be defined in environment variables."
      );
    }

    const cleanCdnHostname = cdnHostname.replace(/^https?:\/\//, "").replace(/\/$/, "");

    return {
      libraryId,
      apiKey,
      cdnHostname: cleanCdnHostname,
      baseUrl: `https://video.bunnycdn.net/library/${libraryId}`,
    };
  }

  /**
   * Creates a video object record in Bunny Stream API prior to uploading.
   */
  static async createVideo(title: string): Promise<{ videoId: string; title: string }> {
    const config = this.getConfig();
    console.log("[BunnyStream] create video", { title });

    const res = await fetch(`${config.baseUrl}/videos`, {
      method: "POST",
      headers: {
        AccessKey: config.apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ title }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error("[BunnyStream] createVideo error", { status: res.status, errText });
      throw new Error(`Bunny Stream API error (${res.status}): ${errText}`);
    }

    const data = await res.json();
    console.log("[BunnyStream] video created", { videoId: data.guid });

    return {
      videoId: data.guid,
      title: data.title || title,
    };
  }

  /**
   * Fetches video metadata and status details from Bunny Stream API.
   */
  static async getVideo(videoId: string): Promise<BunnyVideoDetails> {
    const config = this.getConfig();

    const res = await fetch(`${config.baseUrl}/videos/${videoId}`, {
      method: "GET",
      headers: {
        AccessKey: config.apiKey,
      },
      cache: "no-store",
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error("[BunnyStream] getVideo error", { videoId, status: res.status, errText });
      throw new Error(`Bunny Stream API error (${res.status}): ${errText}`);
    }

    return await res.json();
  }

  /**
   * Deletes a video from Bunny Stream library.
   */
  static async deleteVideo(videoId: string): Promise<boolean> {
    const config = this.getConfig();
    console.log("[BunnyStream] delete video", { videoId });

    const res = await fetch(`${config.baseUrl}/videos/${videoId}`, {
      method: "DELETE",
      headers: {
        AccessKey: config.apiKey,
      },
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error("[BunnyStream] deleteVideo error", { videoId, status: res.status, errText });
      return false;
    }

    return true;
  }

  /**
   * Generates presigned authorization signature & parameters for direct browser upload.
   * NEVER exposes BUNNY_STREAM_API_KEY to the client.
   */
  static generateDirectUploadSignature(videoId: string, expirationMinutes = 120) {
    const config = this.getConfig();
    const expirationTime = Math.floor(Date.now() / 1000) + expirationMinutes * 60;

    // Official Bunny Stream Signature format for direct browser upload:
    // sha256(libraryId + apiKey + expirationTime + videoId)
    const tokenString = `${config.libraryId}${config.apiKey}${expirationTime}${videoId}`;
    const signature = crypto.createHash("sha256").update(tokenString).digest("hex");

    return {
      libraryId: config.libraryId,
      videoId,
      expirationTime,
      signature,
      uploadUrl: `${config.baseUrl}/videos/${videoId}`,
      tusUploadUrl: `https://video.bunnycdn.net/tusupload`,
      headers: {
        AuthorizationSignature: signature,
        AuthorizationExpire: String(expirationTime),
        VideoId: videoId,
        LibraryId: config.libraryId,
      },
    };
  }

  /**
   * Returns HLS playlist streaming URL (.m3u8).
   */
  static getPlaybackUrl(videoId: string): string {
    const config = this.getConfig();
    return `https://${config.cdnHostname}/${videoId}/playlist.m3u8`;
  }

  /**
   * Returns thumbnail CDN URL for the given video.
   */
  static getThumbnailUrl(videoId: string, fileName?: string): string {
    const config = this.getConfig();
    return `https://${config.cdnHostname}/${videoId}/${fileName || "thumbnail.jpg"}`;
  }

  /**
   * Returns direct MP4 fallback URL if enabled.
   */
  static getDirectStreamUrl(videoId: string): string {
    const config = this.getConfig();
    return `https://${config.cdnHostname}/${videoId}/play_720p.mp4`;
  }
}

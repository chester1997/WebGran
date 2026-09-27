import { NextRequest, NextResponse } from "next/server";
import { connection } from "next/server";
import { db } from "@/db";
import { clips, stores } from "@/db/schema";
import { eq, and, asc } from "drizzle-orm";
import { getStoreBySlug } from "@/lib/store-cache";
import { BunnyStreamService } from "@/lib/bunny/stream";

export async function GET(req: NextRequest) {
  await connection();
  try {
    const searchParams = req.nextUrl.searchParams;
    const storeSlug = searchParams.get("storeSlug");
    const storeId = searchParams.get("storeId");

    if (!storeSlug && !storeId) {
      return NextResponse.json(
        { success: false, error: "Parâmetro storeSlug ou storeId é obrigatório." },
        { status: 400 }
      );
    }

    let store = null;
    if (storeSlug) {
      store = await getStoreBySlug(storeSlug);
    } else if (storeId) {
      store = await db.query.stores.findFirst({
        where: eq(stores.id, storeId),
      });
    }

    if (!store) {
      return NextResponse.json(
        { success: false, error: "Loja não encontrada." },
        { status: 404 }
      );
    }

    // Query published & active clips for this specific store only
    const items = await db.query.clips.findMany({
      where: and(
        eq(clips.storeId, store.id),
        eq(clips.status, "READY"),
        eq(clips.isActive, true)
      ),
      orderBy: [asc(clips.position)],
    });

    const cdnHostname = process.env.BUNNY_STREAM_CDN_HOSTNAME
      ? process.env.BUNNY_STREAM_CDN_HOSTNAME.replace(/^https?:\/\//, "").replace(/\/$/, "")
      : "vz-73b50578-eab.b-cdn.net";

    const formattedClips = items.map((clip) => {
      const videoId = clip.bunnyVideoId;
      const thumbnailUrl =
        clip.thumbnailUrl || `https://${cdnHostname}/${videoId}/thumbnail.jpg`;
      const playbackUrl = `https://${cdnHostname}/${videoId}/playlist.m3u8`;
      const directUrl = `https://${cdnHostname}/${videoId}/play_720p.mp4`;

      return {
        id: clip.id,
        title: clip.title,
        description: clip.description,
        bunnyVideoId: videoId,
        thumbnailUrl,
        playbackUrl,
        directUrl,
        duration: clip.duration,
        position: clip.position,
      };
    });

    return NextResponse.json({
      success: true,
      clips: formattedClips,
    });
  } catch (error: any) {
    console.error("[PublicClipsAPI] Error fetching clips:", error);
    return NextResponse.json(
      { success: false, error: error?.message || "Erro interno ao buscar clips." },
      { status: 500 }
    );
  }
}

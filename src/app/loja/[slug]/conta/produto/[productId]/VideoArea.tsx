"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CheckCircle2, Loader2, Lock, PlayCircle } from "lucide-react";
import { ProductVideoPlayer } from "@/components/miniapp/ProductVideoPlayer";
import { playbackAction, progressAction } from "../../../actions";
import { CARD } from "../../../_components/ui";

interface V {
  id: string;
  title: string;
  description: string | null;
  durationSeconds: number;
  thumbnailUrl: string | null;
  percent: number;
  completed: boolean;
}

const dur = (s: number) => (s > 0 ? `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}` : "");

export function VideoArea({ slug, productId, videos }: { slug: string; productId: string; videos: V[] }) {
  const [current, setCurrent] = useState(videos.find((v) => !v.completed)?.id || videos[0].id);
  type Playback = Extract<Awaited<ReturnType<typeof playbackAction>>, { ok: true }>["data"];
  const [data, setData] = useState<Playback | null>(null);
  const [error, setError] = useState<string | null>(null);
  const lastSent = useRef(0);

  useEffect(() => {
    let alive = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- troca de vídeo reinicia o player
    setData(null);
    setError(null);
    playbackAction(slug, current, productId).then((r) => {
      if (!alive) return;
      if (r.ok) setData(r.data);
      else setError(r.error);
    });
    return () => {
      alive = false;
    };
  }, [slug, current, productId]);

  const onProgress = useCallback(
    (pos: number, d: number) => {
      const now = Date.now();
      if (now - lastSent.current < 10_000) return;
      lastSent.current = now;
      void progressAction(slug, current, Math.floor(pos), Math.floor(d || 0));
    },
    [slug, current]
  );

  return (
    <div className="grid lg:grid-cols-[minmax(0,1fr)_340px] gap-5 items-start">
      <div className="rounded-[18px] overflow-hidden border border-white/[0.07] bg-black min-h-[320px] flex items-center justify-center">
        {error ? (
          <div className="p-10 text-center">
            <Lock className="w-9 h-9 text-zinc-600 mx-auto mb-3" />
            <p className="text-[14px] text-zinc-400">{error}</p>
          </div>
        ) : !data ? (
          <Loader2 className="w-8 h-8 text-[#7fb0ff] animate-spin" />
        ) : (
          <div className="w-full">
            <ProductVideoPlayer
              key={data.video.id}
              videoId={data.video.id}
              playbackUrl={data.playback.playbackUrl}
              directUrl={data.playback.directUrl}
              posterUrl={data.video.thumbnailUrl || undefined}
              title={data.video.title}
              description={data.video.description}
              productTitle={data.video.productTitle}
              initialPositionSeconds={data.progress?.positionSeconds || 0}
              completed={Boolean(data.progress?.completed)}
              watermark={data.watermark}
              syncProgress={false}
              onProgressUpdate={onProgress}
            />
          </div>
        )}
      </div>

      <aside className={`${CARD} p-2`}>
        <p className="px-3 pt-2 pb-2 text-[12px] font-medium text-zinc-500">{videos.length} {videos.length === 1 ? "vídeo" : "vídeos"}</p>
        <ul className="space-y-1">
          {videos.map((v, i) => (
            <li key={v.id}>
              <button
                type="button"
                onClick={() => setCurrent(v.id)}
                aria-current={current === v.id}
                className={`w-full flex items-center gap-3 p-2.5 rounded-[11px] text-left transition-colors ${current === v.id ? "bg-[#3b82f6]/12 ring-1 ring-[#3b82f6]/40" : "hover:bg-white/[0.04]"}`}
              >
                <span className="relative w-[72px] h-[44px] rounded-[8px] overflow-hidden bg-[#1a1a1d] shrink-0">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {v.thumbnailUrl && <img src={v.thumbnailUrl} alt="" className="w-full h-full object-cover" />}
                  {v.percent > 0 && <span className="absolute left-0 bottom-0 h-[3px] bg-[#3b82f6]" style={{ width: `${Math.min(100, v.percent)}%` }} />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[13px] font-medium leading-snug line-clamp-2">
                    {i + 1}. {v.title}
                  </span>
                  <span className="block text-[11.5px] text-zinc-500">{dur(v.durationSeconds)}</span>
                </span>
                {v.completed ? <CheckCircle2 className="w-4 h-4 text-[#3b82f6] shrink-0" /> : current === v.id ? <PlayCircle className="w-4 h-4 text-[#7fb0ff] shrink-0" /> : null}
              </button>
            </li>
          ))}
        </ul>
      </aside>
    </div>
  );
}

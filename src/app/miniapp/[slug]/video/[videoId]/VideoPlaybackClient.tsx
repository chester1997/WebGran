"use client";

import React, { useEffect, useState } from "react";
import { ProductVideoPlayer } from "@/components/miniapp/ProductVideoPlayer";
import { AlertCircle, ArrowLeft, Loader2, Lock } from "lucide-react";
import Link from "next/link";

interface VideoPlaybackClientProps {
  storeSlug: string;
  videoId: string;
}

export function VideoPlaybackClient({ storeSlug, videoId }: VideoPlaybackClientProps) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    setError(null);

    fetch(`/api/miniapp/videos/${videoId}/playback?storeSlug=${encodeURIComponent(storeSlug)}`, {
      headers: {
        "x-store-slug": storeSlug,
      },
    })
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok || !json.success) {
          throw new Error(json.error || "Não foi possível carregar a autorização do vídeo.");
        }
        if (isMounted) {
          setData(json);
        }
      })
      .catch((err) => {
        if (isMounted) {
          setError(err.message || "Erro de conexão ou sem permissão para assistir.");
        }
      })
      .finally(() => {
        if (isMounted) {
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [storeSlug, videoId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 text-foreground">
        <Loader2 className="w-10 h-10 text-primary animate-spin mb-4" />
        <p className="text-sm font-medium text-muted-foreground">Validando autorização de acesso...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 text-foreground text-center">
        <div className="w-16 h-16 rounded-2xl bg-red-500/10 text-red-500 flex items-center justify-center mb-4">
          <Lock className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold mb-2">Acesso Restrito</h2>
        <p className="text-sm text-muted-foreground max-w-md mb-6">{error}</p>
        <Link
          href={`/miniapp/${storeSlug}/accesses`}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground font-medium rounded-xl hover:opacity-90 transition"
        >
          <ArrowLeft className="w-4 h-4" />
          Voltar para Meus Acessos
        </Link>
      </div>
    );
  }

  if (!data?.video || !data?.playback) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 text-foreground text-center">
        <AlertCircle className="w-12 h-12 text-amber-500 mb-3" />
        <p className="text-base font-semibold mb-4">Vídeo não encontrado ou indisponível.</p>
        <Link
          href={`/miniapp/${storeSlug}`}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground font-medium rounded-xl hover:opacity-90 transition"
        >
          <ArrowLeft className="w-4 h-4" />
          Voltar para a Loja
        </Link>
      </div>
    );
  }

  const { video, playback, progress } = data;

  return (
    <div className="min-h-screen bg-background text-foreground pb-12">
      {/* Top Header */}
      <div className="sticky top-0 z-40 bg-background/80 backdrop-blur-md border-b border-border/40 px-4 py-3 flex items-center justify-between">
        <Link
          href={`/miniapp/${storeSlug}/accesses`}
          className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition"
        >
          <ArrowLeft className="w-4 h-4" />
          Voltar
        </Link>
        <div className="text-xs font-semibold px-3 py-1 rounded-full bg-primary/10 text-primary truncate max-w-[200px]">
          {video.productTitle || "Vídeo do Produto"}
        </div>
      </div>

      <div className="max-w-4xl mx-auto p-4 flex flex-col gap-6">
        {/* Player Component */}
        <ProductVideoPlayer
          videoId={video.id}
          playbackUrl={playback.playbackUrl}
          directUrl={playback.directUrl}
          posterUrl={video.thumbnailUrl}
          title={video.title}
          initialPositionSeconds={progress?.positionSeconds || 0}
        />

        {/* Video Metadata */}
        <div className="flex flex-col gap-2 bg-card p-5 rounded-2xl border border-border/40">
          <h1 className="text-xl font-bold tracking-tight">{video.title}</h1>
          {video.description && (
            <p className="text-sm text-muted-foreground leading-relaxed">{video.description}</p>
          )}
          {progress?.completed && (
            <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-500 bg-emerald-500/10 px-3 py-1 rounded-lg w-fit mt-2">
              ✓ Vídeo concluído
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

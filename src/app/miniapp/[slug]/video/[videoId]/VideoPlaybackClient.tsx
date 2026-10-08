"use client";

import React, { useEffect, useState } from "react";
import { ProductVideoPlayer } from "@/components/miniapp/ProductVideoPlayer";
import { AlertCircle, ArrowLeft, Loader2, Lock } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface VideoPlaybackClientProps {
  storeSlug: string;
  videoId: string;
  initialToken?: string;
}

export function VideoPlaybackClient({ storeSlug, videoId, initialToken }: VideoPlaybackClientProps) {
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    setError(null);

    let token = initialToken || "";
    if (!token && typeof window !== "undefined") {
      const sp = new URLSearchParams(window.location.search);
      token = sp.get("token") || sp.get("triggerToken") || sp.get("t") || "";
    }

    const tokenQuery = token ? `&token=${encodeURIComponent(token)}` : "";

    fetch(`/api/miniapp/videos/${videoId}/playback?storeSlug=${encodeURIComponent(storeSlug)}${tokenQuery}`, {
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

  const handleBack = () => {
    if (data?.video?.productSlug) {
      router.push(`/miniapp/${storeSlug}/product/${data.video.productSlug}`);
    } else if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
    } else {
      router.push(`/miniapp/${storeSlug}/accesses`);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center p-6 text-white">
        <Loader2 className="w-10 h-10 text-red-500 animate-spin mb-4" />
        <p className="text-sm font-semibold text-zinc-400">Validando autorização de acesso...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center p-6 text-white text-center">
        <div className="w-16 h-16 rounded-2xl bg-red-500/10 text-red-500 flex items-center justify-center mb-4 border border-red-500/20">
          <Lock className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold mb-2">Acesso Restrito</h2>
        <p className="text-sm text-zinc-400 max-w-md mb-6">{error}</p>
        <Link
          href={`/miniapp/${storeSlug}/accesses`}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-red-600 hover:bg-red-500 text-white font-bold rounded-xl transition shadow-lg"
        >
          <ArrowLeft className="w-4 h-4" />
          Voltar para Meus Acessos
        </Link>
      </div>
    );
  }

  if (!data?.video || !data?.playback) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center p-6 text-white text-center">
        <AlertCircle className="w-12 h-12 text-amber-500 mb-3" />
        <p className="text-base font-semibold mb-4">Vídeo não encontrado ou indisponível.</p>
        <Link
          href={`/miniapp/${storeSlug}`}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-red-600 hover:bg-red-500 text-white font-bold rounded-xl transition shadow-lg"
        >
          <ArrowLeft className="w-4 h-4" />
          Voltar para a Loja
        </Link>
      </div>
    );
  }

  const { video, playback, progress, watermark } = data;

  return (
    <div className="min-h-screen bg-black text-white p-0 sm:p-4 flex flex-col items-center justify-center">
      <ProductVideoPlayer
        videoId={video.id}
        playbackUrl={playback.playbackUrl}
        directUrl={playback.directUrl}
        posterUrl={video.thumbnailUrl}
        title={video.title}
        description={video.description}
        productTitle={video.productTitle}
        initialPositionSeconds={progress?.positionSeconds || 0}
        completed={Boolean(progress?.completed)}
        watermark={watermark}
        onBack={handleBack}
      />
    </div>
  );
}

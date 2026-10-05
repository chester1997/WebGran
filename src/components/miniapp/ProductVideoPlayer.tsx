"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import Hls from "hls.js";
import {
  Play,
  Pause,
  RotateCcw,
  AlertCircle,
  Loader2,
  Volume2,
  VolumeX,
  Maximize,
  Minimize,
  ArrowLeft,
  CheckCircle2,
} from "lucide-react";

export interface WatermarkData {
  brand?: string;
  label?: string;
}

export interface ProductVideoPlayerProps {
  videoId: string;
  playbackUrl: string;
  directUrl?: string;
  posterUrl?: string;
  title?: string;
  description?: string | null;
  productTitle?: string | null;
  initialPositionSeconds?: number;
  completed?: boolean;
  watermark?: WatermarkData | null;
  onProgressUpdate?: (positionSeconds: number, durationSeconds: number) => void;
  onBack?: () => void;
}

type WatermarkPosition =
  | "top-left"
  | "top-right"
  | "center-left"
  | "center-right"
  | "bottom-left"
  | "bottom-right";

const WATERMARK_POSITIONS: WatermarkPosition[] = [
  "top-left",
  "top-right",
  "center-left",
  "center-right",
  "bottom-left",
  "bottom-right",
];

export function ProductVideoPlayer({
  videoId,
  playbackUrl,
  directUrl,
  posterUrl,
  title,
  description,
  productTitle,
  initialPositionSeconds = 0,
  completed = false,
  watermark,
  onProgressUpdate,
  onBack,
}: ProductVideoPlayerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const hlsRef = useRef<Hls | null>(null);
  const progressTimerRef = useRef<NodeJS.Timeout | null>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [hasResumed, setHasResumed] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isVideoVertical, setIsVideoVertical] = useState<boolean>(true); // Default to vertical 9:16
  const [showDescription, setShowDescription] = useState(false);
  const [watermarkIndex, setWatermarkIndex] = useState(0);

  // Rotate watermark position every 10 seconds without interrupting video playback
  useEffect(() => {
    const timer = setInterval(() => {
      setWatermarkIndex((prev) => (prev + 1) % WATERMARK_POSITIONS.length);
    }, 10000);

    return () => clearInterval(timer);
  }, []);

  // Sync progress server-side periodically
  const sendProgress = useCallback(
    (pos: number, dur: number) => {
      if (pos < 0 || isNaN(pos)) return;
      if (onProgressUpdate) {
        onProgressUpdate(pos, dur);
      }
      fetch(`/api/miniapp/videos/${videoId}/progress`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          positionSeconds: Math.floor(pos),
          durationSeconds: Math.floor(dur || 0),
        }),
      }).catch((err) => console.warn("[VideoPlayer] Progress sync failed:", err));
    },
    [videoId, onProgressUpdate]
  );

  // Initialize HLS / Native Video Playback
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !playbackUrl) return;

    setIsLoading(true);
    setError(null);

    const cleanupHls = () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };

    // 1. Native HLS support (iOS Safari & Telegram iOS WebView)
    if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = playbackUrl;
      video.load();
    }
    // 2. HLS.js support (Android Chrome, Telegram Android WebView, Desktop)
    else if (Hls.isSupported()) {
      cleanupHls();
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: false,
      });
      hlsRef.current = hls;
      hls.loadSource(playbackUrl);
      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        setIsLoading(false);
      });

      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (data.fatal) {
          console.warn("[VideoPlayer] HLS.js fatal error, trying direct MP4 fallback:", data.type);
          hls.destroy();
          hlsRef.current = null;
          if (directUrl && video) {
            video.src = directUrl;
            video.load();
          } else {
            setError("Erro ao carregar o vídeo via streaming.");
          }
        }
      });
    }
    // 3. Fallback to direct MP4 if HLS is unsupported
    else if (directUrl) {
      video.src = directUrl;
      video.load();
    } else {
      setError("Seu navegador não suporta reprodução HLS de vídeo.");
      setIsLoading(false);
    }

    return () => {
      cleanupHls();
    };
  }, [playbackUrl, directUrl]);

  // Handle Initial Position Seek Resume & Aspect Ratio Detection
  const handleLoadedMetadata = () => {
    setIsLoading(false);
    if (videoRef.current) {
      const dur = videoRef.current.duration || 0;
      setDuration(dur);

      const width = videoRef.current.videoWidth;
      const height = videoRef.current.videoHeight;
      if (width > 0 && height > 0) {
        // If height >= width, it's portrait/vertical video
        setIsVideoVertical(height >= width);
      }

      if (initialPositionSeconds > 0 && !hasResumed && initialPositionSeconds < dur - 3) {
        videoRef.current.currentTime = initialPositionSeconds;
        setCurrentTime(initialPositionSeconds);
        setHasResumed(true);
      }
    }
  };

  // Setup periodic progress sync (every 10 seconds)
  useEffect(() => {
    if (isPlaying) {
      progressTimerRef.current = setInterval(() => {
        if (videoRef.current) {
          sendProgress(videoRef.current.currentTime, videoRef.current.duration || duration);
        }
      }, 10000);
    } else if (progressTimerRef.current) {
      clearInterval(progressTimerRef.current);
    }

    return () => {
      if (progressTimerRef.current) {
        clearInterval(progressTimerRef.current);
      }
    };
  }, [isPlaying, duration, sendProgress]);

  // Handle Time Update
  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
      if (!duration && videoRef.current.duration) {
        setDuration(videoRef.current.duration);
      }
    }
  };

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
      setIsPlaying(false);
      sendProgress(videoRef.current.currentTime, videoRef.current.duration || duration);
    } else {
      videoRef.current
        .play()
        .then(() => {
          setIsPlaying(true);
          setIsLoading(false);
        })
        .catch((err) => {
          console.warn("[VideoPlayer] Play prevented:", err);
          setIsPlaying(false);
        });
    }
  };

  const toggleMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  const toggleFullscreen = () => {
    const elem = containerRef.current;
    if (!elem) return;

    if (!document.fullscreenElement) {
      if (elem.requestFullscreen) {
        elem.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
      } else if ((elem as any).webkitRequestFullscreen) {
        (elem as any).webkitRequestFullscreen();
        setIsFullscreen(true);
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
      } else if ((document as any).webkitExitFullscreen) {
        (document as any).webkitExitFullscreen();
        setIsFullscreen(false);
      }
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTime = parseFloat(e.target.value);
    setCurrentTime(newTime);
    if (videoRef.current) {
      videoRef.current.currentTime = newTime;
      sendProgress(newTime, duration);
    }
  };

  const formatTime = (sec: number) => {
    if (isNaN(sec) || sec < 0) return "00:00";
    const minutes = Math.floor(sec / 60);
    const seconds = Math.floor(sec % 60);
    return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
  };

  const currentWatermarkPosition = WATERMARK_POSITIONS[watermarkIndex];

  const getWatermarkPositionClass = (pos: WatermarkPosition): string => {
    switch (pos) {
      case "top-left":
        return "top-20 left-4 text-left";
      case "top-right":
        return "top-20 right-4 text-right";
      case "center-left":
        return "top-1/2 -translate-y-1/2 left-4 text-left";
      case "center-right":
        return "top-1/2 -translate-y-1/2 right-4 text-right";
      case "bottom-left":
        return "bottom-32 left-4 text-left";
      case "bottom-right":
        return "bottom-32 right-4 text-right";
      default:
        return "top-20 right-4 text-right";
    }
  };

  return (
    <div
      ref={containerRef}
      className={`relative w-full mx-auto bg-black text-white overflow-hidden shadow-2xl select-none flex flex-col justify-between transition-all ${
        isFullscreen
          ? "fixed inset-0 z-50 rounded-none h-screen w-screen"
          : "w-full h-dvh sm:max-w-[480px] sm:h-[min(100dvh,860px)] sm:rounded-3xl sm:border sm:border-white/10"
      }`}
    >
      {/* Background Video Element */}
      <div className="absolute inset-0 w-full h-full bg-black flex items-center justify-center overflow-hidden">
        <video
          ref={videoRef}
          poster={posterUrl}
          playsInline
          className={`w-full h-full cursor-pointer ${
            isVideoVertical ? "object-cover" : "object-contain bg-black"
          }`}
          onLoadedMetadata={handleLoadedMetadata}
          onTimeUpdate={handleTimeUpdate}
          onPlay={() => setIsPlaying(true)}
          onPause={() => {
            setIsPlaying(false);
            if (videoRef.current) sendProgress(videoRef.current.currentTime, videoRef.current.duration || duration);
          }}
          onEnded={() => {
            setIsPlaying(false);
            if (videoRef.current) sendProgress(videoRef.current.duration || duration, videoRef.current.duration || duration);
          }}
          onClick={togglePlay}
        />

        {/* DYNAMIC WATERMARK OVERLAY */}
        {watermark && (watermark.brand || watermark.label) && (
          <div
            className={`absolute z-20 pointer-events-none select-none transition-all duration-700 ease-in-out ${getWatermarkPositionClass(
              currentWatermarkPosition
            )}`}
          >
            <div className="flex flex-col opacity-35 dark:opacity-40 tracking-wider">
              <span className="text-[10px] sm:text-xs font-black text-white uppercase drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)]">
                {watermark.brand || "WEBGRAN"}
              </span>
              {watermark.label && (
                <span className="text-[9px] sm:text-[10px] font-bold text-zinc-100 drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)]">
                  {watermark.label}
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* TOP OVERLAY HEADER - ONLY VOLTAR ARROW BUTTON */}
      <div className="relative z-20 flex items-center justify-between p-4 pt-[max(1rem,env(safe-area-inset-top))] bg-gradient-to-b from-black/80 via-black/40 to-transparent">
        {onBack ? (
          <button
            type="button"
            onClick={onBack}
            aria-label="Voltar para a página do produto"
            className="w-10 h-10 rounded-full bg-black/60 backdrop-blur-md flex items-center justify-center text-white hover:bg-black/80 transition-colors border border-white/10 active:scale-95 cursor-pointer shadow-lg"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
        ) : (
          <div className="w-10" />
        )}
      </div>

      {/* CENTER OVERLAY (Poster / Loading / Play Button / Error) */}
      <div className="relative z-10 flex-1 flex items-center justify-center pointer-events-none">
        {/* Loading Overlay */}
        {isLoading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/50 backdrop-blur-sm z-30 pointer-events-auto">
            {posterUrl && (
              <img src={posterUrl} alt="Thumbnail" className="absolute inset-0 w-full h-full object-cover opacity-40" />
            )}
            <Loader2 className="w-12 h-12 text-red-500 animate-spin mb-3 relative z-10" />
            <span className="text-white text-sm font-semibold relative z-10 shadow-sm">Carregando vídeo...</span>
          </div>
        )}

        {/* Error Overlay */}
        {error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/95 p-6 z-30 text-center pointer-events-auto">
            <AlertCircle className="w-12 h-12 text-red-500 mb-3" />
            <p className="text-white text-sm font-semibold mb-4 max-w-xs">{error}</p>
            <button
              onClick={() => {
                setError(null);
                if (videoRef.current) videoRef.current.load();
              }}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-red-600 hover:bg-red-500 text-white font-bold rounded-xl shadow-lg transition"
            >
              <RotateCcw className="w-4 h-4" />
              Tentar Novamente
            </button>
          </div>
        )}

        {/* Center Tap Play Button (When Paused & Ready) */}
        {!isPlaying && !isLoading && !error && (
          <button
            type="button"
            onClick={togglePlay}
            className="w-16 h-16 rounded-full bg-red-600/90 text-white flex items-center justify-center shadow-2xl backdrop-blur-sm transform hover:scale-110 active:scale-95 transition pointer-events-auto cursor-pointer border border-white/20"
          >
            <Play className="w-8 h-8 fill-current ml-1" />
          </button>
        )}
      </div>

      {/* BOTTOM OVERLAY (Title, Description, Progress & Controls) */}
      <div className="relative z-20 bg-gradient-to-t from-black/95 via-black/75 to-transparent p-4 sm:p-5 pt-12 pb-[max(1.25rem,env(safe-area-inset-bottom))] flex flex-col gap-3">
        {/* Title & Description compact section */}
        <div className="space-y-1 text-left">
          {title && (
            <h2 className="text-base sm:text-lg font-bold text-white tracking-tight leading-snug drop-shadow-md">
              {title}
            </h2>
          )}

          {completed && (
            <div className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-emerald-500/20 text-emerald-400 text-xs font-semibold border border-emerald-500/30">
              <CheckCircle2 className="w-3.5 h-3.5" /> Concluído
            </div>
          )}

          {description && (
            <div>
              <p
                onClick={() => setShowDescription(!showDescription)}
                className={`text-xs text-zinc-300 leading-relaxed cursor-pointer transition-all ${
                  showDescription ? "" : "line-clamp-2"
                }`}
              >
                {description}
              </p>
              {description.length > 90 && (
                <button
                  onClick={() => setShowDescription(!showDescription)}
                  className="text-[11px] font-semibold text-zinc-400 hover:text-white mt-0.5 cursor-pointer underline"
                >
                  {showDescription ? "Mostrar menos" : "Ler mais"}
                </button>
              )}
            </div>
          )}
        </div>

        {/* Scrubbable Progress Bar */}
        <div className="flex items-center gap-3">
          <span className="text-zinc-300 text-[11px] font-mono min-w-[38px]">
            {formatTime(currentTime)}
          </span>

          <input
            type="range"
            min={0}
            max={duration || 100}
            step={0.1}
            value={currentTime}
            onChange={handleSeek}
            className="w-full h-1.5 bg-white/20 rounded-lg appearance-none cursor-pointer accent-red-600 focus:outline-none"
          />

          <span className="text-zinc-300 text-[11px] font-mono min-w-[38px] text-right">
            {formatTime(duration)}
          </span>
        </div>

        {/* Action Controls Row */}
        <div className="flex items-center justify-between pt-1">
          <button
            type="button"
            onClick={togglePlay}
            className="p-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition cursor-pointer border border-white/10 active:scale-95"
            title={isPlaying ? "Pausar" : "Reproduzir"}
          >
            {isPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current" />}
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={toggleMute}
              className="p-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition cursor-pointer border border-white/10 active:scale-95"
              title={isMuted ? "Ativar Som" : "Mutar"}
            >
              {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
            </button>

            <button
              type="button"
              onClick={toggleFullscreen}
              className="p-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition cursor-pointer border border-white/10 active:scale-95"
              title={isFullscreen ? "Sair da Tela Cheia" : "Tela Cheia"}
            >
              {isFullscreen ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  RefreshCw,
  Film,
  ChevronUp,
  ChevronDown,
  Sparkles,
} from "lucide-react";
import Hls from "hls.js";

export interface ClipItem {
  id: string;
  title: string;
  description: string | null;
  bunnyVideoId: string;
  thumbnailUrl: string;
  playbackUrl: string;
  directUrl: string;
  duration: number | null;
  position: number;
}

interface StudioClipsProps {
  storeSlug: string;
}

export function StudioClips({ storeSlug }: StudioClipsProps) {
  const [clips, setClips] = useState<ClipItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);

  const [isPlaying, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(true);
  const [progress, setProgress] = useState(0);
  const [showTapFeedback, setShowTapFeedback] = useState(false);

  // Swipe gesture tracking & Refs
  const touchStartY = useRef<number | null>(null);
  const touchMoveY = useRef<number | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const hlsRef = useRef<Hls | null>(null);
  const progressBarRef = useRef<HTMLDivElement | null>(null);
  const tapFeedbackTimer = useRef<NodeJS.Timeout | null>(null);

  const fetchClips = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/public/clips?storeSlug=${encodeURIComponent(storeSlug)}`);
      if (!res.ok) {
        throw new Error(`HTTP error ${res.status}`);
      }
      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || "Falha ao carregar clips");
      }
      setClips(data.clips || []);
      setCurrentIndex(0);
    } catch (err: any) {
      console.error("[StudioClips] Fetch error:", err);
      setError(err?.message || "Erro ao carregar clips da loja.");
    } finally {
      setLoading(false);
    }
  }, [storeSlug]);

  useEffect(() => {
    fetchClips();
  }, [fetchClips]);

  const currentClip = clips[currentIndex] || null;
  const nextClip = clips[currentIndex + 1] || null;

  // Trigger brief visual feedback animation on screen tap
  const triggerTapFeedback = () => {
    setShowTapFeedback(true);
    if (tapFeedbackTimer.current) clearTimeout(tapFeedbackTimer.current);
    tapFeedbackTimer.current = setTimeout(() => {
      setShowTapFeedback(false);
    }, 400);
  };

  // Handle Play/Pause toggle on video tap
  const togglePlay = () => {
    if (!videoRef.current) return;
    triggerTapFeedback();
    if (videoRef.current.paused) {
      videoRef.current
        .play()
        .then(() => setIsPlaying(true))
        .catch(() => setIsPlaying(false));
    } else {
      videoRef.current.pause();
      setIsPlaying(false);
    }
  };

  // Handle Mute/Unmute toggle
  const toggleMute = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsMuted((prev) => !prev);
    if (videoRef.current) {
      videoRef.current.muted = !isMuted;
    }
  };

  // Move to next clip
  const handleNext = useCallback(() => {
    if (currentIndex < clips.length - 1) {
      setCurrentIndex((prev) => prev + 1);
      setIsPlaying(true);
      setProgress(0);
    }
  }, [currentIndex, clips.length]);

  // Move to previous clip
  const handlePrev = useCallback(() => {
    if (currentIndex > 0) {
      setCurrentIndex((prev) => prev - 1);
      setIsPlaying(true);
      setProgress(0);
    }
  }, [currentIndex]);

  // Touch Swipe Handlers (Vertical Feed Gesture)
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY;
    touchMoveY.current = e.touches[0].clientY;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    touchMoveY.current = e.touches[0].clientY;
  };

  const handleTouchEnd = () => {
    if (touchStartY.current === null || touchMoveY.current === null) return;
    const deltaY = touchStartY.current - touchMoveY.current;
    const threshold = 60; // 60px vertical threshold for swipe

    if (deltaY > threshold) {
      // Swiped Up -> Next Clip
      handleNext();
    } else if (deltaY < -threshold) {
      // Swiped Down -> Previous Clip
      handlePrev();
    }

    touchStartY.current = null;
    touchMoveY.current = null;
  };

  // Video Time Update & Ended Events
  const handleTimeUpdate = () => {
    if (!videoRef.current) return;
    const cur = videoRef.current.currentTime;
    const dur = videoRef.current.duration;
    if (dur && dur > 0) {
      setProgress((cur / dur) * 100);
    }
  };

  const handleVideoEnded = () => {
    if (currentIndex < clips.length - 1) {
      handleNext();
    } else {
      setIsPlaying(false);
      setProgress(100);
    }
  };

  // Seek video position via progress bar click
  const handleProgressSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    const video = videoRef.current;
    const bar = progressBarRef.current;
    if (!video || !bar || !video.duration) return;

    const rect = bar.getBoundingClientRect();
    const clickX = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
    const newPercentage = clickX / rect.width;
    const targetTime = newPercentage * video.duration;

    video.currentTime = targetTime;
    setProgress(newPercentage * 100);
  };

  // Universal Video Stream Setup (Native HLS -> HLS.js -> Direct MP4 Fallback)
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !currentClip) return;

    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    video.currentTime = 0;

    // 1. Native HLS support (iOS Safari, Mobile Safari, iOS Telegram WebApp)
    if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = currentClip.playbackUrl;
      video
        .play()
        .then(() => setIsPlaying(true))
        .catch((err) => {
          console.warn("[StudioClips] Native HLS autoplay prevented:", err);
          setIsPlaying(false);
        });
    }
    // 2. HLS.js support (Android Chrome, Android Telegram WebApp, Desktop Chrome/Firefox/Edge)
    else if (Hls.isSupported()) {
      const hls = new Hls({
        autoStartLoad: true,
        enableWorker: true,
        lowLatencyMode: false,
      });
      hlsRef.current = hls;

      hls.loadSource(currentClip.playbackUrl);
      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        video
          .play()
          .then(() => setIsPlaying(true))
          .catch((err) => {
            console.warn("[StudioClips] HLS.js autoplay prevented:", err);
            setIsPlaying(false);
          });
      });

      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (data.fatal) {
          console.warn("[StudioClips] HLS.js fatal error, falling back to direct MP4:", data.type);
          hls.destroy();
          hlsRef.current = null;

          video.src = currentClip.directUrl;
          video
            .play()
            .then(() => setIsPlaying(true))
            .catch(() => setIsPlaying(false));
        }
      });
    }
    // 3. Direct MP4 fallback if HLS is unsupported
    else {
      video.src = currentClip.directUrl;
      video
        .play()
        .then(() => setIsPlaying(true))
        .catch((err) => {
          console.warn("[StudioClips] Direct MP4 autoplay prevented:", err);
          setIsPlaying(false);
        });
    }

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [currentIndex, currentClip]);

  // Keyboard navigation (desktop support)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        handleNext();
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        handlePrev();
      } else if (e.key === " ") {
        e.preventDefault();
        togglePlay();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleNext, handlePrev]);

  // Loading State
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[80vh] w-full bg-black text-white p-6 select-none">
        <div className="w-12 h-12 border-4 border-red-600 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-sm font-medium text-zinc-400 animate-pulse">
          Carregando Clips...
        </p>
      </div>
    );
  }

  // Error State
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[80vh] w-full bg-black text-white p-6 text-center select-none">
        <div className="w-16 h-16 rounded-full bg-red-950/60 text-red-500 flex items-center justify-center mb-4 border border-red-800/40">
          <Film className="w-8 h-8" />
        </div>
        <h3 className="text-lg font-bold text-white mb-2">Ops! Algo deu errado</h3>
        <p className="text-sm text-zinc-400 max-w-xs mb-6">{error}</p>
        <button
          onClick={fetchClips}
          aria-label="Tentar novamente"
          className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-red-600 hover:bg-red-700 text-white font-semibold text-sm transition-all shadow-lg shadow-red-600/30"
        >
          <RefreshCw className="w-4 h-4" />
          Tentar Novamente
        </button>
      </div>
    );
  }

  // Empty State
  if (clips.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[80vh] w-full bg-black text-white p-6 text-center select-none">
        <div className="w-16 h-16 rounded-full bg-zinc-900 text-zinc-400 flex items-center justify-center mb-4 border border-zinc-800">
          <Film className="w-8 h-8" />
        </div>
        <h3 className="text-lg font-bold text-white mb-1">Nenhum Clip Disponível</h3>
        <p className="text-sm text-zinc-400 max-w-xs">
          Esta loja ainda não publicou vídeos. Volte em breve!
        </p>
      </div>
    );
  }

  return (
    <div className="relative w-full h-[100dvh] min-h-[100dvh] bg-black flex justify-center items-center overflow-hidden select-none">
      {/* 9:16 Shorts/Reels Container - Responsive Mobile Fullscreen & Desktop Centered Frame */}
      <div
        className="relative w-full max-w-[460px] h-full bg-zinc-950 shadow-2xl flex flex-col justify-between overflow-hidden"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onClick={togglePlay}
      >
        {/* Active Clip Video Element */}
        {currentClip && (
          <video
            ref={videoRef}
            poster={currentClip.thumbnailUrl}
            playsInline
            muted={isMuted}
            onTimeUpdate={handleTimeUpdate}
            onEnded={handleVideoEnded}
            className="absolute inset-0 w-full h-full object-cover z-0"
          />
        )}

        {/* Preload Next Clip Metadata */}
        {nextClip && (
          <video
            src={nextClip.directUrl}
            preload="metadata"
            className="hidden"
            aria-hidden="true"
          />
        )}

        {/* 1. TOP OVERLAY: Counter Badge & Mute Toggle with Safe-Area Top Support */}
        <div className="relative z-20 flex items-center justify-between px-4 pt-[calc(12px+env(safe-area-inset-top,0px))] pb-4 bg-gradient-to-b from-black/80 via-black/30 to-transparent">
          {/* Clips Counter Badge (WebGran Liquid Glass Capsule Style) */}
          <div className="px-3.5 py-1.5 rounded-full bg-black/40 backdrop-blur-md border border-white/15 text-xs font-semibold text-white tracking-wider flex items-center gap-2 shadow-lg">
            <Film className="w-3.5 h-3.5 text-red-500 shrink-0" />
            <span>
              {currentIndex + 1} / {clips.length}
            </span>
          </div>

          {/* Audio Toggle Button (WebGran Liquid Glass Circle Style) */}
          <button
            onClick={toggleMute}
            aria-label={isMuted ? "Ativar som do vídeo" : "Desativar som do vídeo"}
            className="w-10 h-10 rounded-full bg-black/40 backdrop-blur-md border border-white/15 flex items-center justify-center text-white hover:bg-black/60 transition-all active:scale-95 shadow-lg"
          >
            {isMuted ? (
              <VolumeX className="w-5 h-5 text-red-400" />
            ) : (
              <Volume2 className="w-5 h-5 text-white" />
            )}
          </button>
        </div>

        {/* 2. CENTER OVERLAY: Play/Pause Indicator & Tap Feedback */}
        {!isPlaying && (
          <div className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none">
            <div className="w-16 h-16 rounded-full bg-black/50 backdrop-blur-md text-white flex items-center justify-center border border-white/20 shadow-2xl transition-all duration-300 transform scale-100 opacity-100">
              <Play className="w-8 h-8 fill-white translate-x-0.5" />
            </div>
          </div>
        )}

        {showTapFeedback && isPlaying && (
          <div className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none animate-ping opacity-60">
            <div className="w-14 h-14 rounded-full bg-black/40 backdrop-blur-md text-white flex items-center justify-center border border-white/20">
              <Pause className="w-6 h-6 fill-white" />
            </div>
          </div>
        )}

        {/* 3. RIGHT OVERLAY: Discrete Navigation Controls */}
        <div className="absolute right-3 top-1/2 -translate-y-1/2 z-20 flex flex-col gap-3 pointer-events-auto">
          {currentIndex > 0 && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                handlePrev();
              }}
              aria-label="Clip anterior"
              className="w-10 h-10 rounded-full bg-black/40 backdrop-blur-md border border-white/15 text-white flex items-center justify-center hover:bg-black/60 transition-all active:scale-95 shadow-md"
            >
              <ChevronUp className="w-5 h-5" />
            </button>
          )}

          {currentIndex < clips.length - 1 && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleNext();
              }}
              aria-label="Próximo Clip"
              className="w-10 h-10 rounded-full bg-black/40 backdrop-blur-md border border-white/15 text-white flex items-center justify-center hover:bg-black/60 transition-all active:scale-95 shadow-md"
            >
              <ChevronDown className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* 4. BOTTOM OVERLAY: Title, Description & Interactive Progress Bar with Safe-Area Bottom Support */}
        <div className="relative z-20 px-4 pt-16 pb-[calc(85px+env(safe-area-inset-bottom,0px))] bg-gradient-to-t from-black/95 via-black/60 to-transparent flex flex-col gap-3">
          {/* Title & Description Container */}
          {currentClip && (
            <div className="flex flex-col gap-1.5 pr-10 text-left">
              {/* Category / WebGran Badge */}
              <div className="flex items-center gap-1.5">
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-red-600/90 text-[10px] font-bold text-white uppercase tracking-wider shadow-sm">
                  <Sparkles className="w-3 h-3 fill-white" />
                  Mini Drama
                </span>
              </div>

              {/* Title */}
              <h2 className="text-base font-bold text-white drop-shadow-md line-clamp-2 leading-snug tracking-tight">
                {currentClip.title}
              </h2>

              {/* Description */}
              {currentClip.description && (
                <p className="text-xs text-zinc-300 drop-shadow line-clamp-2 leading-relaxed">
                  {currentClip.description}
                </p>
              )}
            </div>
          )}

          {/* Interactive Seekable Progress Bar (WebGran Style) */}
          <div
            ref={progressBarRef}
            onClick={handleProgressSeek}
            className="relative w-full h-2 py-1 flex items-center cursor-pointer group pointer-events-auto"
            role="progressbar"
            aria-valuenow={Math.round(progress)}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Progresso da reprodução do Clip"
          >
            <div className="w-full h-1 bg-white/25 rounded-full overflow-hidden transition-all group-hover:h-1.5">
              <div
                className="h-full bg-red-600 transition-all duration-100 ease-linear rounded-full shadow-sm shadow-red-600/50"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

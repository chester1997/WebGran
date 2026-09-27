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
} from "lucide-react";

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

  // Swipe gesture tracking
  const touchStartY = useRef<number | null>(null);
  const touchMoveY = useRef<number | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

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

  // Handle Play/Pause toggle
  const togglePlay = () => {
    if (!videoRef.current) return;
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

  // Touch Swipe Handlers
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
    const threshold = 60; // 60px swipe threshold to prevent accidental switches

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
    // Loop is disabled between clips per requirement. Auto-advance to next clip.
    if (currentIndex < clips.length - 1) {
      handleNext();
    } else {
      // Reached the last clip
      setIsPlaying(false);
      setProgress(100);
    }
  };

  // Auto-play when clip changes
  useEffect(() => {
    if (videoRef.current && currentClip) {
      videoRef.current.currentTime = 0;
      videoRef.current
        .play()
        .then(() => setIsPlaying(true))
        .catch((err) => {
          console.warn("[StudioClips] Autoplay prevented by browser:", err);
          setIsPlaying(false);
        });
    }
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
    <div className="relative w-full h-[calc(100vh-80px)] min-h-[500px] bg-black flex justify-center items-center overflow-hidden select-none">
      {/* 9:16 Shorts/Reels Container - Responsive Mobile & Desktop Frame */}
      <div
        className="relative w-full max-w-[440px] h-full bg-zinc-950 shadow-2xl flex flex-col justify-between overflow-hidden"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onClick={togglePlay}
      >
        {/* Active Clip Video */}
        {currentClip && (
          <video
            ref={videoRef}
            src={currentClip.directUrl}
            poster={currentClip.thumbnailUrl}
            playsInline
            muted={isMuted}
            onTimeUpdate={handleTimeUpdate}
            onEnded={handleVideoEnded}
            className="absolute inset-0 w-full h-full object-cover z-0"
          />
        )}

        {/* Controlled Preload of Next Clip (hidden, metadata only) */}
        {nextClip && (
          <video
            src={nextClip.directUrl}
            preload="metadata"
            className="hidden"
            aria-hidden="true"
          />
        )}

        {/* TOP OVERLAY: Position Indicator & Mute Button */}
        <div className="relative z-20 flex items-center justify-between p-4 bg-gradient-to-b from-black/80 via-black/30 to-transparent">
          {/* Clips Counter Badge */}
          <div className="px-3 py-1 rounded-full bg-black/50 backdrop-blur-md border border-white/10 text-xs font-semibold text-white tracking-wider flex items-center gap-1.5">
            <Film className="w-3.5 h-3.5 text-red-500" />
            <span>
              {currentIndex + 1} / {clips.length}
            </span>
          </div>

          {/* Mute / Unmute Button */}
          <button
            onClick={toggleMute}
            aria-label={isMuted ? "Ativar som do vídeo" : "Desativar som do vídeo"}
            className="w-10 h-10 rounded-full bg-black/50 backdrop-blur-md border border-white/10 flex items-center justify-center text-white hover:bg-black/70 transition-all active:scale-95"
          >
            {isMuted ? (
              <VolumeX className="w-5 h-5 text-red-400" />
            ) : (
              <Volume2 className="w-5 h-5 text-white" />
            )}
          </button>
        </div>

        {/* CENTER OVERLAY: Play/Pause Indicator (shown when paused) */}
        {!isPlaying && (
          <div className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none">
            <div className="w-16 h-16 rounded-full bg-black/60 backdrop-blur-md text-white flex items-center justify-center border border-white/20 shadow-2xl animate-fade-in">
              <Play className="w-8 h-8 fill-white translate-x-0.5" />
            </div>
          </div>
        )}

        {/* RIGHT OVERLAY: Swipe Navigation Controls */}
        <div className="absolute right-3 top-1/2 -translate-y-1/2 z-20 flex flex-col gap-3 pointer-events-auto">
          {currentIndex > 0 && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                handlePrev();
              }}
              aria-label="Clip anterior"
              className="w-10 h-10 rounded-full bg-black/40 backdrop-blur-md border border-white/10 text-white flex items-center justify-center hover:bg-black/70 transition-all active:scale-95"
            >
              <ChevronUp className="w-6 h-6" />
            </button>
          )}

          {currentIndex < clips.length - 1 && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleNext();
              }}
              aria-label="Próximo Clip"
              className="w-10 h-10 rounded-full bg-black/40 backdrop-blur-md border border-white/10 text-white flex items-center justify-center hover:bg-black/70 transition-all active:scale-95"
            >
              <ChevronDown className="w-6 h-6" />
            </button>
          )}
        </div>

        {/* BOTTOM OVERLAY: Title, Description & Progress Bar */}
        <div className="relative z-20 p-4 pt-12 bg-gradient-to-t from-black/90 via-black/50 to-transparent flex flex-col gap-3">
          {/* Title & Description */}
          {currentClip && (
            <div className="flex flex-col gap-1 pr-12 text-left">
              <h2 className="text-base font-bold text-white drop-shadow-md line-clamp-2 leading-snug">
                {currentClip.title}
              </h2>
              {currentClip.description && (
                <p className="text-xs text-zinc-300 drop-shadow line-clamp-2 leading-relaxed">
                  {currentClip.description}
                </p>
              )}
            </div>
          )}

          {/* Progress Bar */}
          <div
            className="w-full h-1 bg-white/20 rounded-full overflow-hidden"
            role="progressbar"
            aria-valuenow={Math.round(progress)}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Progresso da reprodução do Clip"
          >
            <div
              className="h-full bg-red-600 transition-all duration-150 ease-linear rounded-full"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

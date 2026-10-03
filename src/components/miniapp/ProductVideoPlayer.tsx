"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import Hls from "hls.js";
import { Play, Pause, RotateCcw, AlertCircle, Loader2, Volume2, VolumeX } from "lucide-react";

export interface ProductVideoPlayerProps {
  videoId: string;
  playbackUrl: string;
  directUrl?: string;
  posterUrl?: string;
  title?: string;
  initialPositionSeconds?: number;
  onProgressUpdate?: (positionSeconds: number, durationSeconds: number) => void;
  onBack?: () => void;
}

export function ProductVideoPlayer({
  videoId,
  playbackUrl,
  directUrl,
  posterUrl,
  title,
  initialPositionSeconds = 0,
  onProgressUpdate,
}: ProductVideoPlayerProps) {
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
      }).catch((err) => console.warn("[VideoPlayer] Progress sync failed (non-blocking):", err));
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

  // Handle Initial Position Seek Resume
  const handleLoadedMetadata = () => {
    setIsLoading(false);
    if (videoRef.current) {
      const dur = videoRef.current.duration || 0;
      setDuration(dur);

      if (initialPositionSeconds > 0 && !hasResumed && initialPositionSeconds < dur - 3) {
        videoRef.current.currentTime = initialPositionSeconds;
        setCurrentTime(initialPositionSeconds);
        setHasResumed(true);
      }
    }
  };

  // Setup periodic progress sync (every 12 seconds)
  useEffect(() => {
    if (isPlaying) {
      progressTimerRef.current = setInterval(() => {
        if (videoRef.current) {
          sendProgress(videoRef.current.currentTime, videoRef.current.duration || duration);
        }
      }, 12000);
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

  return (
    <div className="relative w-full max-w-4xl mx-auto bg-black rounded-2xl overflow-hidden shadow-2xl group border border-white/10 select-none">
      {/* Video Element */}
      <video
        ref={videoRef}
        poster={posterUrl}
        playsInline
        className="w-full h-auto aspect-video object-contain bg-black cursor-pointer"
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

      {/* Loading Overlay */}
      {isLoading && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 backdrop-blur-sm z-20">
          <Loader2 className="w-12 h-12 text-primary animate-spin mb-2" />
          <span className="text-white text-sm font-medium">Carregando vídeo...</span>
        </div>
      )}

      {/* Error Overlay */}
      {error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/90 p-6 z-30 text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mb-3" />
          <p className="text-white text-base font-semibold mb-4">{error}</p>
          <button
            onClick={() => {
              setError(null);
              if (videoRef.current) videoRef.current.load();
            }}
            className="flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground font-medium rounded-xl hover:opacity-90 transition"
          >
            <RotateCcw className="w-4 h-4" />
            Tentar Novamente
          </button>
        </div>
      )}

      {/* Center Play Button Overlay (when paused & not loading/error) */}
      {!isPlaying && !isLoading && !error && (
        <button
          onClick={togglePlay}
          className="absolute inset-0 flex items-center justify-center bg-black/30 hover:bg-black/40 transition z-10"
        >
          <div className="w-16 h-16 rounded-full bg-primary/90 text-primary-foreground flex items-center justify-center shadow-lg transform hover:scale-110 transition">
            <Play className="w-8 h-8 fill-current ml-1" />
          </div>
        </button>
      )}

      {/* Custom Control Bar */}
      <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/95 via-black/60 to-transparent p-4 z-20 flex flex-col gap-2 transition-opacity duration-300">
        {/* Title Badge if provided */}
        {title && (
          <div className="text-white text-xs font-semibold truncate opacity-90 px-1">
            {title}
          </div>
        )}

        {/* Progress Bar Slider */}
        <div className="flex items-center gap-3">
          <span className="text-white/80 text-xs font-mono min-w-[42px]">
            {formatTime(currentTime)}
          </span>

          <input
            type="range"
            min={0}
            max={duration || 100}
            value={currentTime}
            onChange={handleSeek}
            className="w-full h-1.5 bg-white/30 rounded-lg appearance-none cursor-pointer accent-primary focus:outline-none"
          />

          <span className="text-white/80 text-xs font-mono min-w-[42px] text-right">
            {formatTime(duration)}
          </span>
        </div>

        {/* Action Controls */}
        <div className="flex items-center justify-between pt-1">
          <button
            onClick={togglePlay}
            className="text-white hover:text-primary transition p-1.5 rounded-lg hover:bg-white/10"
            title={isPlaying ? "Pausar" : "Reproduzir"}
          >
            {isPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current" />}
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={toggleMute}
              className="text-white hover:text-primary transition p-1.5 rounded-lg hover:bg-white/10"
              title={isMuted ? "Ativar som" : "Mutar"}
            >
              {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

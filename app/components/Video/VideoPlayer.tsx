"use client";

import { useEffect, useRef } from "react";

import type Hls from "hls.js";

type Props = {
  src: string;
  /** HLS master playlist vs direct file (mp4/webm). */
  streamKind: "hls" | "progressive";
  poster?: string | null;
  className?: string;
};

export default function VideoPlayer({
  src,
  streamKind,
  poster,
  className,
}: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !src) return;

    const cleanupHls = () => {
      hlsRef.current?.destroy();
      hlsRef.current = null;
    };

    if (streamKind === "progressive") {
      video.src = src;
      return () => {
        video.removeAttribute("src");
        video.load();
      };
    }

    // HLS
    if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = src;
      return () => {
        video.removeAttribute("src");
        video.load();
      };
    }

    let cancelled = false;
    void import("hls.js").then(({ default: Hls }) => {
      if (cancelled || !videoRef.current) return;
      if (Hls.isSupported()) {
        const hls = new Hls({ enableWorker: true });
        hlsRef.current = hls;
        hls.loadSource(src);
        hls.attachMedia(video);
      } else {
        video.src = src;
      }
    });

    return () => {
      cancelled = true;
      cleanupHls();
      video.removeAttribute("src");
      video.load();
    };
  }, [src, streamKind]);

  return (
    <video
      ref={videoRef}
      className={className}
      controls
      playsInline
      poster={poster ?? undefined}
      preload="metadata"
    />
  );
}

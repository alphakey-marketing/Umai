import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';

interface VideoPlayerProps {
  src: string | null;
  onTimeUpdate: (currentMs: number) => void;
  onEnded?: () => void;
  speed?: number;
  className?: string;
}

/**
 * Thin wrapper around <video>.
 * Accepts a `speed` prop (0.6 | 0.8 | 1.0) and applies it to playbackRate.
 */
const VideoPlayer = forwardRef<HTMLVideoElement, VideoPlayerProps>(
  ({ src, onTimeUpdate, onEnded, speed = 1, className = '' }, ref) => {
    const innerRef = useRef<HTMLVideoElement>(null);

    // Forward ref so parent can call .pause() / .play() / .currentTime
    useImperativeHandle(ref, () => innerRef.current as HTMLVideoElement);

    // Apply speed whenever it changes
    useEffect(() => {
      if (innerRef.current) {
        innerRef.current.playbackRate = speed;
        innerRef.current.defaultPlaybackRate = speed;
      }
    }, [speed]);

    return (
      <video
        ref={innerRef}
        src={src ?? undefined}
        onTimeUpdate={e => onTimeUpdate(Math.floor(e.currentTarget.currentTime * 1000))}
        onEnded={onEnded}
        controls
        playsInline
        className={`w-full rounded-xl bg-black ${className}`}
        style={{ maxHeight: '40vh' }}
      />
    );
  }
);

VideoPlayer.displayName = 'VideoPlayer';
export default VideoPlayer;

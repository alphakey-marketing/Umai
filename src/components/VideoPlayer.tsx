import { forwardRef, useEffect } from 'react';

interface VideoPlayerProps {
  src: string | null;
  onTimeUpdate: (currentMs: number) => void;
  onEnded?: () => void;
  className?: string;
}

/**
 * Thin wrapper around <video> that fires onTimeUpdate with ms precision.
 * Pass a ref to get access to the HTMLVideoElement for controls.
 */
const VideoPlayer = forwardRef<HTMLVideoElement, VideoPlayerProps>(
  ({ src, onTimeUpdate, onEnded, className = '' }, ref) => {
    useEffect(() => {
      // nothing to set up here — kept for future effect hooks
    }, [src]);

    return (
      <video
        ref={ref}
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

import { useEffect, useRef } from 'react';
import { RotateCcw } from 'lucide-react';
// lottie_light: SVG renderer only, no eval'd expressions — ~40% of the full player.
import lottie from 'lottie-web/build/player/lottie_light';
import type { AnimationItem } from 'lottie-web';
import { Button } from '@/components/ui/button';

/**
 * Inline preview of a hosted Lottie JSON. Default export so callers can
 * `React.lazy(() => import('./lottie-preview'))` and keep lottie-web out of the
 * main bundle. Destroys and reloads whenever the url (or loop/maxPlays) changes.
 */
export default function LottiePreview({
  url,
  loop = false,
  maxPlays,
  paused = false,
}: {
  url: string;
  loop?: boolean | undefined;
  maxPlays?: number | undefined;
  paused?: boolean | undefined;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const animRef = useRef<AnimationItem | null>(null);
  const playsRef = useRef(0);
  // Read at creation time only — pause/play toggling must not rebuild the animation.
  const pausedRef = useRef(paused);
  pausedRef.current = paused;

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    playsRef.current = 0;
    const anim = lottie.loadAnimation({
      container: el,
      renderer: 'svg',
      loop,
      autoplay: !pausedRef.current,
      path: url,
    });
    animRef.current = anim;
    const bump = () => {
      playsRef.current += 1;
      if (maxPlays !== undefined && playsRef.current >= maxPlays) anim.pause();
    };
    // A non-looping animation fires 'complete' once; a looping one fires
    // 'loopComplete' per cycle instead — count both so maxPlays works either way.
    anim.addEventListener('complete', bump);
    anim.addEventListener('loopComplete', bump);
    return () => {
      animRef.current = null;
      anim.destroy();
    };
  }, [url, loop, maxPlays]);

  useEffect(() => {
    const anim = animRef.current;
    if (!anim) return;
    if (paused) anim.pause();
    else anim.play();
  }, [paused]);

  const replay = () => {
    const anim = animRef.current;
    if (!anim) return;
    playsRef.current = 0;
    anim.goToAndPlay(0, true);
  };

  return (
    <div className="space-y-1.5">
      <div
        ref={containerRef}
        className="h-40 w-full overflow-hidden rounded-md border border-line bg-bg-2"
      />
      <div className="flex justify-end">
        <Button
          type="button"
          variant="ghost"
          size="xs"
          iconLeft={<RotateCcw className="size-3.5" />}
          onClick={replay}
        >
          Replay
        </Button>
      </div>
    </div>
  );
}

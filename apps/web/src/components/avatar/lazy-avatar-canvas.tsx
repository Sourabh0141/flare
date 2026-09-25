'use client';

import dynamic from 'next/dynamic';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { AvatarCanvasProps } from './avatar-canvas';

/**
 * The 3D stack (three.js, React Three Fiber, the models) is the heaviest thing on the
 * marketing pages. It is split into its own chunk and only fetched once the canvas is
 * about to scroll into view.
 */
const AvatarCanvas = dynamic(() => import('./avatar-canvas').then((m) => m.AvatarCanvas), {
  ssr: false,
  loading: () => null,
});

export interface LazyAvatarCanvasProps extends AvatarCanvasProps {
  /** Shown until the canvas is in view and its code has loaded. */
  placeholder?: ReactNode;
  /** Load as soon as the element is within this margin of the viewport. */
  rootMargin?: string;
}

export function LazyAvatarCanvas({
  placeholder,
  rootMargin = '300px',
  className,
  ...props
}: LazyAvatarCanvasProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element || inView) return;
    if (typeof IntersectionObserver === 'undefined') {
      const frame = requestAnimationFrame(() => setInView(true));
      return () => cancelAnimationFrame(frame);
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) setInView(true);
      },
      { rootMargin }
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [inView, rootMargin]);

  return (
    <div ref={ref} className={className}>
      {inView ? <AvatarCanvas {...props} className="h-full w-full" /> : placeholder}
    </div>
  );
}

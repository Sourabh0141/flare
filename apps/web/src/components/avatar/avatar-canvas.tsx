'use client';

import { Canvas } from '@react-three/fiber';
import { ContactShadows, PerspectiveCamera } from '@react-three/drei';
import { Suspense, type ReactNode } from 'react';
import type { VisemeWeights } from '@/lib/audio/visemes';
import { cn } from '@/lib/utils';
import { ErrorBoundary } from '../ui/error-boundary';
import { Character } from './character';
import { StageLights } from './stage-lights';

export interface AvatarCanvasProps {
  getVisemes?: () => VisemeWeights;
  /** How much the eyes follow the pointer: 1 on the landing page, a little in the app. */
  pointerInfluence?: number;
  fullAnimations?: boolean;
  /** Portrait framing for the landing hero, full-body for the assistant stage. */
  framing?: 'portrait' | 'stage';
  fallback?: ReactNode;
  className?: string;
}

export function AvatarCanvas({
  getVisemes,
  pointerInfluence = 0,
  fullAnimations = false,
  framing = 'stage',
  fallback,
  className,
}: AvatarCanvasProps) {
  const camera =
    framing === 'portrait'
      ? { position: [0, 0.2, 1.35] as [number, number, number], fov: 34 }
      : { position: [0, 0.05, 1.7] as [number, number, number], fov: 38 };

  return (
    <div className={cn('relative h-full w-full', className)}>
      <ErrorBoundary
        fallback={
          <div className="absolute inset-0 flex items-center justify-center px-6 text-center text-sm text-smoke">
            The 3D view could not start in this browser. Everything else still works.
          </div>
        }
      >
        <Suspense fallback={fallback ?? null}>
          <Canvas
            shadows
            dpr={[1, 1.75]}
            gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
            className="h-full w-full"
            aria-hidden="true"
          >
            <PerspectiveCamera makeDefault position={camera.position} fov={camera.fov} />
            <StageLights />
            <Character
              {...(getVisemes ? { getVisemes } : {})}
              pointerInfluence={pointerInfluence}
              fullAnimations={fullAnimations}
            />
            <ContactShadows position={[0, -1.45, 0]} opacity={0.55} scale={4} blur={2} far={2.5} />
          </Canvas>
        </Suspense>
      </ErrorBoundary>
    </div>
  );
}

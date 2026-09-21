'use client';

import React, { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { PerspectiveCamera, ContactShadows } from '@react-three/drei';
import { Avatar, CharacterState } from './Avatar';
import { useVisage } from '@/hooks/useVisage';
import { Loader2 } from 'lucide-react';

interface AvatarCanvasProps {
  state: CharacterState;
  audioElement: HTMLAudioElement | null;
  className?: string;
}

function AvatarScene({
  state,
  audioElement,
}: {
  state: CharacterState;
  audioElement: HTMLAudioElement | null;
}) {
  const isSpeaking = state === 'speaking';
  const { getVisemes } = useVisage(audioElement, isSpeaking);

  return (
    <>
      {/* Dynamic Portrait Camera */}
      <PerspectiveCamera makeDefault position={[0, 0.15, 1.45]} fov={38} />

      {/* 3-Point Studio Lighting */}
      <ambientLight intensity={0.85} />
      <directionalLight
        position={[2.5, 4, 3]}
        intensity={1.4}
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
      />
      {/* Purple Atmospheric Rim Light */}
      <directionalLight
        position={[-2.5, 2.5, -2]}
        intensity={0.9}
        color="#a855f7"
      />
      {/* Soft Front Fill Light */}
      <pointLight position={[0, 0.4, 1.2]} intensity={0.45} color="#e0e7ff" />

      {/* 3D Character */}
      <Avatar state={state} getVisemes={getVisemes} />

      {/* Soft Ground Shadow */}
      <ContactShadows
        position={[0, -1.45, 0]}
        opacity={0.65}
        scale={4}
        blur={1.8}
        far={2.5}
      />
    </>
  );
}

function AvatarLoadingFallback() {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-950/40 backdrop-blur-sm z-10">
      <div className="relative flex items-center justify-center">
        <div className="w-16 h-16 rounded-full border-2 border-purple-500/20 border-t-purple-500 animate-spin" />
        <Loader2 className="w-6 h-6 text-purple-400 absolute animate-pulse" />
      </div>
      <span className="text-xs font-medium text-zinc-400 mt-4 tracking-wider uppercase">
        Loading 3D Avatar...
      </span>
    </div>
  );
}

export function AvatarCanvas({
  state,
  audioElement,
  className = '',
}: AvatarCanvasProps) {
  return (
    <div className={`relative w-full h-full flex items-center justify-center overflow-hidden ${className}`}>
      <Suspense fallback={<AvatarLoadingFallback />}>
        <Canvas
          shadows
          gl={{
            antialias: true,
            alpha: true,
            powerPreference: 'high-performance',
          }}
          className="w-full h-full"
        >
          <AvatarScene state={state} audioElement={audioElement} />
        </Canvas>
      </Suspense>
    </div>
  );
}

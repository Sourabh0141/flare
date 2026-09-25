'use client';

import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import * as THREE from 'three';
import { STAGE_LIGHTS } from '@/lib/character/stage';
import { useAssistantStore } from '@/stores/assistant-store';

/** Three-point lighting whose colour and intensity follow the assistant state. */
export function StageLights() {
  const keyRef = useRef<THREE.DirectionalLight>(null);
  const rimRef = useRef<THREE.DirectionalLight>(null);
  const keyColor = useRef(new THREE.Color(STAGE_LIGHTS.idle.key));
  const rimColor = useRef(new THREE.Color(STAGE_LIGHTS.idle.rim));
  const scratch = useRef(new THREE.Color());

  useFrame((_, delta) => {
    const preset = STAGE_LIGHTS[useAssistantStore.getState().state];
    const t = 1 - Math.exp(-3 * delta);
    if (keyRef.current) {
      keyColor.current.lerp(scratch.current.set(preset.key), t);
      keyRef.current.color.copy(keyColor.current);
      keyRef.current.intensity += (preset.keyIntensity - keyRef.current.intensity) * t;
    }
    if (rimRef.current) {
      rimColor.current.lerp(scratch.current.set(preset.rim), t);
      rimRef.current.color.copy(rimColor.current);
      rimRef.current.intensity += (preset.rimIntensity - rimRef.current.intensity) * t;
    }
  });

  return (
    <>
      <hemisphereLight args={['#f3ebdd', '#15120f', 0.55]} />
      <directionalLight
        ref={keyRef}
        position={[2.2, 3.6, 2.8]}
        intensity={STAGE_LIGHTS.idle.keyIntensity}
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-bias={-0.0004}
      />
      <directionalLight
        ref={rimRef}
        position={[-2.6, 2.4, -2.2]}
        intensity={STAGE_LIGHTS.idle.rimIntensity}
      />
      <pointLight position={[0, 0.6, 1.4]} intensity={0.5} color="#f7c491" distance={4} />
    </>
  );
}

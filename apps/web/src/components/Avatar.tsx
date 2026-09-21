'use client';

import React, { useEffect, useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF, useAnimations } from '@react-three/drei';
import * as THREE from 'three';
import { SkeletonUtils } from 'three-stdlib';
import { VisemeWeights } from '@/hooks/useVisage';

export type CharacterState = 'idle' | 'listening' | 'processing' | 'speaking';

interface AvatarProps {
  state: CharacterState;
  getVisemes: () => VisemeWeights;
  modelUrl?: string;
  animationsUrl?: string;
}

// Morph targets to smoothly interpolate each frame
const VISEME_MORPH_NAMES = [
  'viseme_sil',
  'viseme_PP',
  'viseme_FF',
  'viseme_TH',
  'viseme_DD',
  'viseme_kk',
  'viseme_CH',
  'viseme_SS',
  'viseme_nn',
  'viseme_RR',
  'viseme_aa',
  'viseme_E',
  'viseme_I',
  'viseme_O',
  'viseme_U',
  'jawOpen',
  'mouthSmileLeft',
  'mouthSmileRight',
] as const;

export function Avatar({
  state,
  getVisemes,
  modelUrl = '/models/avatar.glb',
  animationsUrl = '/models/animations.glb',
}: AvatarProps) {
  const groupRef = useRef<THREE.Group>(null);

  // Load avatar and animations
  const avatarGltf = useGLTF(modelUrl);
  const animationsGltf = useGLTF(animationsUrl);

  // Clone avatar scene cleanly for independent bone rigging
  const clone = useMemo(() => SkeletonUtils.clone(avatarGltf.scene), [avatarGltf.scene]);

  // Set up animation mixer
  const { actions } = useAnimations(animationsGltf.animations, groupRef);

  // Cache SkinnedMesh references that have morph targets
  const morphMeshes = useMemo(() => {
    const meshes: THREE.SkinnedMesh[] = [];
    clone.traverse((child) => {
      const mesh = child as THREE.SkinnedMesh;
      if (mesh.isSkinnedMesh && mesh.morphTargetDictionary && mesh.morphTargetInfluences) {
        meshes.push(mesh);
      }
    });
    return meshes;
  }, [clone]);

  // Procedural Blinking State
  const blinkStateRef = useRef({
    nextBlinkTime: 2.5,
    isBlinking: false,
    blinkProgress: 0,
  });

  // Talking animation cycle index
  const talkingVariantRef = useRef(0);

  // Switch animation action based on character state
  useEffect(() => {
    if (!actions) return;

    let currentActionName = 'Idle';
    if (state === 'speaking') {
      const talkingClips = ['Talking_0', 'Talking_1', 'Talking_2'];
      talkingVariantRef.current = (talkingVariantRef.current + 1) % talkingClips.length;
      currentActionName = talkingClips[talkingVariantRef.current] || 'Talking_0';
    } else if (state === 'processing') {
      currentActionName = 'Idle';
    } else if (state === 'listening') {
      currentActionName = 'Idle';
    } else {
      currentActionName = 'Idle';
    }

    const action = actions[currentActionName] || actions.Idle;
    if (action) {
      action.reset().fadeIn(0.4).play();
    }

    return () => {
      if (action) {
        action.fadeOut(0.4);
      }
    };
  }, [state, actions]);

  // Main 60fps Animation & Morph Target Loop
  useFrame((sceneState, delta) => {
    // 1. Procedural Eye Blinking (R39)
    const blink = blinkStateRef.current;
    blink.nextBlinkTime -= delta;

    let blinkWeight = 0;
    if (blink.nextBlinkTime <= 0 && !blink.isBlinking) {
      blink.isBlinking = true;
      blink.blinkProgress = 0;
    }

    if (blink.isBlinking) {
      blink.blinkProgress += delta * 12; // Complete blink cycle in ~0.16s
      if (blink.blinkProgress < 1) {
        // Closing eyes
        blinkWeight = blink.blinkProgress;
      } else if (blink.blinkProgress < 2) {
        // Opening eyes
        blinkWeight = 2 - blink.blinkProgress;
      } else {
        blink.isBlinking = false;
        blink.blinkProgress = 0;
        // Schedule next random blink between 2.5 and 5.5 seconds
        blink.nextBlinkTime = 2.5 + Math.random() * 3.0;
        blinkWeight = 0;
      }
    }

    // 2. Real-time ARKit Lip-Sync & Morph Target Influences
    const visemes = getVisemes();
    const lerpSpeed = Math.min(1, delta * 25);

    morphMeshes.forEach((mesh) => {
      if (!mesh.morphTargetDictionary || !mesh.morphTargetInfluences) return;

      // Apply ARKit visemes
      for (const name of VISEME_MORPH_NAMES) {
        const index = mesh.morphTargetDictionary[name];
        if (index !== undefined) {
          const targetWeight = (visemes as unknown as Record<string, number>)[name] || 0;
          mesh.morphTargetInfluences[index] = THREE.MathUtils.lerp(
            mesh.morphTargetInfluences[index] || 0,
            targetWeight,
            lerpSpeed
          );
        }
      }

      // Apply procedural blink to eye morphs
      const leftBlinkIdx = mesh.morphTargetDictionary.eyeBlinkLeft;
      const rightBlinkIdx = mesh.morphTargetDictionary.eyeBlinkRight;

      if (leftBlinkIdx !== undefined) {
        mesh.morphTargetInfluences[leftBlinkIdx] = THREE.MathUtils.lerp(
          mesh.morphTargetInfluences[leftBlinkIdx] || 0,
          blinkWeight,
          Math.min(1, delta * 30)
        );
      }
      if (rightBlinkIdx !== undefined) {
        mesh.morphTargetInfluences[rightBlinkIdx] = THREE.MathUtils.lerp(
          mesh.morphTargetInfluences[rightBlinkIdx] || 0,
          blinkWeight,
          Math.min(1, delta * 30)
        );
      }
    });

    // 3. Natural Breathing & Micro-movements
    if (groupRef.current) {
      const time = sceneState.clock.elapsedTime;
      // Gentle breathing oscillation on Y axis
      const breath = Math.sin(time * 1.8) * 0.003;
      groupRef.current.position.y = -1.45 + breath;

      // Subtle reactive postures depending on state
      if (state === 'listening') {
        // Attentive slight forward lean & subtle tilt
        groupRef.current.rotation.x = THREE.MathUtils.lerp(groupRef.current.rotation.x, 0.04, delta * 4);
        groupRef.current.rotation.y = THREE.MathUtils.lerp(
          groupRef.current.rotation.y,
          Math.sin(time * 0.8) * 0.03,
          delta * 3
        );
      } else if (state === 'processing') {
        // Thinking posture with slight head angle
        groupRef.current.rotation.x = THREE.MathUtils.lerp(groupRef.current.rotation.x, -0.02, delta * 4);
        groupRef.current.rotation.z = THREE.MathUtils.lerp(
          groupRef.current.rotation.z,
          Math.sin(time * 1.2) * 0.025,
          delta * 3
        );
      } else {
        // Natural idle organic micro-sway
        groupRef.current.rotation.x = THREE.MathUtils.lerp(groupRef.current.rotation.x, 0, delta * 3);
        groupRef.current.rotation.z = THREE.MathUtils.lerp(groupRef.current.rotation.z, 0, delta * 3);
        groupRef.current.rotation.y = THREE.MathUtils.lerp(
          groupRef.current.rotation.y,
          Math.sin(time * 0.5) * 0.02,
          delta * 2
        );
      }
    }
  });

  return (
    <group ref={groupRef} position={[0, -1.45, 0]} dispose={null}>
      <primitive object={clone} />
    </group>
  );
}

// Preload assets for fast rendering
useGLTF.preload('/models/avatar.glb');
useGLTF.preload('/models/animations.glb');

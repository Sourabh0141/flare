'use client';

import { useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three-stdlib';
import { SkeletonUtils } from 'three-stdlib';
import { VISEME_NAMES, type VisemeWeights } from '@/lib/audio/visemes';
import {
  breathing,
  clamp,
  createBlinkState,
  createGazeState,
  createHeadGesture,
  damp,
  idleSway,
  stepBlink,
  stepGaze,
  stepHeadGesture,
  type HeadGesture,
} from '@/lib/character/behaviors';
import {
  CLIPS,
  clipForGesture,
  nextTalkingClip,
  reactionForEmotion,
  type ReactionClip,
} from '@/lib/character/clips';
import { EXPRESSIONS, EXPRESSION_SHAPES, STATE_OVERLAYS } from '@/lib/character/expressions';
import { MODEL_URLS } from '@/lib/config';
import { useAssistantStore, type AssistantStore } from '@/stores/assistant-store';

export interface CharacterProps {
  /** Supplies lip-sync weights each frame; omit for a silent character. */
  getVisemes?: () => VisemeWeights;
  /** Eyes follow the pointer (landing page) instead of the conversation state. */
  followPointer?: boolean;
  /** Load the full clip set (talking, laughing, ...) after the idle clip is ready. */
  fullAnimations?: boolean;
  position?: [number, number, number];
}

const HEAD_BONE = 'Head';
const LEFT_EYE_BONE = 'LeftEye';
const RIGHT_EYE_BONE = 'RightEye';

const ALL_SHAPES = Array.from(
  new Set([
    ...EXPRESSION_SHAPES,
    ...VISEME_NAMES,
    'eyeBlinkLeft',
    'eyeBlinkRight',
    'eyeLookUpLeft',
    'eyeLookUpRight',
    'eyeLookDownLeft',
    'eyeLookDownRight',
    'eyeLookInLeft',
    'eyeLookInRight',
    'eyeLookOutLeft',
    'eyeLookOutRight',
  ])
);

interface ActiveReaction {
  action: THREE.AnimationAction;
  endsAt: number;
  fadeSec: number;
}

/**
 * The 3D character. Animation clips give the body its base motion; everything on top
 * (gaze, blink, expression, lip-sync, head gestures, breathing) is procedural and reads
 * the assistant store directly each frame, so nothing re-renders at 60 fps.
 */
export function Character({
  getVisemes,
  followPointer = false,
  fullAnimations = false,
  position = [0, -1.45, 0],
}: CharacterProps) {
  const avatar = useGLTF(MODEL_URLS.avatar);
  const idle = useGLTF(MODEL_URLS.idle);
  const groupRef = useRef<THREE.Group>(null);

  const scene = useMemo(() => {
    const clone = SkeletonUtils.clone(avatar.scene);
    clone.traverse((child) => {
      if ((child as THREE.SkinnedMesh).isSkinnedMesh) {
        child.frustumCulled = false;
      }
    });
    return clone;
  }, [avatar.scene]);

  const morphMeshes = useMemo(() => {
    const meshes: THREE.SkinnedMesh[] = [];
    scene.traverse((child) => {
      const mesh = child as THREE.SkinnedMesh;
      if (mesh.isSkinnedMesh && mesh.morphTargetDictionary && mesh.morphTargetInfluences) {
        meshes.push(mesh);
      }
    });
    return meshes;
  }, [scene]);

  const bones = useMemo(
    () => ({
      head: scene.getObjectByName(HEAD_BONE) as THREE.Bone | undefined,
      leftEye: scene.getObjectByName(LEFT_EYE_BONE) as THREE.Bone | undefined,
      rightEye: scene.getObjectByName(RIGHT_EYE_BONE) as THREE.Bone | undefined,
    }),
    [scene]
  );

  // Animation mixer is driven manually so procedural offsets can be layered after it.
  const mixer = useMemo(() => new THREE.AnimationMixer(scene), [scene]);
  const clips = useRef<Map<string, THREE.AnimationClip>>(new Map());
  const currentBase = useRef<THREE.AnimationAction | null>(null);
  const currentBaseName = useRef<string | null>(null);
  const reaction = useRef<ActiveReaction | null>(null);
  /** Bones the current base clip drives; the rest are reset to their rest pose each frame. */
  const animatedBones = useRef<Set<string>>(new Set());
  const restRotations = useMemo(() => {
    const rest = new Map<string, THREE.Euler>();
    for (const bone of [bones.head, bones.leftEye, bones.rightEye]) {
      if (bone) rest.set(bone.name, bone.rotation.clone());
    }
    return rest;
  }, [bones]);

  useEffect(() => {
    for (const clip of idle.animations) clips.current.set(clip.name, clip);
    playBase(CLIPS.idle);
    return () => {
      mixer.stopAllAction();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idle.animations, mixer]);

  useEffect(() => {
    if (!fullAnimations) return;
    let cancelled = false;
    new GLTFLoader()
      .loadAsync(MODEL_URLS.animations)
      .then((gltf) => {
        if (cancelled) return;
        for (const clip of gltf.animations) clips.current.set(clip.name, clip);
      })
      .catch(() => {
        // The character keeps its idle clip; gestures simply fall back to procedural ones.
      });
    return () => {
      cancelled = true;
    };
  }, [fullAnimations]);

  function playBase(name: string) {
    const clip = clips.current.get(name) ?? clips.current.get(CLIPS.idle);
    if (!clip) return;
    const next = mixer.clipAction(clip);
    if (currentBase.current === next) return;
    next.reset().setEffectiveWeight(1).fadeIn(0.45).play();
    currentBase.current?.fadeOut(0.45);
    currentBase.current = next;
    currentBaseName.current = clip.name;
    animatedBones.current = new Set(clip.tracks.map((track) => track.name.split('.')[0] ?? ''));
  }

  function playReaction(spec: ReactionClip, now: number) {
    const clip = clips.current.get(spec.clip);
    if (!clip) return;
    if (reaction.current) reaction.current.action.fadeOut(0.2);
    const action = mixer.clipAction(clip);
    action
      .reset()
      .setLoop(THREE.LoopRepeat, Infinity)
      .setEffectiveWeight(spec.weight)
      .fadeIn(spec.fadeSec)
      .play();
    reaction.current = { action, endsAt: now + spec.durationSec, fadeSec: spec.fadeSec };
  }

  // Store snapshot kept in a ref; subscriptions never trigger React renders here.
  const snapshot = useRef<Pick<AssistantStore, 'state' | 'emotion' | 'gesture' | 'gestureSeq'>>(
    pick(useAssistantStore.getState())
  );
  const seenGestureSeq = useRef(snapshot.current.gestureSeq);
  const seenState = useRef(snapshot.current.state);
  const headGesture = useRef<HeadGesture | null>(null);

  useEffect(
    () =>
      useAssistantStore.subscribe((s) => {
        snapshot.current = pick(s);
      }),
    []
  );

  const blink = useRef(createBlinkState());
  const gaze = useRef(createGazeState());
  const expressionWeights = useRef<Record<string, number>>({});

  useFrame(({ clock, pointer }, rawDelta) => {
    const delta = Math.min(rawDelta, 0.05);
    const now = clock.elapsedTime;
    const { state, emotion, gesture, gestureSeq } = snapshot.current;
    const speaking = state === 'speaking';

    // 1. Base clip follows the state; talking variants rotate each time speech starts.
    if (state !== seenState.current) {
      if (speaking) {
        playBase(nextTalkingClip(currentBaseName.current));
      } else if (seenState.current === 'speaking') {
        playBase(CLIPS.idle);
      }
      seenState.current = state;
    }

    // 2. Gestures and strong emotions fire once per request.
    if (gestureSeq !== seenGestureSeq.current) {
      seenGestureSeq.current = gestureSeq;
      if (gesture === 'nod' || gesture === 'shake') {
        headGesture.current = createHeadGesture(gesture);
      }
      const spec = clipForGesture(gesture) ?? reactionForEmotion(emotion);
      if (spec) playReaction(spec, now);
    }
    if (reaction.current && now >= reaction.current.endsAt) {
      reaction.current.action.fadeOut(reaction.current.fadeSec);
      reaction.current = null;
    }

    mixer.update(delta);

    // Offsets below are additive, so bones the clip does not animate start from rest.
    for (const bone of [bones.head, bones.leftEye, bones.rightEye]) {
      if (!bone || animatedBones.current.has(bone.name)) continue;
      const rest = restRotations.get(bone.name);
      if (rest) bone.rotation.copy(rest);
    }

    // 3. Gaze target: pointer on the landing page, otherwise conversational.
    const target = followPointer
      ? { x: clamp(-pointer.x, -1, 1) * 0.8, y: clamp(pointer.y, -1, 1) * 0.5 }
      : state === 'thinking'
        ? { x: 0.45, y: 0.5 }
        : { x: 0, y: 0.05 };
    const wander = state === 'listening' ? 0.05 : state === 'thinking' ? 0.25 : 0.15;
    const look = stepGaze(gaze.current, target, delta, {
      wander,
      speed: state === 'thinking' ? 4 : 7,
    });

    for (const eye of [bones.leftEye, bones.rightEye]) {
      if (!eye) continue;
      eye.rotation.y += look.x * 0.35;
      eye.rotation.x += -look.y * 0.25;
    }

    // 4. Head: follows the gaze a little, leans in while listening, plus gestures.
    if (bones.head) {
      const lean = state === 'listening' ? 0.06 : state === 'thinking' ? -0.03 : 0;
      let pitch = -look.y * 0.18 + lean;
      let yaw = look.x * 0.3;
      if (headGesture.current) {
        const offset = stepHeadGesture(headGesture.current, delta);
        if (offset) {
          pitch += offset.pitch;
          yaw += offset.yaw;
        } else {
          headGesture.current = null;
        }
      }
      bones.head.rotation.x += pitch;
      bones.head.rotation.y += yaw;
      bones.head.rotation.z += look.x * -0.05;
    }

    // 5. Blend shapes: expression + state overlay + blink + gaze + lip-sync.
    const blinkWeight = stepBlink(blink.current, delta);
    const preset = EXPRESSIONS[emotion];
    const overlay =
      state === 'listening'
        ? STATE_OVERLAYS.listening
        : state === 'thinking'
          ? STATE_OVERLAYS.thinking
          : null;
    const visemes = speaking && getVisemes ? getVisemes() : null;
    const smoothing = 1 - Math.exp(-14 * delta);

    for (const name of ALL_SHAPES) {
      let goal = (preset[name] ?? 0) + (overlay?.[name] ?? 0);
      if (name === 'eyeBlinkLeft' || name === 'eyeBlinkRight') goal = blinkWeight;
      const current = expressionWeights.current[name] ?? 0;
      expressionWeights.current[name] = current + (goal - current) * smoothing;
    }
    // Eye-look shapes mirror the bone gaze so the iris texture follows too.
    const lookUp = Math.max(0, look.y) * 0.6;
    const lookDown = Math.max(0, -look.y) * 0.6;
    const lookLeft = Math.max(0, look.x) * 0.7;
    const lookRight = Math.max(0, -look.x) * 0.7;
    const eyeLook: Record<string, number> = {
      eyeLookUpLeft: lookUp,
      eyeLookUpRight: lookUp,
      eyeLookDownLeft: lookDown,
      eyeLookDownRight: lookDown,
      eyeLookOutLeft: lookLeft,
      eyeLookInRight: lookLeft,
      eyeLookInLeft: lookRight,
      eyeLookOutRight: lookRight,
    };

    for (const mesh of morphMeshes) {
      const dict = mesh.morphTargetDictionary;
      const influences = mesh.morphTargetInfluences;
      if (!dict || !influences) continue;
      for (const name of ALL_SHAPES) {
        const index = dict[name];
        if (index === undefined) continue;
        let value = expressionWeights.current[name] ?? 0;
        if (name in eyeLook) value = Math.max(value, eyeLook[name] ?? 0);
        if (visemes && name in visemes) {
          value = visemes[name as keyof VisemeWeights];
          // Keep a hint of the smile while talking.
          if (name === 'jawOpen') value = Math.min(1, value);
        }
        influences[index] = damp(influences[index] ?? 0, clamp(value, 0, 1), 22, delta);
      }
      // When silent, mouth shapes relax to zero.
      if (!visemes) {
        for (const name of VISEME_NAMES) {
          const index = dict[name];
          if (index !== undefined) influences[index] = damp(influences[index] ?? 0, 0, 18, delta);
        }
      }
    }

    // 6. Breathing and idle sway on the root.
    if (groupRef.current) {
      const sway = idleSway(now);
      groupRef.current.position.y = position[1] + breathing(now);
      groupRef.current.rotation.x = damp(groupRef.current.rotation.x, sway.x, 2, delta);
      groupRef.current.rotation.y = damp(groupRef.current.rotation.y, sway.y, 2, delta);
      groupRef.current.rotation.z = damp(groupRef.current.rotation.z, sway.z, 2, delta);
    }
  });

  return (
    <group ref={groupRef} position={position} dispose={null}>
      <primitive object={scene} />
    </group>
  );
}

function pick(s: AssistantStore) {
  return { state: s.state, emotion: s.emotion, gesture: s.gesture, gestureSeq: s.gestureSeq };
}

useGLTF.preload(MODEL_URLS.avatar);
useGLTF.preload(MODEL_URLS.idle);

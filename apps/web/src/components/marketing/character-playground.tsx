'use client';

import { EMOTIONS, type Emotion, type Gesture } from '@flare/contracts';
import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { useAssistantStore } from '@/stores/assistant-store';
import { AvatarPlaceholder } from '../avatar/avatar-placeholder';
import { LazyAvatarCanvas } from '../avatar/lazy-avatar-canvas';

const emotionLabels: Record<Emotion, string> = {
  neutral: 'Neutral',
  happy: 'Happy',
  excited: 'Excited',
  amused: 'Amused',
  sad: 'Sad',
  surprised: 'Surprised',
  thoughtful: 'Thoughtful',
  concerned: 'Concerned',
  playful: 'Playful',
  annoyed: 'Annoyed',
};

const gestureLabels: Record<Exclude<Gesture, 'none'>, string> = {
  nod: 'Nod',
  shake: 'Shake head',
  laugh: 'Laugh',
  dance: 'Dance',
};

const states = [
  { id: 'idle', label: 'Idle' },
  { id: 'listening', label: 'Listening' },
  { id: 'thinking', label: 'Thinking' },
] as const;

/**
 * Drives the character directly from the same store the assistant uses, so what you see
 * here is exactly what happens in a conversation.
 */
export function CharacterPlayground() {
  const emotion = useAssistantStore((s) => s.emotion);
  const state = useAssistantStore((s) => s.state);
  const intensity = useAssistantStore((s) => s.intensity);
  const express = useAssistantStore((s) => s.express);
  const setState = useAssistantStore((s) => s.setState);
  const reset = useAssistantStore((s) => s.reset);
  const [level, setLevel] = useState(0.6);

  useEffect(() => () => reset(), [reset]);

  return (
    <div className="grid gap-6 rounded-lg border border-ash/70 bg-soot/40 p-4 sm:p-6 lg:grid-cols-12">
      <div className="relative aspect-[4/5] w-full lg:col-span-5 lg:aspect-auto lg:min-h-[28rem]">
        <LazyAvatarCanvas
          fullAnimations
          framing="portrait"
          pointerInfluence={0.5}
          fallback={<AvatarPlaceholder />}
          placeholder={<AvatarPlaceholder label="Scroll to wake Flare" />}
          className="h-full w-full"
        />
      </div>
      <div className="flex flex-col gap-6 lg:col-span-7">
        <Group
          title="Mood"
          hint="Ten expressions the model can choose. Each holds while Flare talks."
        >
          {EMOTIONS.map((id) => (
            <Chip key={id} active={emotion === id} onClick={() => express(id, 'none', level)}>
              {emotionLabels[id]}
            </Chip>
          ))}
        </Group>
        <div>
          <label htmlFor="intensity" className="type-heading text-lg text-linen">
            Intensity
          </label>
          <p className="mt-1 text-sm text-smoke">
            One number from the model scales the face and the body reaction.
          </p>
          <input
            id="intensity"
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={level}
            onChange={(event) => {
              const value = Number(event.target.value);
              setLevel(value);
              express(emotion, 'none', value);
            }}
            className="mt-3 w-full max-w-xs accent-ember"
            aria-valuetext={`${Math.round(intensity * 100)} percent`}
          />
        </div>
        <Group title="Gesture" hint="Nod and shake are procedural; laugh and dance are clips.">
          {(Object.keys(gestureLabels) as Array<keyof typeof gestureLabels>).map((id) => (
            <Chip key={id} onClick={() => express(emotion, id, level)}>
              {gestureLabels[id]}
            </Chip>
          ))}
        </Group>
        <Group title="State" hint="Posture, gaze and lighting follow the conversation state.">
          {states.map((s) => (
            <Chip key={s.id} active={state === s.id} onClick={() => setState(s.id)}>
              {s.label}
            </Chip>
          ))}
        </Group>
      </div>
    </div>
  );
}

function Group({
  title,
  hint,
  children,
}: {
  title: string;
  hint: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h3 className="type-heading text-lg text-linen">{title}</h3>
      <p className="mt-1 text-sm text-smoke">{hint}</p>
      <div className="mt-3 flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

function Chip({
  active = false,
  onClick,
  children,
}: {
  active?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        'type-ui h-9 rounded-pill border px-3.5 text-sm transition-colors',
        active
          ? 'border-ember bg-ember/15 text-ember-soft'
          : 'border-ash bg-soot/60 text-linen-dim hover:border-ash-soft hover:text-linen'
      )}
    >
      {children}
    </button>
  );
}

'use client';

import { EMOTIONS, type Emotion, type Gesture } from '@flare/contracts';
import { useEffect } from 'react';
import { cn } from '@/lib/utils';
import { useAssistantStore } from '@/stores/assistant-store';
import { AvatarCanvas } from '../avatar/avatar-canvas';
import { AvatarPlaceholder } from '../avatar/avatar-placeholder';

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
  const express = useAssistantStore((s) => s.express);
  const setState = useAssistantStore((s) => s.setState);
  const reset = useAssistantStore((s) => s.reset);

  useEffect(() => () => reset(), [reset]);

  return (
    <div className="grid gap-6 rounded-lg border border-ash/70 bg-soot/40 p-4 sm:p-6 lg:grid-cols-12">
      <div className="relative aspect-[4/5] w-full lg:col-span-5 lg:aspect-auto lg:min-h-[28rem]">
        <AvatarCanvas fullAnimations framing="portrait" fallback={<AvatarPlaceholder />} />
      </div>
      <div className="flex flex-col gap-6 lg:col-span-7">
        <Group
          title="Mood"
          hint="Ten expressions the model can choose. Each holds while Flare talks."
        >
          {EMOTIONS.map((id) => (
            <Chip key={id} active={emotion === id} onClick={() => express(id, 'none')}>
              {emotionLabels[id]}
            </Chip>
          ))}
        </Group>
        <Group title="Gesture" hint="Nod and shake are procedural; laugh and dance are clips.">
          {(Object.keys(gestureLabels) as Array<keyof typeof gestureLabels>).map((id) => (
            <Chip key={id} onClick={() => express(emotion, id)}>
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
      <div className="flex items-baseline justify-between gap-4">
        <h3 className="type-heading text-lg text-linen">{title}</h3>
      </div>
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

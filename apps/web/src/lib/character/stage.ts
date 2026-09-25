import type { AssistantState } from '@/stores/assistant-store';

export interface StageLightPreset {
  /** Key light colour. */
  key: string;
  /** Rim light colour. */
  rim: string;
  keyIntensity: number;
  rimIntensity: number;
  /** CSS glow colour as "r g b". */
  glow: string;
  glowStrength: number;
}

/**
 * The room's light follows the conversation: warm and forward while listening, cool and
 * dimmer while thinking, bright and open while speaking.
 */
export const STAGE_LIGHTS: Record<AssistantState, StageLightPreset> = {
  idle: {
    key: '#f5e6cf',
    rim: '#8c9bc4',
    keyIntensity: 1.6,
    rimIntensity: 1.1,
    glow: '240 163 91',
    glowStrength: 0.14,
  },
  listening: {
    key: '#fbdcb4',
    rim: '#f0a35b',
    keyIntensity: 1.9,
    rimIntensity: 1.6,
    glow: '240 163 91',
    glowStrength: 0.3,
  },
  thinking: {
    key: '#d6dcef',
    rim: '#6b7aa6',
    keyIntensity: 1.2,
    rimIntensity: 1.3,
    glow: '140 155 196',
    glowStrength: 0.22,
  },
  speaking: {
    key: '#ffefd9',
    rim: '#f7c491',
    keyIntensity: 2.0,
    rimIntensity: 1.3,
    glow: '247 196 145',
    glowStrength: 0.26,
  },
};

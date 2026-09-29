import { AnimationClip, VectorKeyframeTrack } from 'three';
import { describe, expect, it } from 'vitest';
import { clipForScene, trackNodeName } from './clip-tracks';

describe('trackNodeName', () => {
  it('reads the bone name from a track', () => {
    expect(trackNodeName('Head.position')).toBe('Head');
    expect(trackNodeName('HeadTop_End_end.quaternion')).toBe('HeadTop_End_end');
  });
});

describe('clipForScene', () => {
  it('drops tracks for bones that are not in the scene and keeps the rest', () => {
    const clip = new AnimationClip('Idle', 2, [
      new VectorKeyframeTrack('Head.position', [0], [0, 1, 0]),
      new VectorKeyframeTrack('Armature.position', [0], [0, 0, 0]),
      new VectorKeyframeTrack('LeftEye_end.scale', [0], [1, 1, 1]),
    ]);
    const kept = clipForScene(clip, new Set(['Head']));
    expect(kept).not.toBe(clip);
    expect(kept.name).toBe('Idle');
    expect(kept.duration).toBe(2);
    expect(kept.tracks.map((track) => track.name)).toEqual(['Head.position']);
    expect(clip.tracks).toHaveLength(3);
  });

  it('returns the same clip when every track has a bone', () => {
    const clip = new AnimationClip('Idle', 1, [
      new VectorKeyframeTrack('Head.position', [0], [0, 0, 0]),
    ]);
    expect(clipForScene(clip, new Set(['Head']))).toBe(clip);
  });
});

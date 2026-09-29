import { AnimationClip, type AnimationClip as AnimationClipType } from 'three';

/** Node name of a Three.js track (`Bone.position` -> `Bone`). */
export function trackNodeName(trackName: string): string {
  return trackName.split('.')[0] ?? '';
}

/**
 * Drops tracks whose bone is not in the scene. The idle clip still names chain-tip
 * and armature nodes that the avatar does not contain; playing them makes Three.js
 * warn and then skip the track.
 */
export function clipForScene(
  clip: AnimationClipType,
  nodeNames: ReadonlySet<string>
): AnimationClipType {
  const tracks = clip.tracks.filter((track) => nodeNames.has(trackNodeName(track.name)));
  if (tracks.length === clip.tracks.length) return clip;
  return new AnimationClip(clip.name, clip.duration, tracks);
}

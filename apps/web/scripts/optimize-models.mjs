#!/usr/bin/env node
/**
 * Rebuilds the served models from the sources in models-src/:
 *
 *   avatar.glb      meshopt-compressed geometry, quantized attributes, WebP textures
 *   idle.glb        the Idle clip alone, extracted from the animation set, compressed
 *   animations.glb  the full clip set, resampled and compressed
 *
 * Sizes drop from roughly 3 MB / 0.7 MB / 8.3 MB to 0.6 MB / 0.09 MB / 0.94 MB. Morph
 * targets and clip names are preserved; run the check at the end to be sure.
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(here, '..');
const src = path.join(webRoot, 'models-src');
const out = path.join(webRoot, 'public', 'models');
const bin = path.join(webRoot, '..', '..', 'node_modules', '.bin', 'gltf-transform');
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'flare-models-'));

function run(args) {
  execFileSync(bin, args, { stdio: 'inherit', shell: process.platform === 'win32' });
}

function optimize(input, output, extra = []) {
  run(['optimize', input, output, '--compress', 'meshopt', '--simplify', 'false', ...extra]);
}

fs.mkdirSync(out, { recursive: true });

// Idle is extracted from the uncompressed source; the extractor reads raw buffer views.
const idleRaw = path.join(temp, 'idle.glb');
execFileSync(
  process.execPath,
  [path.join(here, 'extract-clip.mjs'), path.join(src, 'animations.glb'), 'Idle', idleRaw],
  { stdio: 'inherit' }
);

optimize(path.join(src, 'avatar.glb'), path.join(out, 'avatar.glb'), [
  '--texture-compress',
  'webp',
  '--texture-size',
  '1024',
]);
optimize(idleRaw, path.join(out, 'idle.glb'), ['--texture-compress', 'false']);
optimize(path.join(src, 'animations.glb'), path.join(out, 'animations.glb'), [
  '--texture-compress',
  'false',
]);

// Sanity check: morph targets and clips survived.
function readJson(file) {
  const buf = fs.readFileSync(file);
  const len = buf.readUInt32LE(12);
  return JSON.parse(buf.subarray(20, 20 + len).toString('utf8'));
}
const avatar = readJson(path.join(out, 'avatar.glb'));
const morphs = new Set();
for (const mesh of avatar.meshes ?? []) {
  const names = mesh.extras?.targetNames ?? mesh.primitives?.[0]?.extras?.targetNames;
  if (names) names.forEach((n) => morphs.add(n));
}
const clips = readJson(path.join(out, 'animations.glb')).animations.map((a) => a.name);
if (morphs.size < 60 || clips.length < 9) {
  throw new Error(`Optimisation lost data: ${morphs.size} morph targets, ${clips.length} clips`);
}
for (const file of ['avatar.glb', 'idle.glb', 'animations.glb']) {
  const size = (fs.statSync(path.join(out, file)).size / 1e6).toFixed(2);
  console.log(`${file}: ${size} MB`);
}
console.log(`morph targets: ${morphs.size}, clips: ${clips.join(', ')}`);
fs.rmSync(temp, { recursive: true, force: true });

#!/usr/bin/env node
/**
 * Extracts a single animation clip from a GLB into its own file.
 *
 *   node scripts/extract-clip.mjs public/models/animations.glb Idle public/models/idle.glb
 *
 * The full animation set is 8 MB; the landing page and the assistant's first paint only
 * need the Idle clip. Nodes and the scene graph are kept so the clip retargets exactly like
 * the original; unreferenced accessors, buffer views and skins are dropped.
 */
import fs from 'node:fs';

const [, , inputPath, clipName, outputPath] = process.argv;
if (!inputPath || !clipName || !outputPath) {
  console.error('usage: extract-clip.mjs <input.glb> <clipName> <output.glb>');
  process.exit(1);
}

const GLB_MAGIC = 0x46546c67;
const CHUNK_JSON = 0x4e4f534a;
const CHUNK_BIN = 0x004e4942;

function readGlb(buffer) {
  if (buffer.readUInt32LE(0) !== GLB_MAGIC) throw new Error('Not a GLB file');
  let offset = 12;
  let json = null;
  let bin = null;
  while (offset < buffer.length) {
    const length = buffer.readUInt32LE(offset);
    const type = buffer.readUInt32LE(offset + 4);
    const data = buffer.subarray(offset + 8, offset + 8 + length);
    if (type === CHUNK_JSON) json = JSON.parse(data.toString('utf8'));
    if (type === CHUNK_BIN) bin = data;
    offset += 8 + length;
  }
  if (!json || !bin) throw new Error('GLB is missing a JSON or BIN chunk');
  return { json, bin };
}

function writeGlb(json, bin) {
  const pad4 = (n) => (4 - (n % 4)) % 4;
  const jsonBytes = Buffer.from(JSON.stringify(json), 'utf8');
  const jsonPadded = Buffer.concat([jsonBytes, Buffer.alloc(pad4(jsonBytes.length), 0x20)]);
  const binPadded = Buffer.concat([bin, Buffer.alloc(pad4(bin.length), 0)]);
  const total = 12 + 8 + jsonPadded.length + 8 + binPadded.length;
  const header = Buffer.alloc(12);
  header.writeUInt32LE(GLB_MAGIC, 0);
  header.writeUInt32LE(2, 4);
  header.writeUInt32LE(total, 8);
  const jsonHeader = Buffer.alloc(8);
  jsonHeader.writeUInt32LE(jsonPadded.length, 0);
  jsonHeader.writeUInt32LE(CHUNK_JSON, 4);
  const binHeader = Buffer.alloc(8);
  binHeader.writeUInt32LE(binPadded.length, 0);
  binHeader.writeUInt32LE(CHUNK_BIN, 4);
  return Buffer.concat([header, jsonHeader, jsonPadded, binHeader, binPadded]);
}

const { json, bin } = readGlb(fs.readFileSync(inputPath));
const animation = (json.animations ?? []).find((a) => a.name === clipName);
if (!animation) {
  console.error(
    `Clip "${clipName}" not found. Available: ${json.animations.map((a) => a.name).join(', ')}`
  );
  process.exit(1);
}

// Collect accessors used by the clip, then the buffer views behind them.
const accessorIds = new Set();
for (const sampler of animation.samplers) {
  accessorIds.add(sampler.input);
  accessorIds.add(sampler.output);
}
const accessorRemap = new Map();
const bufferViewRemap = new Map();
const newAccessors = [];
const newBufferViews = [];
const chunks = [];
let binLength = 0;

for (const oldId of [...accessorIds].sort((a, b) => a - b)) {
  const accessor = structuredClone(json.accessors[oldId]);
  if (accessor.bufferView !== undefined) {
    const oldView = accessor.bufferView;
    if (!bufferViewRemap.has(oldView)) {
      const view = structuredClone(json.bufferViews[oldView]);
      const start = view.byteOffset ?? 0;
      const bytes = bin.subarray(start, start + view.byteLength);
      const padding = (4 - (binLength % 4)) % 4;
      if (padding) {
        chunks.push(Buffer.alloc(padding, 0));
        binLength += padding;
      }
      view.byteOffset = binLength;
      view.buffer = 0;
      chunks.push(bytes);
      binLength += bytes.length;
      bufferViewRemap.set(oldView, newBufferViews.length);
      newBufferViews.push(view);
    }
    accessor.bufferView = bufferViewRemap.get(oldView);
  }
  accessorRemap.set(oldId, newAccessors.length);
  newAccessors.push(accessor);
}

const newAnimation = structuredClone(animation);
for (const sampler of newAnimation.samplers) {
  sampler.input = accessorRemap.get(sampler.input);
  sampler.output = accessorRemap.get(sampler.output);
}

const nodes = (json.nodes ?? []).map((node) => {
  const copy = structuredClone(node);
  delete copy.skin;
  delete copy.mesh;
  return copy;
});

const output = {
  asset: {
    version: '2.0',
    generator: `flare extract-clip (from ${json.asset?.generator ?? 'unknown'})`,
  },
  scene: json.scene ?? 0,
  scenes: json.scenes,
  nodes,
  animations: [newAnimation],
  accessors: newAccessors,
  bufferViews: newBufferViews,
  buffers: [{ byteLength: binLength }],
};

fs.writeFileSync(outputPath, writeGlb(output, Buffer.concat(chunks)));
const size = (fs.statSync(outputPath).size / 1e6).toFixed(2);
console.log(`Wrote ${outputPath} (${size} MB) with clip "${clipName}"`);

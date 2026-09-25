#!/usr/bin/env node
/**
 * Prepares generated files under public/ before `next dev` and `next build`:
 *
 *   public/vad/       the Silero model, its audio worklet, and the ONNX Runtime wasm,
 *                     copied from node_modules so hands-free needs no third-party CDN
 *   public/_headers   Cloudflare Pages headers: a Content-Security-Policy built from the
 *                     public configuration, plus caching for immutable assets
 *
 * Both outputs are git-ignored; the inputs are the installed packages and NEXT_PUBLIC_*
 * variables, so the result is reproducible in CI.
 */
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(here, '..');
const publicDir = path.join(webRoot, 'public');
const require = createRequire(import.meta.url);

// -----------------------------------------------------------------------------
// VAD assets
// -----------------------------------------------------------------------------

function copyVadAssets() {
  const vadDist = path.dirname(require.resolve('@ricky0123/vad-web/package.json'));
  // onnxruntime-web's exports map hides package.json; it is installed beside the VAD package.
  const ortDist = path.resolve(vadDist, '..', '..', 'onnxruntime-web', 'dist');
  if (!fs.existsSync(ortDist)) {
    throw new Error(`onnxruntime-web dist not found at ${ortDist}`);
  }
  const target = path.join(publicDir, 'vad');
  fs.mkdirSync(target, { recursive: true });

  const files = [
    path.join(vadDist, 'dist', 'silero_vad_v5.onnx'),
    path.join(vadDist, 'dist', 'vad.worklet.bundle.min.js'),
    path.join(ortDist, 'ort-wasm-simd-threaded.wasm'),
    path.join(ortDist, 'ort-wasm-simd-threaded.mjs'),
  ];
  for (const file of files) {
    const dest = path.join(target, path.basename(file));
    fs.copyFileSync(file, dest);
  }
  console.log(`prepare-public: copied ${files.length} VAD assets to public/vad`);
}

// -----------------------------------------------------------------------------
// Headers
// -----------------------------------------------------------------------------

/** The Clerk frontend API host is base64-encoded inside the publishable key. */
function clerkFrontendHost(publishableKey) {
  const match = /^pk_(test|live)_(.+)$/.exec(publishableKey ?? '');
  if (!match) return null;
  try {
    return Buffer.from(match[2], 'base64').toString('utf8').replace(/\$$/, '');
  } catch {
    return null;
  }
}

function origin(url) {
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

function buildHeaders(env) {
  const api = origin(env.NEXT_PUBLIC_API_URL) ?? 'http://127.0.0.1:8787';
  const clerkHost = clerkFrontendHost(env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);
  const assets = origin(env.NEXT_PUBLIC_ASSETS_URL);

  const clerk = [
    clerkHost ? `https://${clerkHost}` : null,
    'https://*.clerk.accounts.dev',
    'https://*.clerk.com',
    'https://clerk-telemetry.com',
  ].filter(Boolean);
  const turnstile = 'https://challenges.cloudflare.com';

  const csp = [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "form-action 'self'",
    // Next.js static export needs inline bootstrap scripts; the ONNX runtime needs wasm.
    `script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval' ${clerk.join(' ')} ${turnstile}`,
    "worker-src 'self' blob:",
    `connect-src 'self' ${api} ${clerk.join(' ')} ${turnstile}${assets ? ` ${assets}` : ''}`,
    "img-src 'self' data: blob: https://img.clerk.com",
    "media-src 'self' blob: data:",
    "style-src 'self' 'unsafe-inline'",
    "font-src 'self' data:",
    `frame-src ${turnstile} ${clerk.join(' ')}`,
  ].join('; ');

  return [
    '/*',
    `  Content-Security-Policy: ${csp}`,
    '  X-Content-Type-Options: nosniff',
    '  Referrer-Policy: strict-origin-when-cross-origin',
    '  Permissions-Policy: microphone=(self), camera=(), geolocation=(), payment=()',
    '  X-Frame-Options: DENY',
    '',
    '/models/*',
    '  Cache-Control: public, max-age=31536000, immutable',
    '',
    '/vad/*',
    '  Cache-Control: public, max-age=31536000, immutable',
    '',
    '/_next/static/*',
    '  Cache-Control: public, max-age=31536000, immutable',
    '',
  ].join('\n');
}

function writeHeaders() {
  const file = path.join(publicDir, '_headers');
  fs.writeFileSync(file, buildHeaders(process.env));
  console.log('prepare-public: wrote public/_headers');
}

copyVadAssets();
writeHeaders();

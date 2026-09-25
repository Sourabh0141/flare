import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // The site is a fully static export served by Cloudflare Pages; the API is a separate Worker.
  output: 'export',
  trailingSlash: true,
  reactStrictMode: true,
  images: { unoptimized: true },
  // The GLB models and audio are served from /public; nothing here needs the image optimizer.
  transpilePackages: ['@flare/contracts'],
};

export default nextConfig;

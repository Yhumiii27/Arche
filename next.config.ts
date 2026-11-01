import type { NextConfig } from 'next';
import { staticSecurityHeaders } from './src/server/http/security-headers';

const nextConfig: NextConfig = {
  // ARCHE_DIST_DIR lets CI / verification builds use their own output folder (e.g. .next-ci) so they never overwrite the
  // .next of `next dev` (copied from Keystone).
  distDir: process.env.ARCHE_DIST_DIR || '.next',
  // Security headers on every response, static assets included (the per-request Content-Security-Policy is set by
  // src/proxy.ts). HSTS only in production builds.
  poweredByHeader: false,
  // Files deposited in Codex from a dossier go through a Server Function (src/features/dossiers/actions.ts, 20 MB at most):
  // the body limit (1 MB by default) and the body buffered by the proxy (10 MB) leave room for the form around the file.
  experimental: { serverActions: { bodySizeLimit: '21mb' }, proxyClientMaxBodySize: '21mb' },
  async headers() {
    return [{ source: '/:path*', headers: staticSecurityHeaders(process.env.NODE_ENV === 'production') }];
  },
};

export default nextConfig;

import type { NextConfig } from 'next';

const config: NextConfig = {
  reactStrictMode: true,
  serverExternalPackages: ['@electrum-cash/network', '@electrum-cash/web-socket', '@monsterbitar/isomorphic-ws', 'ws'],
  poweredByHeader: false,
};
export default config;

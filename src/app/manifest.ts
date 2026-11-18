import type { MetadataRoute } from 'next';
import { BRAND_NAME, TAGLINE } from '@/brand';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: BRAND_NAME,
    short_name: BRAND_NAME,
    description: TAGLINE,
    start_url: '/',
    display: 'standalone',
    background_color: '#100E0B',
    theme_color: '#100E0B',
    icons: [{ src: '/icon.svg', sizes: 'any', type: 'image/svg+xml' }, { src: '/apple-icon', sizes: '180x180', type: 'image/png' }],
  };
}

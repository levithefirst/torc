import { ImageResponse } from 'next/og';
import { BRAND_NAME, TAGLINE } from '@/brand';
import { markDataUri } from './brand-image';

export const alt = `${BRAND_NAME}: ${TAGLINE}`;
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', background: '#100E0B', padding: 80, gap: 64 }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={markDataUri()} width={300} height={300} alt="" />
        <div style={{ display: 'flex', flexDirection: 'column', color: '#F6F3EF' }}>
          <div style={{ fontSize: 120, fontWeight: 700, letterSpacing: -4, color: '#CFA354' }}>{BRAND_NAME.toLowerCase()}</div>
          <div style={{ fontSize: 40, maxWidth: 640, color: '#AEAAA3', marginTop: 12 }}>{TAGLINE}</div>
        </div>
      </div>
    ),
    size,
  );
}

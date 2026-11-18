import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/** The gold mark as a data URI, for next/og image routes. */
export function markDataUri(variant: 'gold' | 'plain' = 'plain'): string {
  const file = variant === 'gold' ? 'torc-mark-gold.svg' : 'torc-mark.svg';
  const svg = readFileSync(join(process.cwd(), 'public/brand', file), 'utf8');
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
}

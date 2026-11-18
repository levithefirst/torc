// GET /api/demo/seats → the PUBLIC addresses of the server's demo seat keys (never the keys).
import { NextResponse } from 'next/server';
import { demoSeatKeys } from '@/lib/server/demoKeys';
import { keyInfo } from '@/lib/torc/keys';
import { NETWORK } from '@/lib/chain/config';

export const dynamic = 'force-dynamic';

export function GET() {
  const seats = demoSeatKeys().map((k, i) => {
    const info = keyInfo(k.privateKey, NETWORK);
    return { index: i, address: info.address, tokenAddress: info.tokenAddress };
  });
  return NextResponse.json({ network: NETWORK, configured: seats.length > 0, seats });
}

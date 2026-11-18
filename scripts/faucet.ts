// npm run faucet -- <keyName> [sats]   Chipnet only. Uses chipnet.bch.ninja's public
// proof-of-work faucet API (the same flow its web page runs in a Web Worker).
import { createHash } from 'node:crypto';
import { NETWORK, loadKey } from './lib';

const FAUCET = 'https://chipnet.bch.ninja/api';

async function api(path: string, body?: unknown) {
  const r = await fetch(`${FAUCET}/${path}`, body ? { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) } : {});
  const j = (await r.json()) as Record<string, any>;
  if (!r.ok) throw new Error(`${path}: ${j.error ?? r.status}`);
  return j;
}

export async function requestSats(address: string, sats: bigint) {
  const challenge = await api('challenge', { address, sats: sats.toString() });
  const target = BigInt(`0x${challenge.target}`);
  const t0 = Date.now();
  let nonce = 0n;
  for (;;) {
    const h = createHash('sha256').update(`${challenge.payload}:${nonce}`).digest('hex');
    if (BigInt(`0x${h}`) <= target) break;
    nonce++;
    if (Date.now() > challenge.expires) throw new Error('challenge expired');
  }
  const res = await api('claim', { payload: challenge.payload, signature: challenge.signature, nonce: nonce.toString() });
  console.log(`  pow ${nonce} hashes in ${Date.now() - t0} ms -> txid ${res.txid} (fee ${res.fee})`);
  return res.txid as string;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  if (NETWORK !== 'chipnet') throw new Error('faucet is chipnet only');
  const name = process.argv[2];
  const sats = BigInt(process.argv[3] ?? '2000000');
  if (!name) throw new Error('usage: npm run faucet -- <keyName> [sats]');
  const k = loadKey(name);
  console.log(`requesting ${sats} sats for ${name} ${k.address}`);
  await requestSats(k.address, sats);
}

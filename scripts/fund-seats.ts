// npm run fund:seats -- --to addr1,addr2,... [--sats 500000] [--tokens 10000]
// Treasury sends BCH (and, on chipnet, tPUSD) to demo seat addresses.
import { TransactionBuilder } from 'cashscript';
import { readFileSync, existsSync } from 'node:fs';
import { NETWORK, provider, walletOf, arg } from './lib';
import { toTokenAddress } from '../src/lib/torc/address';

const to = arg('to')!.split(',');
const sats = BigInt(arg('sats', '500000')!);
const tokens = BigInt(arg('tokens', NETWORK === 'chipnet' ? '10000' : '0')!);
const p = provider();
const w = await walletOf(p, arg('from', 'treasury')!);
const tb = new TransactionBuilder({ provider: p });
let inSats = 0n;
for (const u of w.utxos.filter((u) => !u.token)) { tb.addInput(u, w.key.sig.unlockP2PKH()); inSats += u.satoshis; }
if (tokens > 0n) {
  const asset = JSON.parse(readFileSync(`deployments/${NETWORK}-asset.json`, 'utf8')).category as string;
  const ft = w.utxos.filter((u) => u.token?.category === asset && !u.token.nft);
  let have = 0n;
  for (const u of ft) { tb.addInput(u, w.key.sig.unlockP2PKH()); have += u.token!.amount; }
  for (const a of to) tb.addOutput({ to: toTokenAddress(a), amount: 1000n, token: { category: asset, amount: tokens } });
  tb.addOutput({ to: w.key.tokenAddress, amount: 1000n, token: { category: asset, amount: have - tokens * BigInt(to.length) } });
}
for (const a of to) tb.addOutput({ to: a, amount: sats });
tb.addBchChangeOutputIfNeeded({ to: w.address, feeRate: 1 });
const tx = await tb.send();
console.log(`funded ${to.length} seats with ${sats} sats${tokens ? ` + ${tokens} token units` : ''}: ${tx.txid}`);

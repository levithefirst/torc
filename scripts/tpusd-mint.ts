// npm run tpusd:mint   Chipnet only. Genesis of "tPUSD", a fungible test token with the same
// decimals as mainnet PUSD (2; see .env.example), minted to the treasury key, then 100.00 tPUSD
// sent to each demo seat.
import { TransactionBuilder } from 'cashscript';
import { writeFileSync, existsSync } from 'node:fs';
import { NETWORK, provider, walletOf, loadKey } from './lib';
import { buildPrepare, pickGenesisInput } from '../src/lib/torc/txs';

if (NETWORK !== 'chipnet') throw new Error('tpusd:mint is chipnet only (never mint a fake PUSD on mainnet)');
if (existsSync('deployments/chipnet-asset.json')) throw new Error('tPUSD already minted (deployments/chipnet-asset.json)');
const SUPPLY = 100_000_000n; // 1,000,000.00 tPUSD
const PER_SEAT = 10_000n; // 100.00 tPUSD
const p = provider();
let w = await walletOf(p, 'treasury');
let first = pickGenesisInput(w);
if (!first) {
  console.log('no vout-0 UTXO; making one');
  const prep = await buildPrepare(p, w, 100_000n).send();
  console.log('prepare txid', prep.txid);
  w = await walletOf(p, 'treasury');
  first = pickGenesisInput(w)!;
}
const category = first.txid;
const tb = new TransactionBuilder({ provider: p })
  .addInput(first, w.key.sig.unlockP2PKH())
  .addOutput({ to: w.key.tokenAddress, amount: 1000n, token: { category, amount: SUPPLY } })
  .addBchChangeOutputIfNeeded({ to: w.address, feeRate: 1 });
const g = await tb.send();
console.log('tPUSD genesis', g.txid, 'category', category);

w = await walletOf(p, 'treasury');
const ft = w.utxos.find((u) => u.token?.category === category)!;
const fee = w.utxos.filter((u) => !u.token).sort((a, b) => Number(b.satoshis - a.satoshis))[0]!;
const d = new TransactionBuilder({ provider: p }).addInput(ft, w.key.sig.unlockP2PKH()).addInput(fee, w.key.sig.unlockP2PKH());
for (const s of ['ade', 'bisi', 'chidi']) d.addOutput({ to: loadKey(s).tokenAddress, amount: 1000n, token: { category, amount: PER_SEAT } });
d.addOutput({ to: w.key.tokenAddress, amount: 1000n, token: { category, amount: SUPPLY - 3n * PER_SEAT } });
d.addBchChangeOutputIfNeeded({ to: w.address, feeRate: 1 });
const dist = await d.send();
console.log('distribution', dist.txid);
writeFileSync('deployments/chipnet-asset.json', JSON.stringify({ name: 'tPUSD', symbol: 'tPUSD', decimals: 2, category, genesisTxid: g.txid, distributionTxid: dist.txid, supply: SUPPLY.toString() }, null, 2) + '\n');

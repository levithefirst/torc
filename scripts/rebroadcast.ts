// npm run rebroadcast   (TORC_RECORD=deployments/<record>.json)
// Rebroadcasts a circle's unconfirmed txs, parents first, through the relay (which fans out to every
// Electrum server). For txs stuck in one node's mempool after their parents were orphaned elsewhere.
import { binToHex } from '@bitauth/libauth';
import { provider, loadRecord } from './lib';
import { circleContract, paramsFromJson } from '../src/lib/torc/circle';
import { decodeTx } from '../src/lib/chain/provider';

const p = provider();
const rec = loadRecord();
const c = circleContract(paramsFromJson(rec.params), p);
const history = await p.getHistory(c.lockingBytecode);
const done = new Set<string>();
const order: string[] = [];
async function visit(txid: string) {
  if (done.has(txid)) return;
  done.add(txid);
  const v = (await p.call('blockchain.transaction.get', txid, true)) as { confirmations?: number };
  if (v.confirmations) return;
  const t = decodeTx(await p.getRawTransaction(txid));
  for (const i of t.inputs) await visit(binToHex(i.outpointTransactionHash));
  order.push(txid);
}
for (const h of history) if (h.height <= 0) await visit(h.tx_hash);
console.log(`${rec.name}: ${order.length} unconfirmed txs (incl. ancestors), rebroadcasting parents first`);
for (const txid of order) {
  try {
    await p.sendRawTransaction(await p.getRawTransaction(txid));
    console.log('  ok  ', txid);
  } catch (e) {
    console.log('  err ', txid, String((e as Error).message).slice(0, 160));
  }
}

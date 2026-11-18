// npm run seat:transfer -- --from chidi --to dayo   Move a member NFT to a new holder (plain P2PKH tx).
// The covenant never sees this: whoever holds seat i's NFT IS seat i.
import { TransactionBuilder } from 'cashscript';
import { provider, walletOf, loadKey, loadRecord, saveRecord, arg } from './lib';
import { paramsFromJson } from '../src/lib/torc/circle';
import { memberNfts } from '../src/lib/torc/txs';
import { decodeMember } from '../src/lib/torc/state';

const from = arg('from')!, to = arg('to')!;
const rec = loadRecord();
const params = paramsFromJson(rec.params);
const p = provider();
const w = await walletOf(p, from);
const nft = memberNfts(params, w.utxos)[0];
if (!nft) throw new Error(`${from} holds no seat in ${rec.name}`);
const seat = decodeMember(nft.token!.nft!.commitment);
const fee = w.utxos.filter((u) => !u.token).sort((a, b) => Number(b.satoshis - a.satoshis))[0]!;
const tx = await new TransactionBuilder({ provider: p })
  .addInput(nft, w.key.sig.unlockP2PKH())
  .addInput(fee, w.key.sig.unlockP2PKH())
  .addOutput({ to: loadKey(to).tokenAddress, amount: nft.satoshis, token: nft.token! })
  .addBchChangeOutputIfNeeded({ to: w.address, feeRate: 1 })
  .send();
if (!rec.seatKeys.includes(to)) rec.seatKeys.push(to);
rec.events.push({ kind: 'transfer', txid: tx.txid, seat, at: new Date().toISOString() });
saveRecord(rec);
console.log(`seat ${seat} (${rec.seatNames[seat]}) moved ${from} -> ${to}: ${tx.txid}`);

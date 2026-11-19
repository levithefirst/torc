// Builds the job file for `xo-runner.mjs contribute`: circle state + the member's outpoints, read live.
import { readFileSync, writeFileSync } from 'node:fs';
import { relayCaller } from '../src/lib/chain/electrum';
import { TorcProvider } from '../src/lib/chain/provider';
import { circleContract, paramsFromJson } from '../src/lib/torc/circle';
import { findState, memberNfts } from '../src/lib/torc/txs';
import { decodeState, encodeState, decodeMember } from '../src/lib/torc/state';

const rec = JSON.parse(readFileSync(process.argv[2] ?? 'deployments/chipnet-xo.json', 'utf8'));
const seatAddress = process.argv[3]!;
const p = new TorcProvider(relayCaller(process.env.TORC_RELAY_URL ?? 'https://torc-brown.vercel.app'), 'chipnet');
const params = paramsFromJson(rec.params);
const c = circleContract(params, p);
const st = findState(params, await c.getUtxos());
const mine = await p.getUtxos(seatAddress);
const seat = memberNfts(params, mine)[0]!;
const pay = mine.filter((u) => u.token?.category === params.assetCategory && !u.token.nft).sort((a, b) => Number(b.satoshis - a.satoshis))[0]!;
const cur = decodeState(st.token!.nft!.commitment);
const nextStateCommitment = encodeState({ ...cur, paidMask: cur.paidMask | (1 << decodeMember(seat.token!.nft!.commitment)) });
const job = {
  circle: {
    circleCategory: params.circleCategory, assetCategory: params.assetCategory, contribution: Number(params.contribution),
    seats: params.seats, period: params.period, stateSatoshis: Number(st.satoshis), stateCommitment: st.token!.nft!.commitment, nextStateCommitment,
  },
  member: { seatCommitment: seat.token!.nft!.commitment, seatSatoshis: Number(seat.satoshis), paymentTokens: Number(pay.token!.amount), paymentSatoshis: Number(pay.satoshis) },
  inputs: [st, seat, pay].map((u) => ({ txid: u.txid, vout: u.vout })),
  expect: { covenantLockingBytecode: c.lockingBytecode },
};
writeFileSync('/tmp/claude-0/xo-job.json', JSON.stringify(job, null, 2));
console.log(JSON.stringify(job, null, 2));

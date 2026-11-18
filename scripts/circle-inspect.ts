// npm run circle:inspect   Decoded state + on-chain history of the demo circle.
import { provider, loadRecord } from './lib';
import { readState } from '../src/lib/torc/demo';
import { paramsFromJson } from '../src/lib/torc/circle';
import { nextAction, paidCount, turnSeat } from '../src/lib/torc/state';
import { findContributions } from '../src/lib/torc/txs';

const rec = loadRecord();
const params = paramsFromJson(rec.params);
const p = provider();
const { state, utxos, contract } = await readState(p, params);
const { mtp, height } = await p.medianTimePast();
const n = nextAction(state, params.seats, params.period);
console.log(`${rec.name} (${rec.network}) ${contract.tokenAddress}`);
console.log(`  round ${state.round}, turn seat ${turnSeat(state, params.seats)} (${rec.seatNames[turnSeat(state, params.seats)]})`);
console.log(`  paid ${paidCount(state, params.seats)}/${params.seats} mask=${state.paidMask.toString(2).padStart(params.seats, '0')}`);
console.log(`  roundStart ${state.roundStart} (${new Date(state.roundStart * 1000).toISOString()}), opens ${state.roundStart + params.period}`);
console.log(`  chain tip ${height}, median-time-past ${mtp} (${new Date(mtp * 1000).toISOString()})`);
console.log(`  pot UTXOs: ${findContributions(params, utxos).length}, all UTXOs at covenant: ${utxos.length}`);
console.log(`  next: ${JSON.stringify(n)}`);
const hist = await p.getHistory(contract.lockingBytecode);
console.log(`  history (${hist.length} txs):`);
for (const h of hist) console.log(`    ${h.height > 0 ? 'block ' + h.height : 'mempool'}  ${h.tx_hash}`);

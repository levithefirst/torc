// npm run circle:tick [-- --loop N]   Perform the demo circle's next due action.
import { NETWORK, provider, loadRecord, saveRecord, loadKey, arg } from './lib';
import { tick } from '../src/lib/torc/demo';
import { paramsFromJson } from '../src/lib/torc/circle';

const loops = Number(arg('loop', '1'));
const p = provider();
for (let i = 0; i < loops; i++) {
  const rec = loadRecord();
  const params = paramsFromJson(rec.params);
  const seats = rec.seatKeys.map((k) => ({ privateKey: loadKey(k).privateKey }));
  const r = await tick(p, params, seats);
  if (r.ok) {
    rec.events.push({ kind: r.kind, txid: r.txid, seat: r.seat, round: r.round, at: new Date().toISOString() });
    saveRecord(rec);
    console.log(`[${NETWORK}] ${r.kind} by seat ${r.seat} (${rec.seatNames[r.seat]}) in round ${r.round}: ${r.txid}`);
  } else {
    console.log(`[${NETWORK}] no action: ${r.reason}: ${r.message}`);
    if (r.reason !== 'wait') process.exitCode = r.reason === 'finished' ? 0 : 1;
    break;
  }
}

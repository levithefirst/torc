// npm run circle:create -- --name "Lagos Market Circle" --seats 3 --contribution 10 --period 600 \
//   --mode token --members ade,bisi,chidi [--names Ade,Bisi,Chidi] [--creator treasury]
// --members takes demo key names (from .secrets) or addresses.
import { readFileSync, existsSync } from 'node:fs';
import { NETWORK, provider, walletOf, loadKey, saveRecord, recordPath, arg, type DemoRecord } from './lib';
import { buildGenesis, buildPrepare, pickGenesisInput } from '../src/lib/torc/txs';
import { paramsToJson, type AssetMode } from '../src/lib/torc/circle';
import { isValidAddress } from '../src/lib/torc/address';

const PUSD_MAINNET = '2469acc5afa4b10cb5b5c04afb89c3a3ffd61c5da9c01e26d00951cae2a02544';
const name = arg('name', 'Lagos Market Circle')!;
const seats = Number(arg('seats', '3'));
const mode = (arg('mode', 'token') as AssetMode);
const contribution = BigInt(arg('contribution', mode === 'token' ? '10' : '2000')!);
const period = Number(arg('period', NETWORK === 'mainnet' ? '86400' : '600'));
const memberArgs = (arg('members', 'ade,bisi,chidi')!).split(',');
const seatNames = (arg('names', 'Ade,Bisi,Chidi')!).split(',');
const creator = arg('creator', 'treasury')!;
if (existsSync(recordPath()) && !process.argv.includes('--force')) throw new Error(`${recordPath()} exists; pass --force to replace the demo circle record`);

let assetCategory: string | undefined;
let assetName: string | undefined;
let assetDecimals: number | undefined;
if (mode === 'token') {
  if (NETWORK === 'chipnet') {
    const a = JSON.parse(readFileSync('deployments/chipnet-asset.json', 'utf8'));
    assetCategory = a.category; assetName = a.symbol; assetDecimals = a.decimals;
  } else {
    assetCategory = process.env.PUSD_CATEGORY || PUSD_MAINNET; assetName = 'PUSD'; assetDecimals = 2;
  }
}
const members = memberArgs.map((m) => (isValidAddress(m, NETWORK) ? m : loadKey(m).address));
const p = provider();
let w = await walletOf(p, creator);
if (!pickGenesisInput(w)) {
  const prep = await buildPrepare(p, w, 20_000n).send();
  console.log('prepare (vout-0) txid', prep.txid);
  w = await walletOf(p, creator);
}
const { mtp } = await p.medianTimePast();
const g = buildGenesis({ provider: p, params: { network: NETWORK, mode, assetCategory, contribution, seats, period }, wallet: w, members, startTime: mtp });
const tx = await g.builder.send();
const rec: DemoRecord = {
  name, network: NETWORK, params: paramsToJson(g.params),
  covenantAddress: g.contract.address, covenantTokenAddress: g.contract.tokenAddress,
  seatNames, seatKeys: memberArgs.filter((m) => !isValidAddress(m, NETWORK)),
  genesisTxid: tx.txid, assetName, assetDecimals,
  events: [{ kind: 'genesis', txid: tx.txid, at: new Date().toISOString() }],
};
saveRecord(rec);
console.log(`circle "${name}" created on ${NETWORK}`);
console.log('  covenant      ', g.contract.tokenAddress);
console.log('  category      ', g.params.circleCategory);
console.log('  genesis txid  ', tx.txid);
console.log('  params        ', JSON.stringify(rec.params));

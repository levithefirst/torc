// The seeded demo circle shown in judge mode. NEXT_PUBLIC_DEMO_CIRCLE (JSON of the
// deployments/<network>.json record) overrides the committed chipnet record.
import chipnetRecord from '../../../deployments/chipnet.json' with { type: 'json' };
import chipnetAsset from '../../../deployments/chipnet-asset.json' with { type: 'json' };
import { paramsFromJson, type CircleParams, type CircleParamsJson } from '../torc/circle';
import { NETWORK } from '../chain/config';

export interface DemoCircle {
  name: string;
  params: CircleParams;
  paramsJson: CircleParamsJson;
  seatNames: string[];
  tokenAddress: string;
  genesisTxid: string;
  events: { kind: string; txid: string; seat?: number; round?: number; at: string }[];
}

function load(): DemoCircle | null {
  let rec: any = null;
  const env = process.env.NEXT_PUBLIC_DEMO_CIRCLE;
  if (env) {
    try { rec = JSON.parse(env); } catch { rec = null; }
  }
  if (!rec && NETWORK === 'chipnet') rec = chipnetRecord;
  if (!rec || rec.network !== NETWORK) return null;
  return {
    name: rec.name, params: paramsFromJson(rec.params), paramsJson: rec.params, seatNames: rec.seatNames,
    tokenAddress: rec.covenantTokenAddress, genesisTxid: rec.genesisTxid, events: rec.events ?? [],
  };
}

// Display names for the demo circle. The on-chain records (deployments/*.json) keep their original
// names; the site shows a global cast.
function display(d: DemoCircle | null): DemoCircle | null {
  return d && { ...d, name: 'Torc Demo Circle', seatNames: ['Maya', 'Kofi', 'Diego'].concat(d.seatNames.slice(3)) };
}

export const DEMO = display(load());

export const PUSD_MAINNET = '2469acc5afa4b10cb5b5c04afb89c3a3ffd61c5da9c01e26d00951cae2a02544';

export interface AssetInfo { symbol: string; decimals: number }
export function assetInfo(p: Pick<CircleParams, 'mode' | 'assetCategory'> | CircleParamsJson): AssetInfo {
  if (p.mode === 'bch') return { symbol: 'sats', decimals: 0 };
  if (p.assetCategory === PUSD_MAINNET) return { symbol: 'PUSD', decimals: 2 };
  if (p.assetCategory === chipnetAsset.category) return { symbol: chipnetAsset.symbol, decimals: chipnetAsset.decimals };
  return { symbol: 'tokens', decimals: 0 };
}

export function fmtUnits(units: bigint | string, a: AssetInfo): string {
  const u = BigInt(units);
  if (a.decimals === 0) return `${u.toLocaleString('en-US')} ${a.symbol}`;
  const d = 10n ** BigInt(a.decimals);
  const whole = u / d;
  const frac = (u % d).toString().padStart(a.decimals, '0');
  return `${whole.toLocaleString('en-US')}.${frac} ${a.symbol}`;
}

export const shortTx = (t: string) => `${t.slice(0, 4)}…${t.slice(-4)}`;
export const seatName = (names: string[] | undefined, seat: number | undefined) =>
  seat === undefined ? '?' : names?.[seat] ?? `Seat ${seat + 1}`;

export function fmtDuration(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  if (s < 60) return `${s} s`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  if (h < 48) return `${h} h ${m % 60} m`;
  return `${Math.round(h / 24)} days`;
}

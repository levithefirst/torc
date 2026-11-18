// Shared helpers for the CLI scripts. NETWORK=chipnet (default) | mainnet.
// Chain access: direct Electrum WSS, or the deployed /api/chain relay when TORC_RELAY_URL is set
// (needed in sandboxes whose egress only carries HTTPS).
import { existsSync, mkdirSync, readFileSync, writeFileSync, chmodSync } from 'node:fs';
import { join } from 'node:path';
import { SignatureTemplate } from 'cashscript';
import { electrumCaller, relayCaller } from '../src/lib/chain/electrum';
import { electrumHosts } from '../src/lib/chain/config';
import { TorcProvider } from '../src/lib/chain/provider';
import { keyInfo, fromWif, type KeyInfo } from '../src/lib/torc/keys';
import type { WalletSide } from '../src/lib/torc/txs';
import type { TorcNetwork, CircleParamsJson } from '../src/lib/torc/circle';

export const NETWORK: TorcNetwork = process.env.NETWORK === 'mainnet' ? 'mainnet' : 'chipnet';
export const SECRETS = '.secrets';

export function provider(): TorcProvider {
  const relay = process.env.TORC_RELAY_URL;
  const call = relay ? relayCaller(relay) : electrumCaller(electrumHosts(NETWORK), 8000);
  return new TorcProvider(call, NETWORK);
}

export const wifPath = (name: string) => join(SECRETS, `${NETWORK}-${name}.wif`);

export function saveWif(name: string, wif: string) {
  mkdirSync(SECRETS, { recursive: true, mode: 0o700 });
  const p = wifPath(name);
  if (existsSync(p)) throw new Error(`${p} already exists; refusing to overwrite a key`);
  writeFileSync(p, wif + '\n', { mode: 0o600 });
  chmodSync(p, 0o600);
}

export function loadKey(name: string): KeyInfo & { sig: SignatureTemplate } {
  const p = wifPath(name);
  if (!existsSync(p)) throw new Error(`no key ${p}; run: npm run keys:new -- ${name}`);
  const k = keyInfo(fromWif(readFileSync(p, 'utf8')), NETWORK);
  return { ...k, sig: new SignatureTemplate(k.privateKey) };
}

export async function walletOf(p: TorcProvider, name: string): Promise<WalletSide & { key: ReturnType<typeof loadKey> }> {
  const key = loadKey(name);
  return { utxos: await p.getUtxos(key.address), unlocker: key.sig.unlockP2PKH(), address: key.address, key };
}

/** Public, committed record of a deployed demo circle (no keys). */
export interface DemoRecord {
  name: string;
  network: TorcNetwork;
  params: CircleParamsJson;
  covenantAddress: string;
  covenantTokenAddress: string;
  seatNames: string[];
  seatKeys: string[]; // .secrets key names of the throwaway demo seats (names only)
  genesisTxid: string;
  assetName?: string;
  assetDecimals?: number;
  events: { kind: 'genesis' | 'contribute' | 'claim' | 'transfer'; txid: string; seat?: number; round?: number; at: string }[];
}

export const recordPath = () => process.env.TORC_RECORD || join('deployments', `${NETWORK}.json`);
export function loadRecord(): DemoRecord {
  return JSON.parse(readFileSync(recordPath(), 'utf8'));
}
export function saveRecord(r: DemoRecord) {
  mkdirSync('deployments', { recursive: true });
  writeFileSync(recordPath(), JSON.stringify(r, null, 2) + '\n');
}

export function arg(name: string, fallback?: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : fallback;
}

export const fmtSats = (s: bigint) => `${s.toLocaleString('en-US')} sats`;

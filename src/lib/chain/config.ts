// Network configuration. NEXT_PUBLIC_* values are inlined at build time for the browser.
import type { TorcNetwork } from '../torc/circle';

export const NETWORK: TorcNetwork = (process.env.NEXT_PUBLIC_NETWORK === 'mainnet' ? 'mainnet' : 'chipnet');

const DEFAULT_ELECTRUM: Record<TorcNetwork, string[]> = {
  chipnet: ['chipnet.bch.ninja', 'chipnet.imaginary.cash'],
  mainnet: ['bch.imaginary.cash', 'electrum.imaginary.cash', 'bch.loping.net'],
};

/** Electrum WSS hosts in failover order (comma-separated env, hostnames or host:port). */
export function electrumHosts(network: TorcNetwork = NETWORK): string[] {
  const env = process.env.NEXT_PUBLIC_ELECTRUM_WSS;
  if (env && network === NETWORK) return env.split(',').map((s) => s.trim().replace(/^wss:\/\//, '')).filter(Boolean);
  return DEFAULT_ELECTRUM[network];
}

// Explorers per network ({id} = txid or address). Chosen by what actually loaded on 19 Nov 2026:
// chipnet: explorer.selene.cash loads every Torc chipnet tx (cbch.loping.net could not load them and
// chipnet.imaginary.cash refused connections); mainnet: 3xpl loads for everyone, while
// explorer.bitcoinunlimited.info shows a Cloudflare check to some visitors, so it is the alt.
interface Explorer { name: string; tx: string; address: string; stripPrefix?: boolean }
const PRIMARY: Record<TorcNetwork, Explorer> = {
  chipnet: { name: 'explorer.selene.cash', tx: 'https://explorer.selene.cash/tx/{id}?network=chipnet', address: 'https://explorer.selene.cash/address/{id}?network=chipnet' },
  mainnet: { name: '3xpl.com', tx: 'https://3xpl.com/bitcoin-cash/transaction/{id}', address: 'https://3xpl.com/bitcoin-cash/address/{id}', stripPrefix: true },
};
const ALT: Record<TorcNetwork, Explorer> = {
  chipnet: { name: 'cbch.loping.net', tx: 'https://cbch.loping.net/tx/{id}', address: 'https://cbch.loping.net/address/{id}' },
  mainnet: { name: 'explorer.bitcoinunlimited.info', tx: 'https://explorer.bitcoinunlimited.info/tx/{id}', address: 'https://explorer.bitcoinunlimited.info/address/{id}' },
};
const fill = (tpl: string, id: string) => tpl.replace('{id}', id);
export function explorerTx(txid: string, network: TorcNetwork = NETWORK): string {
  const env = network === NETWORK ? process.env.NEXT_PUBLIC_EXPLORER_TX : undefined;
  return env ? env + txid : fill(PRIMARY[network].tx, txid);
}
/** A second explorer for the same tx, for when the primary is down. */
export function explorerTxAlt(txid: string, network: TorcNetwork = NETWORK): string {
  return fill(ALT[network].tx, txid);
}
export const explorerAltName = (network: TorcNetwork = NETWORK) => ALT[network].name;
export function explorerAddress(address: string, network: TorcNetwork = NETWORK): string {
  const e = PRIMARY[network];
  return fill(e.address, e.stripPrefix ? address.replace(/^[a-z]+:/, '') : address);
}

/**
 * Browsers read the chain through the site's own /api/chain HTTPS relay by default (no console
 * noise where port 50004 is blocked). NEXT_PUBLIC_BROWSER_WSS=1 opts back into a direct Electrum
 * WebSocket for push updates, with the relay as fallback.
 */
export const BROWSER_WSS = process.env.NEXT_PUBLIC_BROWSER_WSS === '1';

export const REPO_URL = process.env.NEXT_PUBLIC_REPO_URL || 'https://github.com/levithefirst/torc';
export const DECK_URL = process.env.NEXT_PUBLIC_DECK_URL || '/deck';
export const DONATION_ADDRESS = process.env.NEXT_PUBLIC_DONATION_ADDRESS || '';

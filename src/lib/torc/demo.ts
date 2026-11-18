// The demo circle's "next step" engine. Shared by `npm run circle:tick` and POST /api/demo/tick.
// Holds no keys itself: callers pass the throwaway demo seat signers.
import { SignatureTemplate } from 'cashscript';
import type { TorcProvider } from '../chain/provider';
import { circleContract, type CircleParams } from './circle';
import { buildContribute, buildClaim, findState, memberNfts, type WalletSide } from './txs';
import { decodeState, nextAction, type CircleState } from './state';
import { keyInfo } from './keys';

export interface SeatSigner { privateKey: Uint8Array }

export type TickResult =
  | { ok: true; kind: 'contribute' | 'claim'; seat: number; txid: string; round: number }
  | { ok: false; reason: 'wait'; seconds: number; message: string }
  | { ok: false; reason: 'finished' | 'no-seat-key' | 'error'; message: string };

export async function readState(provider: TorcProvider, params: CircleParams) {
  const contract = circleContract(params, provider);
  const utxos = await contract.getUtxos();
  const stateUtxo = findState(params, utxos);
  return { contract, utxos, stateUtxo, state: decodeState(stateUtxo.token!.nft!.commitment) as CircleState };
}

/** Perform the next due action using whichever demo seat it belongs to. */
export async function tick(provider: TorcProvider, params: CircleParams, seats: SeatSigner[]): Promise<TickResult> {
  try {
    const { contract, utxos, state } = await readState(provider, params);
    const next = nextAction(state, params.seats, params.period);
    if (next.kind === 'finished') return { ok: false, reason: 'finished', message: 'This circle has finished all its rounds.' };

    // Find which demo key currently holds the seat NFT.
    let holder: { wallet: WalletSide } | undefined;
    for (const s of seats) {
      const k = keyInfo(s.privateKey, provider.network === 'mainnet' ? 'mainnet' : 'chipnet');
      const walletUtxos = await provider.getUtxos(k.address);
      const nft = memberNfts(params, walletUtxos).find((u) => u.token!.nft!.commitment.startsWith(next.seat.toString(16).padStart(2, '0')));
      if (nft) {
        holder = { wallet: { utxos: walletUtxos, unlocker: new SignatureTemplate(s.privateKey).unlockP2PKH(), address: k.address } };
        const memberNft = nft;
        if (next.kind === 'contribute') {
          const { builder } = buildContribute({ provider, params, contract, contractUtxos: utxos, wallet: holder.wallet, memberNft });
          const tx = await builder.send();
          return { ok: true, kind: 'contribute', seat: next.seat, txid: tx.txid, round: state.round };
        }
        const { mtp } = await provider.medianTimePast();
        // Consensus: a timestamp locktime must be strictly below the tip's median-time-past.
        const locktime = mtp - 1;
        if (locktime < next.opensAt) {
          const seconds = next.opensAt - locktime;
          return { ok: false, reason: 'wait', seconds, message: `Payout opens when the chain clock passes ${next.opensAt} (about ${Math.ceil(seconds / 60)} min of chain time).` };
        }
        const { builder } = buildClaim({ provider, params, contract, contractUtxos: utxos, wallet: holder.wallet, memberNft, locktime });
        const tx = await builder.send();
        return { ok: true, kind: 'claim', seat: next.seat, txid: tx.txid, round: state.round };
      }
    }
    return { ok: false, reason: 'no-seat-key', message: `Seat ${next.seat} is not held by a demo key (it may have been transferred).` };
  } catch (e) {
    return { ok: false, reason: 'error', message: String((e as Error)?.message ?? e) };
  }
}

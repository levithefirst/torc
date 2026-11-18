// Circle parameters and the covenant contract factory.
import { Contract, type NetworkProvider } from 'cashscript';
import { binToHex, hexToBin } from '@bitauth/libauth';
import TorcCircleArtifact from '../../contracts/TorcCircle.json' with { type: 'json' };
import TorcCircleBchArtifact from '../../contracts/TorcCircleBch.json' with { type: 'json' };

export type AssetMode = 'token' | 'bch';
export type TorcNetwork = 'chipnet' | 'mainnet';

/** Everything that defines a circle. Any change gives a different covenant address. */
export interface CircleParams {
  network: TorcNetwork;
  mode: AssetMode;
  /** Category (display / txid byte order) of the circle's state + member NFTs. */
  circleCategory: string;
  /** Category (display order) of the fungible asset. Token mode only. */
  assetCategory?: string;
  /** Per member per round, in token base units (token mode) or satoshis (bch mode). */
  contribution: bigint;
  seats: number; // 3..5
  period: number; // seconds
}

/** Sats kept on every token-carrying output we create (state, member NFT, contribution, pot). */
export const TOKEN_DUST = 1000n;
export const FEE_RATE = 1.0; // sat/byte
export const MIN_SEATS = 3;
export const MAX_SEATS = 5;

export function validateParams(p: CircleParams): void {
  if (!Number.isInteger(p.seats) || p.seats < MIN_SEATS || p.seats > MAX_SEATS) throw new Error('seats must be 3, 4 or 5');
  if (!Number.isInteger(p.period) || p.period < 60 || p.period > 400 * 86400) throw new Error('period out of range');
  if (p.contribution <= 0n) throw new Error('contribution must be positive');
  if (p.mode === 'bch' && p.contribution < 1000n) throw new Error('BCH-mode contribution must be at least 1000 sats');
  if (!/^[0-9a-f]{64}$/.test(p.circleCategory)) throw new Error('bad circleCategory');
  if (p.mode === 'token' && !/^[0-9a-f]{64}$/.test(p.assetCategory ?? '')) throw new Error('bad assetCategory');
}

/** Introspection pushes token categories in serialized (reversed) byte order. */
export const categoryArg = (displayHex: string) => binToHex(hexToBin(displayHex).reverse());

export function circleContract(p: CircleParams, provider: NetworkProvider): Contract {
  validateParams(p);
  if (p.mode === 'token') {
    return new Contract(
      TorcCircleArtifact as any,
      [categoryArg(p.circleCategory), categoryArg(p.assetCategory!), p.contribution, BigInt(p.seats), BigInt(p.period)],
      { provider, contractType: 'p2sh32' },
    ) as Contract;
  }
  return new Contract(
    TorcCircleBchArtifact as any,
    [categoryArg(p.circleCategory), p.contribution, BigInt(p.seats), BigInt(p.period)],
    { provider, contractType: 'p2sh32' },
  ) as Contract;
}

/** JSON-safe form of CircleParams (bigint as string) for env vars, URLs and storage. */
export interface CircleParamsJson extends Omit<CircleParams, 'contribution'> {
  contribution: string;
}
export const paramsToJson = (p: CircleParams): CircleParamsJson => ({ ...p, contribution: p.contribution.toString() });
export const paramsFromJson = (j: CircleParamsJson): CircleParams => ({ ...j, contribution: BigInt(j.contribution) });

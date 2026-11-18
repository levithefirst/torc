// Circle state NFT commitment codec.
// Layout (6 bytes, little-endian): round (1) | roundStart (4, unix seconds) | paidMask (1)
import { binToHex, hexToBin } from '@bitauth/libauth';

export interface CircleState {
  round: number; // 0..255
  roundStart: number; // unix seconds (locktime of the last payout, or genesis time)
  paidMask: number; // bit i = seat i paid this round
}

export const STATE_LEN = 6;
export const MEMBER_NFT_VERSION = 1;

export function encodeState(s: CircleState): string {
  if (s.round < 0 || s.round > 255) throw new Error('round out of range');
  if (s.paidMask < 0 || s.paidMask > 31) throw new Error('paidMask out of range');
  if (s.roundStart < 0 || s.roundStart >= 2 ** 31) throw new Error('roundStart out of range');
  const b = new Uint8Array(STATE_LEN);
  b[0] = s.round;
  new DataView(b.buffer).setUint32(1, s.roundStart, true);
  b[5] = s.paidMask;
  return binToHex(b);
}

export function decodeState(commitmentHex: string): CircleState {
  const b = hexToBin(commitmentHex);
  if (b.length !== STATE_LEN) throw new Error(`bad state length ${b.length}`);
  return {
    round: b[0]!,
    roundStart: new DataView(b.buffer, b.byteOffset).getUint32(1, true),
    paidMask: b[5]!,
  };
}

export function encodeMember(seat: number): string {
  if (seat < 0 || seat > 4) throw new Error('seat out of range');
  return binToHex(Uint8Array.of(seat, MEMBER_NFT_VERSION));
}

export function decodeMember(commitmentHex: string): number {
  const b = hexToBin(commitmentHex);
  if (b.length < 1) throw new Error('empty member commitment');
  return b[0]!;
}

export const turnSeat = (s: CircleState, seats: number) => s.round % seats;
export const fullMask = (seats: number) => (1 << seats) - 1;
export const hasPaid = (s: CircleState, seat: number) => ((s.paidMask >> seat) & 1) === 1;
export const paidCount = (s: CircleState, seats: number) =>
  Array.from({ length: seats }, (_, i) => i).filter((i) => hasPaid(s, i)).length;
export const allPaid = (s: CircleState, seats: number) => s.paidMask === fullMask(seats);
export const payoutOpensAt = (s: CircleState, period: number) => s.roundStart + period;

/** The next action the circle is waiting for. */
export type NextAction =
  | { kind: 'contribute'; seat: number }
  | { kind: 'claim'; seat: number; opensAt: number }
  | { kind: 'finished' };

export function nextAction(s: CircleState, seats: number, period: number): NextAction {
  if (s.round >= 255) return { kind: 'finished' };
  // Contributions go in seat order starting from the turn seat's neighbour; any unpaid seat is valid.
  for (let k = 0; k < seats; k++) {
    const seat = (turnSeat(s, seats) + 1 + k) % seats;
    if (!hasPaid(s, seat)) return { kind: 'contribute', seat };
  }
  return { kind: 'claim', seat: turnSeat(s, seats), opensAt: payoutOpensAt(s, period) };
}

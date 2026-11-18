import { describe, it, expect } from 'vitest';
import { setupCircle, contribute, claim, stateOf, tokenBalance, T0 } from './helpers';

describe('happy path', () => {
  for (const seats of [3, 5]) {
    it(`runs a full cycle for ${seats} seats (token mode)`, async () => {
      const c = await setupCircle(seats);
      const pot = c.params.contribution * BigInt(seats);
      let lt = T0;
      for (let round = 0; round < seats; round++) {
        for (const m of c.members) await contribute(c, m);
        const s = await stateOf(c);
        expect(s.paidMask).toBe((1 << seats) - 1);
        const turn = c.members[round % seats]!;
        const before = await tokenBalance(c, turn.address);
        lt = s.roundStart + c.params.period;
        await claim(c, turn, lt);
        expect(await tokenBalance(c, turn.address)).toBe(before + pot);
        const s2 = await stateOf(c);
        expect(s2).toEqual({ round: round + 1, roundStart: lt, paidMask: 0 });
      }
      // Everyone paid `seats` times and received the pot once: net zero.
      for (const m of c.members) expect(await tokenBalance(c, m.address)).toBe(c.params.contribution * BigInt(seats));
    });
  }
});

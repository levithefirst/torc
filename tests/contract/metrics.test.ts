import { describe, it, expect } from 'vitest';
import { writeFileSync, mkdirSync } from 'node:fs';
import { setupCircle, contribute, stateOf, nftOf, wallet, claim } from './helpers';
import { buildContribute, buildClaim } from '../../src/lib/torc/txs';

describe('metrics', () => {
  it('core loop: one full contribute -> claim cycle completes in < 10 s', async () => {
    const c = await setupCircle(3);
    const t0 = performance.now();
    for (const m of c.members) await contribute(c, m);
    const s = await stateOf(c);
    await claim(c, c.members[0]!, s.roundStart + c.params.period);
    const ms = performance.now() - t0;
    console.log(`core loop (3 contributes + 1 claim, MockNetworkProvider): ${ms.toFixed(0)} ms`);
    expect(ms).toBeLessThan(10_000);
  });

  it('records bytecode sizes and worst-case tx sizes', async () => {
    const out: Record<string, unknown> = {};
    for (const mode of ['token', 'bch'] as const) {
      for (const seats of [3, 5]) {
        const c = await setupCircle(seats, mode, mode === 'token' ? 100_000n : 5_000n, 86_400);
        const contribTb = buildContribute({
          provider: c.provider, params: c.params, contract: c.contract, contractUtxos: await c.contract.getUtxos(),
          wallet: await wallet(c.provider, c.members[1]!), memberNft: await nftOf(c, c.members[1]!),
        }).builder;
        const contribSize = Number(contribTb.getTransactionSize());
        const contribFee = Number(contribTb.calculateTransactionFee().feeSats);
        for (const m of c.members) await contribute(c, m);
        const s = await stateOf(c);
        const claimTb = buildClaim({
          provider: c.provider, params: c.params, contract: c.contract, contractUtxos: await c.contract.getUtxos(),
          wallet: await wallet(c.provider, c.members[0]!), memberNft: await nftOf(c, c.members[0]!), locktime: s.roundStart + c.params.period,
        }).builder;
        const claimSize = Number(claimTb.getTransactionSize());
        const claimFee = Number(claimTb.calculateTransactionFee().feeSats);
        const usage = claimTb.getVmResourceUsage();
        out[`${mode}-${seats}`] = {
          redeemScriptBytes: c.contract.bytesize,
          opcount: c.contract.opcount,
          contributeTxBytes: contribSize, contributeFeeSats: contribFee,
          claimTxBytes: claimSize, claimFeeSats: claimFee,
          perRoundFeeSats: contribFee * seats + claimFee,
          maxOpCost: Math.max(...usage.map((u) => Number(u.operationCost))),
        };
        expect(claimSize).toBeLessThan(100_000);
      }
    }
    console.table(out);
    mkdirSync('docs', { recursive: true });
    writeFileSync('docs/metrics.json', JSON.stringify(out, null, 2) + '\n');
  });
});

import { describe, it, expect } from 'vitest';
import { TransactionBuilder, randomUtxo, type Output } from 'cashscript';
import { hexToBin } from '@bitauth/libauth';
import { setupCircle, contribute, claim, stateOf, nftOf, wallet, newMember, fund, tokenBalance, ASSET, type Circle } from './helpers';
import { buildContribute, buildClaim, findState, findContributions } from '../../src/lib/torc/txs';
import { encodeState } from '../../src/lib/torc/state';

/** Move `sats` out of the change output (last output) so a tampered tx still balances. */
function takeFromChange(tb: TransactionBuilder, sats: bigint) {
  const last = tb.outputs[tb.outputs.length - 1]!;
  last.amount -= sats;
}

async function contributeBuilder(c: Circle, i: number) {
  const m = c.members[i]!;
  return buildContribute({
    provider: c.provider, params: c.params, contract: c.contract,
    contractUtxos: await c.contract.getUtxos(), wallet: await wallet(c.provider, m), memberNft: await nftOf(c, m),
  }).builder;
}

async function claimBuilder(c: Circle, i: number, locktime?: number) {
  const m = c.members[i]!;
  const s = await stateOf(c);
  return buildClaim({
    provider: c.provider, params: c.params, contract: c.contract,
    contractUtxos: await c.contract.getUtxos(), wallet: await wallet(c.provider, m), memberNft: await nftOf(c, m),
    locktime: locktime ?? s.roundStart + c.params.period, unsafeSkipChecks: true,
  }).builder;
}

async function allPay(c: Circle) {
  for (const m of c.members) await contribute(c, m);
}

describe('covenant rejects', () => {
  it('a double contribution in the same round', async () => {
    const c = await setupCircle(3);
    await contribute(c, c.members[1]!);
    // Rebuild a contribute for seat 1 by hand: buildContribute refuses, so forge the state locally.
    const utxos = await c.contract.getUtxos();
    const st = findState(c.params, utxos);
    const fake = { ...st, token: { ...st.token!, nft: { ...st.token!.nft!, commitment: encodeState({ ...(await stateOf(c)), paidMask: 0 }) } } };
    const tb = buildContribute({
      provider: c.provider, params: c.params, contract: c.contract,
      contractUtxos: [fake, ...utxos.filter((u) => u !== st)], wallet: await wallet(c.provider, c.members[1]!), memberNft: await nftOf(c, c.members[1]!),
    }).builder;
    tb.inputs[0] = { ...st, unlocker: tb.inputs[0]!.unlocker }; // spend the REAL state (bit already set)
    tb.outputs[0]!.token!.nft!.commitment = st.token!.nft!.commitment; // paidMask | bit == paidMask
    await expect(tb.send()).rejects.toThrow(/seat already paid this round/);
  });

  it('a claim by the wrong seat', async () => {
    const c = await setupCircle(3);
    await allPay(c);
    const tb = await claimBuilder(c, 1); // round 0 belongs to seat 0
    await expect(tb.send()).rejects.toThrow(/not this seat's turn/);
  });

  it('a claim before the period has elapsed', async () => {
    const c = await setupCircle(3);
    await allPay(c);
    const s = await stateOf(c);
    const tb = await claimBuilder(c, 0, s.roundStart + c.params.period - 1);
    await expect(tb.send()).rejects.toThrow(/payout not open yet|tx\.time/);
  });

  it('a claim while a seat has not paid', async () => {
    const c = await setupCircle(3);
    await contribute(c, c.members[0]!);
    await contribute(c, c.members[1]!);
    const tb = await claimBuilder(c, 0);
    await expect(tb.send()).rejects.toThrow(/not every seat has paid|missing contributions|contribution/);
  });

  it('a claim that swaps a contribution UTXO for the claimer\'s own tokens', async () => {
    const c = await setupCircle(3);
    await allPay(c);
    const tb = await claimBuilder(c, 0);
    const own = (await c.provider.getUtxos(c.members[0]!.address)).find((u) => u.token?.category === ASSET && !u.token.nft)!;
    // Replace contribution #3 (input 4) with the claimer's own token UTXO.
    tb.inputs[4] = { ...own, unlocker: c.members[0]!.sig.unlockP2PKH() };
    takeFromChange(tb, 3000n);
    tb.outputs.push({ to: c.members[0]!.tokenAddress, amount: 1000n, token: { category: ASSET, amount: own.token!.amount - c.params.contribution } });
    await expect(tb.send()).rejects.toThrow(/contribution not from the ring|contribution wrong/);
  });

  it('a pot redirected to anyone other than the turn seat', async () => {
    const c = await setupCircle(3);
    await allPay(c);
    const thief = newMember();
    const tb = await claimBuilder(c, 0);
    tb.outputs[1]!.to = thief.tokenAddress;
    await expect(tb.send()).rejects.toThrow(/pot must go to the turn seat/);
  });

  it('a pot that is short (claimer skims part of it)', async () => {
    const c = await setupCircle(3);
    await allPay(c);
    const thief = newMember();
    const tb = await claimBuilder(c, 0);
    tb.outputs[1]!.token!.amount -= 1n;
    takeFromChange(tb, 3000n);
    tb.outputs.push({ to: thief.tokenAddress, amount: 1000n, token: { category: ASSET, amount: 1n } });
    await expect(tb.send()).rejects.toThrow(/pot must be the full pot/);
  });

  it('pooled money moving inside a contribute tx (extra asset output)', async () => {
    const c = await setupCircle(3);
    await contribute(c, c.members[0]!);
    const tb = await contributeBuilder(c, 1);
    const pooled = findContributions(c.params, await c.contract.getUtxos())[0]!;
    const thief = newMember();
    tb.inputs.splice(2, 0, { ...pooled, unlocker: c.contract.unlock.pool!() });
    takeFromChange(tb, 1000n);
    tb.outputs.push({ to: thief.tokenAddress, amount: 1000n, token: { category: ASSET, amount: c.params.contribution } });
    await expect(tb.send()).rejects.toThrow(/pool only moves in a claim/);
  });

  it('an extra pooled UTXO in a claim, sent elsewhere (extra asset output)', async () => {
    const c = await setupCircle(3);
    await allPay(c);
    // Someone sends a contribution-shaped UTXO straight to the covenant.
    c.provider.addUtxo(c.contract.tokenAddress, randomUtxo({ satoshis: 1000n, token: { category: ASSET, amount: c.params.contribution } }));
    const tb = await claimBuilder(c, 0);
    const stray = findContributions(c.params, await c.contract.getUtxos()).find((u) => !tb.inputs.some((i) => i.txid === u.txid && i.vout === u.vout))!;
    const thief = newMember();
    tb.inputs.splice(5, 0, { ...stray, unlocker: c.contract.unlock.pool!() });
    takeFromChange(tb, 1000n);
    tb.outputs.push({ to: thief.tokenAddress, amount: 1000n, token: { category: ASSET, amount: c.params.contribution } });
    await expect(tb.send()).rejects.toThrow(/too many pool inputs/);
  });

  it('spending the state NFT through pool()', async () => {
    const c = await setupCircle(3);
    const tb = await contributeBuilder(c, 0);
    tb.inputs[0] = { ...tb.inputs[0]!, unlocker: c.contract.unlock.pool!() };
    await expect(tb.send()).rejects.toThrow(/pool inputs start at index 2/);
  });

  it('the state leaving the covenant', async () => {
    const c = await setupCircle(3);
    const tb = await contributeBuilder(c, 0);
    tb.outputs[0]!.to = c.members[0]!.tokenAddress;
    await expect(tb.send()).rejects.toThrow(/state must stay in the ring/);
  });

  it('minting a second state NFT (consensus: one mutable input, one NFT out)', async () => {
    const c = await setupCircle(3);
    const tb = await contributeBuilder(c, 0);
    const extra: Output = { to: c.members[0]!.tokenAddress, amount: 1000n, token: { category: c.params.circleCategory, amount: 0n, nft: { capability: 'mutable', commitment: tb.outputs[0]!.token!.nft!.commitment } } };
    takeFromChange(tb, 1200n);
    tb.outputs.push(extra);
    const err = await tb.send().then(() => null, (e: Error) => e.message);
    expect(err).toMatch(/violates token validation/i);
  });

  it('minting a second member NFT for the same seat', async () => {
    const c = await setupCircle(3);
    const tb = await contributeBuilder(c, 0);
    takeFromChange(tb, tb.outputs[2]!.amount + 200n);
    tb.outputs.push({ ...tb.outputs[2]!, token: { ...tb.outputs[2]!.token!, nft: { ...tb.outputs[2]!.token!.nft! } } });
    const err = await tb.send().then(() => null, (e: Error) => e.message);
    expect(err).toMatch(/violates token validation/i);
  });
});

describe('seat transfer', () => {
  it('the new holder of a seat NFT contributes and claims', async () => {
    const c = await setupCircle(3);
    // Round 0: everyone pays, seat 0 claims.
    await allPay(c);
    let s = await stateOf(c);
    await claim(c, c.members[0]!, s.roundStart + c.params.period);

    // Seat 1 sells their seat to Newbie: a plain P2PKH transfer of the member NFT.
    const newbie = newMember();
    fund(c.provider, newbie, { sats: 200_000n, tokens: c.params.contribution * 3n });
    const seller = c.members[1]!;
    const nft = await nftOf(c, seller);
    const fee = (await c.provider.getUtxos(seller.address)).find((u) => !u.token)!;
    const t = new TransactionBuilder({ provider: c.provider })
      .addInput(nft, seller.sig.unlockP2PKH())
      .addInput(fee, seller.sig.unlockP2PKH())
      .addOutput({ to: newbie.tokenAddress, amount: nft.satoshis, token: nft.token! })
      .addBchChangeOutputIfNeeded({ to: seller.address, feeRate: 1 });
    await t.send();
    c.members[1] = newbie;

    // Round 1: everyone pays (Newbie pays for seat 1), Newbie claims the pot.
    await allPay(c);
    s = await stateOf(c);
    const before = await tokenBalance(c, newbie.address);
    await claim(c, newbie, s.roundStart + c.params.period);
    expect(await tokenBalance(c, newbie.address)).toBe(before + c.params.contribution * 3n);
    // The old holder can no longer act for seat 1.
    await expect(nftOf(c, seller)).rejects.toThrow();
  });
});

describe('BCH mode', () => {
  it('runs a full 3-seat cycle in satoshis', async () => {
    const c = await setupCircle(3, 'bch', 5_000n, 600);
    for (let round = 0; round < 3; round++) {
      await allPay(c);
      const s = await stateOf(c);
      const turn = c.members[round]!;
      const before = (await c.provider.getUtxos(turn.address)).filter((u) => !u.token).reduce((a, u) => a + u.satoshis, 0n);
      await claim(c, turn, s.roundStart + c.params.period);
      const after = (await c.provider.getUtxos(turn.address)).filter((u) => !u.token).reduce((a, u) => a + u.satoshis, 0n);
      // Received the 15,000-sat pot minus the claim fee (< 3,000 sats).
      expect(after - before).toBeGreaterThan(15_000n - 3_000n);
      expect((await stateOf(c)).round).toBe(round + 1);
    }
  });

  it('rejects a BCH pot redirected to a thief', async () => {
    const c = await setupCircle(3, 'bch', 5_000n, 600);
    await allPay(c);
    const tb = await claimBuilder(c, 0);
    tb.outputs[1]!.to = newMember().address;
    await expect(tb.send()).rejects.toThrow(/pot must go to the turn seat/);
  });
});

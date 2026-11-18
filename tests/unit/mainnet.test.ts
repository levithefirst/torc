import { describe, it, expect } from 'vitest';
import { MockNetworkProvider, SignatureTemplate, randomUtxo } from 'cashscript';
import { generatePrivateKey, decodeAuthenticationInstructions, hexToBin } from '@bitauth/libauth';
import { keyInfo } from '../../src/lib/torc/keys';
import { buildGenesis, buildContribute, buildClaim, memberNfts, findState, decodeParamsOpReturn, encodeParamsOpReturn } from '../../src/lib/torc/txs';
import { circleContract, type CircleParams } from '../../src/lib/torc/circle';
import { decodeState } from '../../src/lib/torc/state';
import { electrumHosts, explorerTx } from '../../src/lib/chain/config';

const PUSD = '2469acc5afa4b10cb5b5c04afb89c3a3ffd61c5da9c01e26d00951cae2a02544';

/** A MockNetworkProvider that validates addresses as mainnet (bitcoincash:). */
function mainnetMock() {
  const p = new MockNetworkProvider();
  (p as { network: string }).network = 'mainnet';
  return p;
}

describe('mainnet path (env switch only)', () => {
  it('derives bitcoincash: covenant and member addresses', () => {
    const p = mainnetMock();
    const params: CircleParams = { network: 'mainnet', mode: 'token', circleCategory: 'ab'.repeat(32), assetCategory: PUSD, contribution: 10n, seats: 3, period: 86400 };
    const c = circleContract(params, p);
    expect(c.tokenAddress).toMatch(/^bitcoincash:r/);
    expect(keyInfo(generatePrivateKey(), 'mainnet').tokenAddress).toMatch(/^bitcoincash:z/);
    expect(electrumHosts('mainnet')).toContain('bch.imaginary.cash');
    expect(explorerTx('00'.repeat(32), 'mainnet')).toMatch(/^https:\/\/explorer\.bitcoinunlimited\.info\/tx\//);
  });

  it('runs a 0.10 PUSD, 3-seat round on a mainnet-prefixed mock chain', async () => {
    const p = mainnetMock();
    const keys = Array.from({ length: 4 }, () => keyInfo(generatePrivateKey(), 'mainnet'));
    const sig = keys.map((k) => new SignatureTemplate(k.privateKey));
    const [creator, ...members] = keys;
    p.addUtxo(creator!.address, randomUtxo({ vout: 0, satoshis: 100_000n }));
    for (const m of members) {
      p.addUtxo(m.address, randomUtxo({ satoshis: 50_000n }));
      p.addUtxo(m.address, randomUtxo({ satoshis: 1000n, token: { category: PUSD, amount: 100n } }));
    }
    const wallet = async (i: number) => ({ utxos: await p.getUtxos(keys[i]!.address), unlocker: sig[i]!.unlockP2PKH(), address: keys[i]!.address });
    const g = buildGenesis({ provider: p, params: { network: 'mainnet', mode: 'token', assetCategory: PUSD, contribution: 10n, seats: 3, period: 86400 }, wallet: await wallet(0), members: members.map((m) => m.address), startTime: 1_800_000_000 });
    await g.builder.send();
    for (let i = 1; i <= 3; i++) {
      const w = await wallet(i);
      const { builder } = buildContribute({ provider: p, params: g.params, contract: g.contract, contractUtxos: await g.contract.getUtxos(), wallet: w, memberNft: memberNfts(g.params, w.utxos)[0]! });
      await builder.send();
    }
    const w1 = await wallet(1);
    const { builder } = buildClaim({ provider: p, params: g.params, contract: g.contract, contractUtxos: await g.contract.getUtxos(), wallet: w1, memberNft: memberNfts(g.params, w1.utxos)[0]!, locktime: 1_800_086_400 });
    await builder.send();
    const st = decodeState(findState(g.params, await g.contract.getUtxos()).token!.nft!.commitment);
    expect(st).toEqual({ round: 1, roundStart: 1_800_086_400, paidMask: 0 });
    const pusd = (await p.getUtxos(members[0]!.address)).filter((u) => u.token?.category === PUSD).reduce((a, u) => a + u.token!.amount, 0n);
    expect(pusd).toBe(100n - 10n + 30n);
  });
});

describe('self-describing genesis', () => {
  it('round-trips the circle params through the OP_RETURN', () => {
    for (const params of [
      { network: 'chipnet', mode: 'token', circleCategory: '11'.repeat(32), assetCategory: PUSD, contribution: 10n, seats: 3, period: 600 },
      { network: 'mainnet', mode: 'bch', circleCategory: '22'.repeat(32), contribution: 2000n, seats: 5, period: 7 * 86400 },
    ] as CircleParams[]) {
      const chunks = encodeParamsOpReturn(params).map((c) => (c.startsWith('0x') ? hexToBin(c.slice(2)) : new TextEncoder().encode(c)));
      const back = decodeParamsOpReturn(chunks, params.circleCategory, params.network);
      expect(back).toEqual({ ...params, assetCategory: params.mode === 'token' ? params.assetCategory : undefined });
    }
  });

  it('is written into a real genesis transaction', async () => {
    const p = new MockNetworkProvider();
    const k = keyInfo(generatePrivateKey(), 'chipnet');
    p.addUtxo(k.address, randomUtxo({ vout: 0, satoshis: 100_000n }));
    const g = buildGenesis({ provider: p, params: { network: 'chipnet', mode: 'bch', contribution: 2000n, seats: 3, period: 600 }, wallet: { utxos: await p.getUtxos(k.address), unlocker: new SignatureTemplate(k.privateKey).unlockP2PKH(), address: k.address }, members: [k.address, k.address, k.address], startTime: 1 });
    const tx = await g.builder.send();
    const op = tx.outputs.find((o) => o.lockingBytecode[0] === 0x6a)!;
    const chunks = (decodeAuthenticationInstructions(op.lockingBytecode.slice(1)) as { data: Uint8Array }[]).map((x) => x.data);
    expect(decodeParamsOpReturn(chunks, g.params.circleCategory, 'chipnet')).toEqual({ ...g.params, assetCategory: undefined });
  });
});

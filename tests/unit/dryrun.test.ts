import { describe, it, expect } from 'vitest';
import { dryRunGenesis, exampleAddress } from '../../src/lib/app/dryRun';

const PUSD = '2469acc5afa4b10cb5b5c04afb89c3a3ffd61c5da9c01e26d00951cae2a02544';

describe('/new dry run (no wallet)', () => {
  it('builds a mainnet genesis with empty member fields (example addresses)', () => {
    const r = dryRunGenesis({ network: 'mainnet', mode: 'token', assetCategory: PUSD, contribution: 10n, seats: 3, period: 86400 }, ['', '', '']);
    expect(r.covenant).toMatch(/^bitcoincash:r/);
    expect(r.outputs).toBe(6);
    expect(r.size).toBeGreaterThan(300);
  });

  it('builds a mainnet BCH-mode genesis with real mainnet member addresses', () => {
    const members = [0, 1, 2, 3].map((i) => exampleAddress(i + 10, 'mainnet'));
    const r = dryRunGenesis({ network: 'mainnet', mode: 'bch', contribution: 2000n, seats: 4, period: 604800 }, members);
    expect(r.covenant).toMatch(/^bitcoincash:r/);
    expect(r.outputs).toBe(7);
  });

  it('still builds on chipnet', () => {
    const r = dryRunGenesis({ network: 'chipnet', mode: 'bch', contribution: 2000n, seats: 3, period: 600 }, ['', '', '']);
    expect(r.covenant).toMatch(/^bchtest:r/);
  });
});

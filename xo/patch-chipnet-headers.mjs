// Sandbox-only workaround for an upstream bug (reported in docs/XO-FEEDBACK.md notes):
// @electrum-cash/application (via @electrum-cash/checkpoint 0.7.2) rejects chipnet header 332451, which
// claims the minimum-difficulty target 0x1d00ffff, and then header 332452 because its ASERT result for chipnet
// does not match the chain. On networks with allowMinimumDifficultyBlocks (testnets only; false on mainnet)
// this accepts the header's claimed target; linkage and proof-of-work against that target are still checked.
import { readFileSync, writeFileSync } from 'node:fs';
const f = 'node_modules/@electrum-cash/application/dist/index.mjs';
let s = readFileSync(f, 'utf8');
const marker = 'const expectedDifficultyTarget = await calculateExpectedDifficultyTarget(blockHeight, blockHeader, parentHeader, difficultyParameters);';
if (!s.includes('TORC_CHIPNET_MINDIFF_PATCH2')) {
  if (!s.includes(marker)) throw new Error('patch point not found');
  s = s.replace(marker, `let expectedDifficultyTarget = await calculateExpectedDifficultyTarget(blockHeight, blockHeader, parentHeader, difficultyParameters);
	/* TORC_CHIPNET_MINDIFF_PATCH2 */ if (difficultyParameters.allowMinimumDifficultyBlocks && blockHeader.target <= difficultyParameters.minimumDifficultyTarget) expectedDifficultyTarget = blockHeader.target;`);
  writeFileSync(f, s);
  console.log('patched', f);
} else console.log('already patched');

// npm run keys:new -- <name> [<name>...]   Generates THROWAWAY keys only. Prints each WIF once.
import { newPrivateKey, keyInfo, toWif } from '../src/lib/torc/keys';
import { NETWORK, saveWif, wifPath } from './lib';

const names = process.argv.slice(2).filter((a) => !a.startsWith('--'));
if (!names.length) {
  console.error('usage: npm run keys:new -- <name> [...]');
  process.exit(1);
}
for (const name of names) {
  const pk = newPrivateKey();
  const k = keyInfo(pk, NETWORK);
  saveWif(name, toWif(pk, NETWORK));
  console.log(`\n[${NETWORK}] ${name}  (THROWAWAY, stored in ${wifPath(name)})`);
  console.log(`  WIF (shown once): ${toWif(pk, NETWORK)}`); // secret-scan: allow
  console.log(`  address:        ${k.address}`);
  console.log(`  token address:  ${k.tokenAddress}`);
}

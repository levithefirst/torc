// Runs Torc's XO template on the real XO engine (chipnet). Designed for a throwaway sandbox VM:
// the BIP39 mnemonic is generated there, stored at ~/.torc-xo/mnemonic (0600), never printed.
//   node xo-runner.mjs setup            -> engine up, template imported, prints the seat address
//   node xo-runner.mjs contribute job.json  -> creates + fills + signs + executes a contribute invitation
import { mkdirSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { Engine, XO_SUPPORTED_NETWORKS } from '@xo-cash/engine';
import { StorageType } from '@xo-cash/state';
import { generateBip39Mnemonic, hexToBin, binToHex, lockingBytecodeToCashAddress } from '@bitauth/libauth';

const dir = join(homedir(), '.torc-xo');
mkdirSync(dir, { recursive: true, mode: 0o700 });
const mnemonicPath = join(dir, 'mnemonic');
if (!existsSync(mnemonicPath)) writeFileSync(mnemonicPath, generateBip39Mnemonic(), { mode: 0o600 });
const statePath = join(dir, 'state.json');
const state = existsSync(statePath) ? JSON.parse(readFileSync(statePath, 'utf8')) : {};
const save = () => writeFileSync(statePath, JSON.stringify(state, null, 2));
const j = (o) => JSON.stringify(o, (k, v) => (typeof v === 'bigint' ? v.toString() : v instanceof Uint8Array ? binToHex(v) : v), 2);
// createInvitation / appendInvitation return a StoredInvitation wrapper around the shared invitation.
const idOf = (x) => x?.invitation?.invitationIdentifier ?? x?.invitationIdentifier;
const log = (label, o) => console.log(`--- ${label}\n${typeof o === 'string' ? o : j(o)}`);

const engine = await Engine.create(readFileSync(mnemonicPath, 'utf8').trim(), {
  network: XO_SUPPORTED_NETWORKS.chipnet,
  storageType: StorageType.INDEXEDDB,
  databasePath: dir,
  databaseFilename: 'torc-xo',
});
try {
  const template = readFileSync(new URL('./torc-contribute.template.json', import.meta.url), 'utf8');
  const { templateIdentifier } = await engine.importTemplate(template);
  state.templateIdentifier = templateIdentifier;
  log('templateIdentifier', templateIdentifier);
  const cmd = process.argv[2];

  if (cmd === 'setup') {
    const t = await engine.getTemplate(templateIdentifier);
    log('start actions', t?.start);
    // A dedicated throwaway XO wallet: Torc's template provides its address/receive/change defaults.
    let lock;
    {
      // The seat address comes from a receiveSeat invitation: when it is spent later, the engine
      // compiles with the keys of the invitation that created it.
      const inv = await engine.createInvitation({ templateIdentifier, actionIdentifier: 'receiveSeat', intent: t.start.find((s) => s.action === 'receiveSeat') });
      state.receiveInvitation = idOf(inv);
      log('receive invitation', idOf(inv));
      lock = await engine.resolveInvitationOutputLockingBytecode(idOf(inv), 'seatReceiveOutput', 'member');
    }
    const hex = typeof lock === 'string' ? lock : binToHex(lock);
    const addr = lockingBytecodeToCashAddress({ bytecode: hexToBin(hex), prefix: 'bchtest', tokenSupport: true });
    state.seatLock = hex;
    state.seatAddress = typeof addr === 'string' ? addr : addr.address;
    save();
    log('SEAT_ADDRESS', state.seatAddress);
  }

  if (cmd === 'dump') {
    const b = await engine.buildInvitationTransactionFromMergedCommit(process.argv[3]);
    writeFileSync(join(dir, 'tx.hex'), b.serializedTransaction);
    console.log('TXHEX ' + b.serializedTransaction);
  }

  if (cmd === 'utxos') {
    const u = await engine.listUnspentOutputs();
    log('unspent outputs', u);
  }

  if (cmd === 'contribute') {
    const job = JSON.parse(readFileSync(process.argv[3], 'utf8'));
    // Wait until the engine has synced the UTXOs we are about to spend.
    for (let k = 0; k < 30; k++) {
      const u = await engine.listUnspentOutputs();
      const have = job.inputs.slice(1).every((i) => u.some((x) => x.outpointTransactionHash === i.txid && x.outpointIndex === i.vout));
      log(`sync ${k}`, `${u.length} tracked outputs, member inputs tracked: ${have}`);
      if (have) break;
      await new Promise((r) => setTimeout(r, 3000));
    }
    let inv = await engine.createInvitation({ templateIdentifier, actionIdentifier: 'contribute', intent: { action: 'contribute', role: 'member' } });
    const id = idOf(inv);
    log('invitation', id);
    log('requirements', await engine.listRequirements(inv.invitation ?? inv));
    try { inv = await engine.joinInvitationRole(id, 'member'); } catch (e) { log('join member', String(e?.message ?? e)); }
    try { inv = await engine.joinInvitationRole(id, 'circle'); } catch (e) { log('join circle', String(e?.message ?? e)); }
    // Numbers must be BigInt: the engine stores them as extended JSON ("20000n"); a plain number
    // comes back as the string "20000", which CashAssembly then reads as UTF-8 bytes.
    const big = (v) => (typeof v === 'number' ? BigInt(v) : v);
    const vars = [
      ...Object.entries(job.circle).map(([variableIdentifier, value]) => ({ variableIdentifier, roleIdentifier: 'circle', value: big(value) })),
      ...Object.entries(job.member).map(([variableIdentifier, value]) => ({ variableIdentifier, roleIdentifier: 'member', value: big(value) })),
    ];
    vars.push({ variableIdentifier: 'memberLockingScript', roleIdentifier: 'member', value: state.seatLock });
    inv = await engine.appendInvitation(id, { variables: vars });
    inv = await engine.appendInvitation(id, { inputs: job.inputs.map((i, k) => ({ inputIdentifier: ['stateInput', 'seatInput', 'paymentInput'][k], roleIdentifier: k === 0 ? 'circle' : 'member', outpointTransactionHash: hexToBin(i.txid), outpointIndex: i.vout })) });
    inv = await engine.appendInvitation(id, {
      outputs: [{ outputIdentifier: 'stateOutput' }, { outputIdentifier: 'contributionOutput' }, { outputIdentifier: 'seatReturnOutput' }, { outputIdentifier: 'paymentChangeOutput' }],
    });
    inv = await engine.appendInvitation(id, { transactionLocktime: 0, transactionVersion: 2 });
    log('missing requirements', await engine.listMissingRequirements(id));
    for (const idx of await engine.listOwnInputIndexes(id).catch(() => [])) {
      try { inv = await engine.signInvitation(id, idx); } catch (e) { log(`sign ${idx}`, String(e?.message ?? e)); }
    }
    try { inv = await engine.signInvitation(id); } catch (e) { log('sign all', String(e?.message ?? e)); }
    const result = await engine.executeAction(id, { broadcastTransaction: true });
    log('EXECUTE_RESULT', result);
    state.lastInvitation = id;
    save();
  }
} finally {
  await engine.stop();
}

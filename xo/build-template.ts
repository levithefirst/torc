// Generates xo/torc-contribute.template.json from the compiled TorcCircle artifact, so the
// covenant bytes inside the XO template can never drift from contracts/TorcCircle.cash.
// Run: npx tsx xo/build-template.ts   (validated with @xo-cash/utils parseTemplate)
import { writeFileSync } from 'node:fs';
import { scriptToBytecode, asmToScript } from '@cashscript/utils';
import { binToHex } from '@bitauth/libauth';
import { parseTemplate } from '@xo-cash/utils';
import artifact from '../src/contracts/TorcCircle.json' with { type: 'json' };

const body = binToHex(scriptToBytecode(asmToScript(artifact.bytecode)));
const n = (name: string, description: string, icon: string) => ({ name, description, icon });

const template = {
  $schema: 'https://libauth.org/schemas/wallet-template-v0.schema.json',
  name: 'Torc circle',
  description: 'Rotating savings circle (ajo / esusu): every member pays a fixed amount each round into a covenant that pays the whole pot only to the member whose turn it is.',
  icon: 'circle',
  version: '1',
  supported: ['BCH_2025_05', 'BCH_2026_05'],
  resources: [
    { name: 'Torc covenant source', description: 'contracts/TorcCircle.cash (CashScript 0.14). The redeem script below is its compiled bytecode.', url: 'https://github.com/levithefirst/torc/blob/main/contracts/TorcCircle.cash' },
  ],
  roles: {
    member: n('Member', 'Holds a seat NFT of the circle and pays the fixed contribution each round.', 'user'),
    circle: n('Circle', 'The Torc app: supplies the circle’s live state NFT UTXO and its parameters.', 'contract'),
  },
  start: [{ action: 'receiveSeat', role: 'member', generate: ['memberKey'] }],
  actions: {
    receiveSeat: {
      ...n('Receive a seat', 'Get a key-controlled address to receive a circle seat NFT and the asset to pay with.', 'receive'),
      roles: { member: { ...n('Receive a seat', 'Receive a seat NFT at a key this wallet controls.', 'receive'), requirements: { secrets: ['memberKey'] } } },
      requirements: { participants: [{ role: 'member', slots: { min: 1, max: 1 } }] },
      transaction: 'receiveSeatTransaction',
    },
    contribute: {
      ...n('Pay into the circle', 'Pay this round’s fixed contribution into the Torc covenant. The covenant marks the seat as paid.', 'send'),
      roles: {
        member: {
          ...n('Pay into the circle', 'Pay $(<contribution>) units of the circle asset for seat $(<seatCommitment> <1> OP_SPLIT OP_DROP OP_BIN2NUM <1> OP_ADD).', 'send'),
          requirements: { variables: ['seatCommitment', 'seatSatoshis', 'paymentTokens', 'paymentSatoshis', 'memberLockingScript'] },
        },
        circle: {
          ...n('Provide circle state', 'Supply the circle’s current state UTXO and parameters.', 'contract'),
          requirements: { variables: ['circleCategory', 'assetCategory', 'contribution', 'seats', 'period', 'stateSatoshis', 'stateCommitment'] },
        },
      },
      requirements: { participants: [{ role: 'member', slots: { min: 1, max: 1 } }, { role: 'circle', slots: { min: 1, max: 1 } }] },
      transaction: 'contributeTransaction',
    },
  },
  transactions: {
    receiveSeatTransaction: {
      ...n('Received a seat', 'Received a Torc seat.', 'receive'),
      inputs: [],
      outputs: [{ output: 'seatReceiveOutput' }],
    },
    contributeTransaction: {
      ...n('Paid into the circle', 'Paid $(<contribution>) into a Torc circle; next state $(nextStateCommitment).', 'send'),
      inputs: [
        { input: 'stateInput', inputIndex: 0 },
        { input: 'seatInput', inputIndex: 1 },
        { input: 'paymentInput', inputIndex: 2 },
      ],
      outputs: [
        { output: 'stateOutput', outputIndex: 0 },
        { output: 'contributionOutput', outputIndex: 1 },
        { output: 'seatReturnOutput', outputIndex: 2 },
        { output: 'paymentChangeOutput', outputIndex: 3 },
      ],
    },
  },
  inputs: {
    stateInput: {
      ...n('Circle state', 'The circle’s state NFT (round, round start, paid seats).', 'contract'),
      valueSatoshis: '$(<stateSatoshis>)',
      token: { category: '$(<circleCategory>)', amount: '0', nft: { capability: 'mutable', commitment: '$(<stateCommitment>)' } },
      unlockingScript: 'unlockContribute',
    },
    seatInput: {
      ...n('Your seat', 'The member NFT that proves which seat is paying.', 'ticket'),
      valueSatoshis: '$(<seatSatoshis>)',
      token: { category: '$(<circleCategory>)', amount: '0', nft: { capability: 'none', commitment: '$(<seatCommitment>)' } },
      unlockingScript: 'unlockSeat',
    },
    paymentInput: {
      ...n('Payment', 'The asset tokens (and sats) that pay the contribution and the miner fee.', 'send'),
      valueSatoshis: '$(<paymentSatoshis>)',
      token: { category: '$(<assetCategory>)', amount: '$(<paymentTokens>)', nft: null },
      unlockingScript: 'unlockSeat',
    },
  },
  outputs: {
    seatReceiveOutput: {
      ...n('Seat address', 'Where the circle organizer sends this member’s seat NFT and asset.', 'receive'),
      lockingScript: 'seatLockingScript',
    },
    stateOutput: {
      ...n('Circle state', 'State NFT with this seat’s paid bit set. Same round, same round start.', 'contract'),
      lockingScript: 'torcCovenant',
      valueSatoshis: '$(<stateSatoshis>)',
      token: { category: '$(<circleCategory>)', amount: '0', nft: { capability: 'mutable', commitment: '$(nextStateCommitment)' } },
      roles: { member: { relevant: false } },
    },
    contributionOutput: {
      ...n('Contribution', 'Exactly one contribution, locked in the circle until the turn seat claims the pot.', 'contract'),
      lockingScript: 'torcCovenant',
      valueSatoshis: '$(<contributionDust>)',
      token: { category: '$(<assetCategory>)', amount: '$(<contribution>)', nft: null },
    },
    seatReturnOutput: {
      ...n('Your seat', 'The member NFT, returned unchanged.', 'ticket'),
      lockingScript: '$(<memberLockingScript>)',
      valueSatoshis: '$(<seatSatoshis>)',
      token: { category: '$(<circleCategory>)', amount: '0', nft: { capability: 'none', commitment: '$(<seatCommitment>)' } },
    },
    paymentChangeOutput: {
      ...n('Asset change', 'Remaining asset tokens and sats back to the member, after the contribution and the miner fee.', 'receive'),
      lockingScript: '$(<memberLockingScript>)',
      valueSatoshis: '$(<paymentSatoshis> <contributionDust> OP_SUB <minerFeeSatoshis> OP_SUB)',
      token: { category: '$(<assetCategory>)', amount: '$(<paymentTokens> <contribution> OP_SUB)', nft: null },
    },
  },
  lockingScripts: {
    torcCovenant: {
      ...n('Torc covenant', 'P2SH32 TorcCircle covenant: holds the state NFT and the pot. Pays only the turn seat.', 'contract'),
      lockingType: 'p2sh',
      lockingBytecode: 'torcLockingBytecode',
      selectable: false,
      roles: { member: { relevant: false } },
    },
    seatLockingScript: {
      ...n('Seat key', 'A key this wallet controls, holding the member NFT and the asset to pay with.', 'address'),
      lockingType: 'p2pkh',
      lockingBytecode: 'lockSeat',
      unlockingBytecode: 'unlockSeat',
      roles: {
        member: {
          state: { variables: [], secrets: ['memberKey'] },
          actions: [{ action: 'contribute', role: 'member', secrets: [{ memberKey: null }] }],
          balance: { satoshis: true, fungibleTokens: true, nonfungibleTokens: true },
          selectable: true,
        },
      },
    },
  },
  scripts: {
    // The TorcCircle redeem script exactly as CashScript builds it: constructor args (reversed order,
    // categories in serialized byte order) then the compiled body.
    torcRedeemBytecode: `<period> <seats> <contribution> <$(<assetCategory> OP_REVERSEBYTES)> <$(<circleCategory> OP_REVERSEBYTES)> 0x${body}`,
    torcLockingBytecode: 'OP_HASH256 <$(<torcRedeemBytecode> OP_HASH256)> OP_EQUAL',
    // contribute() is function 0 of TorcCircle: selector, then the redeem script.
    unlockContribute: '<0> <torcRedeemBytecode>',
    lockSeat: 'OP_DUP OP_HASH160 <$(<memberKey.public_key> OP_HASH160)> OP_EQUALVERIFY OP_CHECKSIG',
    unlockSeat: '<memberKey.schnorr_signature.all_outputs> <memberKey.public_key>',
    // 2^seat via the same lookup table the covenant uses.
    seatBit: '<0x0102040810> <$(<seatCommitment> <1> OP_SPLIT OP_DROP OP_BIN2NUM)> OP_SPLIT OP_NIP <1> OP_SPLIT OP_DROP OP_BIN2NUM',
    // round | roundStart unchanged; paidMask + bit.
    nextStateCommitment: '<stateCommitment> <5> OP_SPLIT OP_BIN2NUM seatBit OP_ADD <1> OP_NUM2BIN OP_CAT',
  },
  constants: {
    contributionDust: { ...n('Contribution dust', 'Sats every contribution UTXO carries (enforced by the covenant).', 'coins'), type: 'satoshis', value: '1000' },
    minerFeeSatoshis: { ...n('Miner fee', 'Fixed fee for a contribute transaction (~1.3 kB at 1 sat/byte).', 'coins'), type: 'satoshis', value: '1600' },
  },
  variables: {
    memberKey: { ...n('Seat key', 'The private key controlling this member’s seat NFT.', 'key'), type: 'private_key' },
    circleCategory: { ...n('Circle', 'Category of the circle’s state and member NFTs.', 'circle'), type: 'token_category' },
    assetCategory: { ...n('Asset', 'The fungible token the circle saves in (PUSD on mainnet, tPUSD on chipnet).', 'coins'), type: 'token_category' },
    contribution: { ...n('Contribution', 'Fixed amount each member pays per round, in token base units.', 'coins'), type: 'token_amount' },
    seats: { ...n('Seats', 'Number of members (3 to 5).', 'users'), type: 'integer' },
    period: { ...n('Round length', 'Minimum seconds between payouts.', 'clock'), type: 'integer' },
    stateSatoshis: { ...n('State sats', 'Sats on the state NFT UTXO (constant).', 'coins'), type: 'satoshis' },
    stateCommitment: { ...n('Circle state', 'round (1) | roundStart (4 LE) | paidMask (1).', 'contract'), type: 'bytes' },
    seatCommitment: { ...n('Seat', 'Member NFT commitment: seat index (1) | version (1).', 'ticket'), type: 'bytes' },
    seatSatoshis: { ...n('Seat sats', 'Sats on the member NFT UTXO.', 'coins'), type: 'satoshis' },
    paymentTokens: { ...n('Payment tokens', 'Asset amount on the payment UTXO.', 'coins'), type: 'token_amount' },
    memberLockingScript: { ...n('Back to you', 'Where the seat NFT and change return: the seat key\u2019s own locking script (the covenant requires the NFT to return to the spender).', 'address'), type: 'locking_script' },
    paymentSatoshis: { ...n('Payment sats', 'Sats on the payment UTXO (pays dust + fee).', 'coins'), type: 'satoshis' },
  },
  defaults: {
    address: { lockingScript: 'seatLockingScript', role: 'member', generate: ['memberKey'] },
    receive: { output: 'seatReceiveOutput', role: 'member', generate: ['memberKey'] },
  },
};

parseTemplate(JSON.stringify(template)); // throws with the schema error if invalid
writeFileSync('xo/torc-contribute.template.json', JSON.stringify(template, null, 2) + '\n');
console.log('xo/torc-contribute.template.json written and validated by @xo-cash/utils parseTemplate');

# Submission (draft, not submitted)

Nothing here has been posted. Submitting on DoraHacks, recording the video, choosing the donation address and
writing the XO feedback are Fluid's steps (see "Still to do by hand").

## Checklist

| Item | State |
|---|---|
| Covenant + 12 attack tests, contract and unit tests green | Done (`npm test`, CI) |
| Chipnet web demo circle, CLI circle (2 rounds + seat transfer), XO circle | Done (docs/DEPLOYMENTS.md, docs/XO.md) |
| Live app on Vercel: judge mode, member view, /new, /deck, banner on every page | Done: https://torc-brown.vercel.app |
| Judge spec 14/14 on production, incl. test 7 (Electrum down) | Done (docs/JUDGE-SPEC.md) |
| 10-run latency on production | docs/LATENCY.md |
| XO template + a valid XO tx on chipnet | Done (docs/XO.md) |
| Secret scan + gitleaks over full history | Clean (docs/SECURITY-SCAN.md) |
| Self-audit with threat model | Done (SELF-AUDIT.md) |
| Real-wallet test (Selene / Paytaca) | **Not done**: HANDOFF §4 |
| Mainnet seeding | **Waiting** on Fluid's approval and a funded throwaway key: HANDOFF §3 |
| Donation address in banner | **Placeholder**: HANDOFF §6 |
| Demo video | **Placeholder**: record per docs/DEMO-SCRIPT.md (HANDOFF §8) |
| XO feedback (~500 words, by hand) | **Placeholder**: docs/XO-FEEDBACK.md |
| Repo public | **Private** until Fluid says so |

## DoraHacks BUIDL draft

- **Name:** Torc (from `src/brand.ts`)
- **Tagline:** A rotating savings circle on Bitcoin Cash. Nobody holds the pot.
- **Track:** Mainnet Track
- **Bounty:** General Protocols, "Build with XO"
- **Live URL:** https://torc-brown.vercel.app (chipnet; mainnet switches on by env)
- **Repo:** https://github.com/levithefirst/torc
- **Video:** `<VIDEO URL: to be recorded>`
- **Donation / vote address:** `<ADDRESS: Fluid to supply>`

### Description (≤ 300 words)

In an ajo, the collector holds everyone's money. In Torc, nobody does.

Rotating savings circles (ajo, esusu, susu, tanda, chit fund) are how millions of people across West Africa,
the Caribbean, Latin America and South Asia save. A small group pays a fixed amount every round and one member
takes the whole pot, in turn, until everyone has had theirs. It works, but it rests on one person: the
collector, who holds the cash and can disappear with it.

Torc keeps the social contract and removes the collector. Each circle is a CashScript covenant on Bitcoin Cash.
Membership is a CashTokens NFT per seat; the circle's state (round, round start, who has paid) is a mutable NFT
held by the covenant. Members contribute a fixed dollar amount in PUSD (or BCH). When every seat has paid and
the period has passed, the covenant pays the full pot to the holder of the turn seat's NFT and to nobody else,
then advances the round. There is no admin key and nothing to administer: every parameter is fixed at creation.

It costs about a quarter of a cent per contribution and about a cent and a half for a full three-seat round.

Judges can try it in ten seconds with no wallet: the home page reads a live circle from the chain, and "Run the
next step live" broadcasts a real transaction you watch arrive as SEEN 0-conf in about 1.4 seconds. With a
wallet, /new creates your own circle over WizardConnect. The covenant has twelve attack tests, and the repo
includes chipnet runs of two full rounds and a seat transfer.

For the XO bounty, Torc ships an original XO template whose `contribute` action spends the real TorcCircle
covenant, computing the next state commitment inside the template, with a valid contribution made through the
XO engine on chipnet.

Next: bond NFTs for defaults, larger circles, reminders, more wallets.

## Covenant addresses (chipnet)

| Circle | Address |
|---|---|
| Lagos Market Circle (web demo) | `bchtest:pwn42zlapczu660my03ws0m7kfl6pl4350q4dvgvat0459n95wj6zfm4t4gzr` (token-aware `bchtest:rwn42zlapczu660my03ws0m7kfl6pl4350q4dvgvat0459n95wj6zmgf2vfmg`) |
| Lagos Market Circle (CLI run) | `bchtest:r0dqyvgvlx5kvcd7wnx2fth23j7ssx4r54hgpzeekj808pj5crjlvvtej9w87` |
| XO Circle | see docs/XO.md (`deployments/chipnet-xo.json`) |

## Showcase transactions (chipnet, all confirmed)

1. **Genesis** of the web demo circle: mints the state NFT into the covenant and one member NFT per seat.
   [`2111a3201b391b1a3e7aadb0b81b5774a8df09a31578d2aa09cbb07a545869cb`](https://chipnet.imaginary.cash/tx/2111a3201b391b1a3e7aadb0b81b5774a8df09a31578d2aa09cbb07a545869cb) (block 337111)
2. **Contribution**, shown SEEN 0-conf on the site and then confirmed:
   [`25e67db027e0a3c5e34e3bd7df56de0552c090e019247816b5308abefe48ae9a`](https://chipnet.imaginary.cash/tx/25e67db027e0a3c5e34e3bd7df56de0552c090e019247816b5308abefe48ae9a) (block 338292)
3. **Claim**: three pooled contributions paid to the turn seat's holder, round advanced:
   [`f9a927bc0ff6b68c8b0e52900e58b86a783826fe0bed65c972198a12e2703ccc`](https://chipnet.imaginary.cash/tx/f9a927bc0ff6b68c8b0e52900e58b86a783826fe0bed65c972198a12e2703ccc) (block 338292)

**XO:** contribution through the XO engine
[`140817f19a39d8e974d23e57e51d2c9e02edf37729bc18956ca1935b0cca11a8`](https://cbch.loping.net/tx/140817f19a39d8e974d23e57e51d2c9e02edf37729bc18956ca1935b0cca11a8),
valid in blaze.xo.cash's transaction inspector. Details: [docs/XO.md](XO.md).

Note: eleven later txs of the CLI circle (round 2 onwards, including its claim `32351726…`) are still
unconfirmed on chipnet at the time of writing, after being rebroadcast to both Electrum servers on 19 Nov. They
are valid in the servers' mempools; the web demo circle's newer txs confirm normally. The showcase list above
uses only confirmed txs for that reason.

## Still to do by hand (Fluid)

1. Test WizardConnect with Selene (and Paytaca) on chipnet: HANDOFF §4.
2. Approve mainnet, fund a throwaway key, rotate `DEMO_SEED`/`CRON_SECRET`, seed: HANDOFF §3.
3. Pick the donation address: HANDOFF §6.
4. Create the Widget Factory deck (or keep /deck): HANDOFF §5.
5. Record the video per docs/DEMO-SCRIPT.md: HANDOFF §8.
6. Write docs/XO-FEEDBACK.md in your own words.
7. Make the repo public, then submit the BUIDL above on DoraHacks.

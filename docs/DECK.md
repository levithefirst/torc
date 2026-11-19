# Torc deck (8 slides)

The live web deck is at https://torc-cash.vercel.app/deck (source: `src/app/deck/page.tsx`; its numbers come
from `docs/metrics.json`, `docs/LATENCY.md` and the demo circle on chain). This file is the plain-text outline.

## 1. Problem
- Rotating savings circles are a global habit: tandas in Mexico, hui in China, chit funds in India, susu in Ghana, ajo and esusu in Nigeria, where Torc started.
- They run on trust in one person: the collector holds everyone's money.
- When the collector disappears, so does the pot.

## 2. Product: Torc
- A savings circle where a Bitcoin Cash covenant holds the pot. 3–5 members, a fixed dollar amount (PUSD), a fixed round length.
- Each round the whole pot goes to the member whose turn it is, and only to them.
- Pitch: "In a savings circle, one person holds everyone's money. In Torc, nobody does. The ring pays whoever's turn it is, and only them."

## 3. Live demo (link + QR)
- https://torc-cash.vercel.app — opens on a live circle read from the chain; "Run the next step live" broadcasts a real tx.
- QR code to the URL. Screenshot of the ring + feed with a SEEN 0-conf row.

## 4. How the covenant works
- State NFT in the covenant: round, round start, paid bitmask. Member NFT per seat: whoever holds it is that seat.
- contribute(): sets your bit, locks exactly one contribution. claim(): everyone paid + period passed → whole pot to the turn seat's own address.
- No admin key, no upgrade path, parameters fixed at creation. 24 tests, 14 of them attack cases the covenant must reject.

## 5. Why Bitcoin Cash
- Native tokens (CashTokens) for seats, state and the dollar (PUSD): no bridges, no wrapped assets.
- ~$0.003 per contribution, ~$0.014 per full 3-seat round (BCH $208.25, 18 Nov 2026).
- 0-conf: payments are visible in ~2 seconds, which is what a market trader needs to trust it.

## 6. If someone doesn't pay
- Today: the payout needs every seat paid, so a missing payment pauses the round; nobody can take the pot early. Paid-in money stays locked until the missing seat pays (no deadline). A seat NFT can be handed on.
- Not solved in v1: a seat that never pays leaves that round's money stuck; a member who took the pot can stop paying.
- v2: timeout refund (each payer reclaims their own contribution after deadline + grace), a per-seat bond forfeited to the members who paid, and a payout bond holding back what a member still owes.

## 7. What runs today (chipnet)
- 4 circles; 8+ payouts made by covenants (the demo circle keeps adding more); a seat transferred and paid in by its new holder; a contribution through the XO engine.
- Real-wallet test (Paytaca extension, 19 Nov 2026): create + all 3 seats paid (txids in README "Wallets").
- Median time to a live circle on screen 1,183 ms; click to SEEN 0-conf 2,406 ms (docs/LATENCY.md).

## 8. Business model and ask
- Free core protocol. Revenue from: a small per-circle creation fee in the app; premium circles (reminders, larger circles, bond NFTs against default); white-label for cooperatives, church and market associations, and diaspora remittance circles.
- Distribution: existing circles move as a whole circle at once (3–5 users per acquisition).

## Team + ask (on the business slide)
- Fluid (builder). Built during BCH BLAZE 2026, 18–22 Nov.
- Ask: Mainnet Track + Build with XO; pilot with real circles in PUSD, starting with the ajo groups Torc came from; intros to wallet teams (Selene, Paytaca) for a native "Circles" tab.

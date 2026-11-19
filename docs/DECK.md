# Deck outline (Widget Factory template, 8 slides)

The bot copies the Widget Factory Google Slides template
(docs.google.com/presentation/d/1Yfuk9CJkf4U9M_WukcELhumWgj3Ak6345Ewy8hSp-Hk) and fills it slide by slide.
Colours: ink #100E0B background, Torc Gold #CFA354 only for the turn seat / one highlight per slide.

## 1. Problem
- Rotating savings circles (ajo, esusu, tanda, susu, chit funds) are used across West Africa, the Caribbean, Latin America and South Asia.
- They run on trust in one person: the collector holds everyone's money.
- When the collector disappears, so does the pot.

## 2. Product: Torc
- A savings circle where a Bitcoin Cash covenant holds the pot. 3–5 members, a fixed dollar amount (PUSD), a fixed round length.
- Each round the whole pot goes to the member whose turn it is, and only to them.
- Pitch: "In an ajo, the collector holds everyone's money. In Torc, nobody does. The ring pays whoever's turn it is, and only them."

## 3. Live demo (link + QR)
- https://torc-cash.vercel.app — opens on a live circle read from the chain; "Run the next step live" broadcasts a real tx.
- QR code to the URL. Screenshot of the ring + feed with a SEEN 0-conf row.

## 4. How the covenant works
- State NFT in the covenant: round, round start, paid bitmask. Member NFT per seat: whoever holds it is that seat.
- contribute(): sets your bit, locks exactly one contribution. claim(): everyone paid + period passed → whole pot to the turn seat's own address.
- No admin key, no upgrade path, parameters fixed at creation. 22 tests including 12 attack cases.

## 5. Why Bitcoin Cash
- Native tokens (CashTokens) for seats, state and the dollar (PUSD): no bridges, no wrapped assets.
- ~$0.003 per contribution, ~$0.014 per full 3-seat round (BCH $208.25, 18 Nov 2026).
- 0-conf: payments are visible in ~2 seconds, which is what a market trader needs to trust it.

## 6. Business model
- Free core protocol. Revenue from: a small per-circle creation fee in the app; premium circles (reminders, larger circles, bond NFTs against default); white-label for cooperatives, church and market associations, and diaspora remittance circles.
- Distribution: existing ajo groups move as a whole circle at once (3–5 users per acquisition).

## 7. Traction from the event (fill with live numbers)
- Chipnet: 3 circles, ≥ 2 full rounds, a seat transfer, an XO-engine contribution. Txids: genesis, contribution (SEEN → CONFIRMED), claim (see docs/DEPLOYMENTS.md and docs/SUBMISSION.md).
- Judge spec green on production at 360 px and desktop; median time-to-state and time-to-0-conf from docs/LATENCY.md.

## 8. Team + ask
- Fluid (builder). Built during BCH BLAZE 2026, 18–22 Nov.
- Ask: Mainnet Track + Build with XO; pilot with one Lagos market circle in PUSD; intros to wallet teams (Selene, Paytaca) for a native "Circles" tab.

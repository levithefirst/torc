# Torc color theme

Source of truth: OKLCH. Hex values are sRGB conversions. Every contrast number below was **computed** on Wed 18 Nov 2026 (WAT) with `coloraide` (WCAG 2.1 ratio), a hand-coded APCA-W3 0.0.98G-4g and Machado CVD simulation. Re-run: `python3 tools/torc_palette.py` (full output: `tools/palette-report.md`). Competitor hexes were read from each site's live HTML/CSS on 18 Nov 2026 (bitcoincash.org, paytaca.com, selene.cash, fundme.cash, cashonize.com, paryonusd.com).

**Brand / logo colour: Torc Gold `#CFA354`** · `oklch(0.740 0.110 80)`
Burnished, hammered gold: the colour of an Iron Age torc, not of a casino chip. It marks exactly one thing in the product: **whose turn it is** (the member the pot goes to next), plus the primary button and dark-mode focus. Foreground on it is always ink (`#100E0B` 8.28:1 dark, `#1A1711` 7.68:1 light). **Dark-first product.** The colour logo sits on ink `#100E0B` (8.28:1); on white the logo is solid ink `#1A1711`. Never white text on gold (2.33:1, fails).

Do not use Tailwind's default amber, yellow, orange, green, emerald, indigo or violet scales. No gradients, no metallic sheen, no glow, no glassmorphism, no "gold foil" textures. Gold is a flat fill.

---

## Why gold, and why *this* gold

**Category psychology (community savings / ROSCA / ajo).** Savings circles run on one emotion: *trust that the pot will come back to you*. Fintech answers that with blue ("bank, safe, regulated": Paytaca `#2563EB`, FundMe `#216BA5`, every neobank). BCH answers it with its own green `#0AC18E`, which also means "money / confirmed / up". Gold is the oldest store-of-value colour in West African and Celtic material culture alike: it says *your wealth, kept*, and in the torc story, *wealth worn as a closed ring*. That maps 1:1 to the product (the pooled pot locked in one unbreakable covenant).

**The trap, and how this hex avoids it.** Crypto already owns two golds: Binance yellow `#F0B90B` (C 0.17) and Bitcoin orange `#F7931A`. Saturated gold reads "exchange / degen / BTC". Torc Gold is **burnished**: chroma cut to 0.11 and lightness to 0.74, so it reads as worked metal and stays ΔE ≥ 10 from every gold in the space (table below). It is also the one Fluid-portfolio hue not taken (Kairos 118, Portia 222, Bulla 46, Fides 57).

**Systems copied for discipline, not colour.** Linear (achromatic chrome, ~0.04 L elevation steps, one chromatic colour), Vercel (colour only for status, mono for data: Geist Mono for txids, sats and countdowns), Stripe (one brand solid + a separate deep "text" step so small accent text passes on light), Radix role map, Apple HIG / Material 3 (status colours static across themes, never colour alone).

### Competitor, sponsor and portfolio colours deliberately avoided

ΔE2000 from Torc Gold (>10 = clearly different; >30 = different family).

| Brand | Hex | OKLCH hue | ΔE2000 | Why we steered away |
|---|---|---|---|---|
| **BCH green** (ecosystem) | `#0AC18E` | 166 | 36.1 | Every BCH app inherits it; a green Torc reads as a BCH template. We keep green only for "confirmed". |
| **Kairos citron** (Fluid) | `#C4DC48` | 118 | 23.0 | Sibling product; portfolio rule: never reuse a hue. |
| Selene sand / ink | `#F3D5A3` / `#1A1A1A` | 80 / — | 13.9 / 57.4 | Same hue family, so Torc is far more saturated and 0.12 L darker, and never used as a page wash. Kallisti (Selene's lead) is a judge: we must not look like a Selene skin. |
| Paytaca blue / navy | `#2563EB` / `#0F172A` | 263 / 266 | 59.7 / 63.7 | Wallet sponsor's identity; also generic fintech blue. |
| FundMe blue / yellow / coral | `#216BA5` / `#F1C40F` / `#FF8383` | 247 / 92 / 21 | 50.7 / 13.1 / 31.6 | Judge Sayoshi's product (pooled crowdfunding — the nearest concept). Its yellow is the closest real hex; ours is browner and calmer. |
| ParyonUSD magenta / violet | `#C336EA` / `#683FF9` | 318 / 284 | 61.6 / 64.8 | The stablecoin we hold; the pot must not look like a PUSD ad. |
| Cashonize green | `#4CAF50` | 144 | 31.6 | Material green, a wallet sponsor. |
| Binance yellow | `#F0B90B` | 87 | 10.8 | Exchange gold. Do **not** push chroma above 0.12 or hue past 86. |
| Bitcoin orange | `#F7931A` | 63 | 12.5 | BTC; do not push hue below 76. |
| Portia / Bulla / Fides (Fluid) | `#247D97` / `#AD5526` / `#77441A` | 222 / 46 / 57 | 44.8 / 27.2 / 36.6 | Portfolio separation. |

---

## Semantic tokens

Dark is the default (`<html class="dark">`); light is a full, tested alternative (`prefers-color-scheme` + toggle). Neutrals carry a 0.006–0.013 chroma whisper of hue 80, so even the greys belong to Torc.

| Role | Dark (default) | Light | Notes |
|---|---|---|---|
| Background | `#100E0B` · `oklch(0.165 0.007 78)` | `#FBF9F5` · `oklch(0.983 0.006 85)` | Never pure `#000`/`#FFF`. |
| Surface | `#191714` · `oklch(0.206 0.007 78)` | `#FFFFFF` | Cards, circle panel. |
| Surface 2 | `#22201C` · `oklch(0.244 0.008 85)` | `#F4F1EC` · `oklch(0.959 0.007 81)` | Table head, code, hover. |
| Border (3:1 non-text) | `#6D6861` — 3.49:1 bg / 3.24:1 surface | `#8A857E` — 3.48:1 / 3.66:1 | WCAG 1.4.11 for inputs. |
| Border subtle | `#302D29` | `#E1DDD7` | Decorative dividers only. |
| Text primary | `#F6F3EF` — **17.42:1** (APCA −99.9) | `#1A1711` — **17.00:1** (101.1) | |
| Text secondary | `#AEAAA3` — **8.33:1** | `#5F5A53` — **6.50:1** | |
| **Brand accent (logo, fill)** | **`#CFA354`** — 8.28:1 on bg | **`#CFA354`** — 2.21:1 on bg | Light mode: fill only, with a 1px `--text` border on buttons. |
| Accent hover | `#E1B767` · `oklch(0.800 0.110 82)` | `#C59542` · `oklch(0.700 0.115 79)` | Hover moves away from the ink label. |
| On-accent | `#100E0B` — **8.28:1** (10.25:1 hover) | `#1A1711` — **7.68:1** (6.60:1 hover) | AAA-ish for button labels. |
| Accent text (links, small gold copy) | `#CFA354` — **8.28:1** | `#7A510B` · `oklch(0.469 0.095 74)` — **6.64:1** | Light mode must use the deep step. |
| Focus ring | `#CFA354` | `#1A1711` | 2px solid + 2px offset. |

### Status (tx state only, never chrome)

| Status | Dark | Light | vs bg (dark / light) |
|---|---|---|---|
| Success (confirmed in a block) | `#76CF8A` · `oklch(0.781 0.131 150)` | `#287C42` · `oklch(0.521 0.121 150)` | 10.15 / 4.93 |
| Warning (contribution due < 2 h, reserve low) | `#F2985F` · `oklch(0.760 0.130 52)` | `#B35713` · `oklch(0.560 0.140 50)` | 8.66 / 4.66 |
| Danger (tx rejected, wrong network, Electrum down) | `#F97770` · `oklch(0.720 0.161 25)` | `#C2272D` · `oklch(0.531 0.190 25)` | 7.25 / 5.51 |

Warning is pushed to hue 50 (ember), ΔE 15 from the brand, so "due soon" never reads as "your turn".

### Data colours (the circle ring, the member rows, the tx feed)

Always paired with **label + shape**, never colour alone.

| State | Dark | Light | Shape | vs bg |
|---|---|---|---|---|
| **Turn** (member who receives this round) | `#CFA354` | `#7A510B` | filled segment on the ring + "YOUR TURN" / "PAYS ADE NEXT" | 8.28 / 6.64 |
| **Confirmed** contribution | `#76CF8A` | `#287C42` | solid dot + "CONFIRMED · block N" | 10.15 / 4.93 |
| **Mempool** (0-conf, seen) | `#7FBEF3` · `oklch(0.779 0.100 245)` | `#196EA9` · `oklch(0.520 0.120 245)` | **dashed** ring + "SEEN · 0-conf · 3 s ago" | 9.69 / 5.19 |
| **Due** (not yet paid) | `#AEAAA3` | `#5F5A53` | hollow dot + "DUE in 6 h" | 8.33 / 6.50 |

CVD check (min ΔE2000, dark): turn/confirmed ≥ 9.7 under protan/deutan; confirmed/mempool collapses to 2.7 under tritanopia, which is exactly why mempool is **dashed** and labelled while confirmed is solid. Shape carries that distinction; colour is a bonus.

---

## CSS variables (paste into `app/globals.css`)

```css
:root {
  --bg:#FBF9F5; --surface:#FFFFFF; --surface-2:#F4F1EC;
  --border:#8A857E; --border-subtle:#E1DDD7;
  --text:#1A1711; --text-2:#5F5A53;
  --accent:#CFA354; --accent-hover:#C59542; --on-accent:#1A1711;
  --accent-text:#7A510B; --focus:#1A1711;
  --success:#287C42; --warning:#B35713; --danger:#C2272D;
  --turn:#7A510B; --confirmed:#287C42; --mempool:#196EA9; --due:#5F5A53;
  --radius:10px; --font-sans:"Geist","Inter",system-ui,sans-serif; --font-mono:"Geist Mono",ui-monospace,monospace;
}
.dark {
  --bg:#100E0B; --surface:#191714; --surface-2:#22201C;
  --border:#6D6861; --border-subtle:#302D29;
  --text:#F6F3EF; --text-2:#AEAAA3;
  --accent:#CFA354; --accent-hover:#E1B767; --on-accent:#100E0B;
  --accent-text:#CFA354; --focus:#CFA354;
  --success:#76CF8A; --warning:#F2985F; --danger:#F97770;
  --turn:#CFA354; --confirmed:#76CF8A; --mempool:#7FBEF3; --due:#AEAAA3;
}
```

OKLCH-native variant (modern browsers; keep the hex block as fallback): `--accent: oklch(0.740 0.110 80);` `--bg` dark `oklch(0.165 0.007 78)`, and so on from the table.

## Tailwind v4 (`@theme` in globals.css)

```css
@import "tailwindcss";
@custom-variant dark (&:where(.dark, .dark *));
@theme inline {
  --color-bg: var(--bg); --color-surface: var(--surface); --color-surface-2: var(--surface-2);
  --color-border: var(--border); --color-border-subtle: var(--border-subtle);
  --color-text: var(--text); --color-text-2: var(--text-2);
  --color-accent: var(--accent); --color-accent-hover: var(--accent-hover); --color-on-accent: var(--on-accent);
  --color-accent-text: var(--accent-text); --color-focus: var(--focus);
  --color-success: var(--success); --color-warning: var(--warning); --color-danger: var(--danger);
  --color-turn: var(--turn); --color-confirmed: var(--confirmed); --color-mempool: var(--mempool); --color-due: var(--due);
  --font-sans: var(--font-sans); --font-mono: var(--font-mono);
}
```

(Tailwind v3 fallback: map the same names under `theme.extend.colors` to `var(--…)`.)

## Usage rules

1. Gold appears in at most **three places per screen**: the turn segment on the ring, the primary button, the focus ring. Never on headings, never as a background wash.
2. Amounts, txids, sats, countdowns: `font-mono`, `tabular-nums`, `--text`. Txids truncated `a1b2…9f0e` and linked to the explorer.
3. 0-conf is a first-class state, not a spinner: dashed `--mempool` + "SEEN 0-conf" the instant Electrum reports it; flips to solid `--confirmed` on the block.
4. Light mode gold text is always `--accent-text` (`#7A510B`), never `#CFA354`.
5. `prefers-reduced-motion`: the ring's turn-advance animation becomes an instant state change.

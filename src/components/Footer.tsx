import Link from 'next/link';
import { BRAND_NAME, TAGLINE } from '@/brand';
import { DECK_URL, REPO_URL, NETWORK } from '@/lib/chain/config';
import { Mark } from './Mark';

/** Last fold: a quiet utility row and the wordmark as a closer. */
export function Footer() {
  return (
    <footer className="mt-10 border-t rule" data-testid="footer">
      <div className="mx-auto grid max-w-6xl gap-6 px-5 pt-8 sm:grid-cols-[1fr_auto] sm:px-6">
        <p className="max-w-md text-sm text-text-2">{TAGLINE}</p>
        <nav className="flex flex-wrap gap-x-6 gap-y-2 text-sm" aria-label="Footer">
          <Link href="/circle/demo" className="text-text-2 hover:text-text">Live circle</Link>
          <Link href="/new" className="text-text-2 hover:text-text">Start a circle</Link>
          <a href={DECK_URL} className="text-text-2 hover:text-text">Deck</a>
          <a href={REPO_URL} className="text-text-2 hover:text-text">GitHub</a>
        </nav>
      </div>
      <div className="mx-auto flex max-w-6xl items-end justify-between gap-4 overflow-hidden px-5 pb-6 pt-6 sm:px-6" aria-hidden>
        <span className="select-none font-semibold leading-[0.78] tracking-[-0.07em] text-text/[0.07] text-[clamp(96px,30vw,360px)]">{BRAND_NAME.toLowerCase()}</span>
        <Mark className="mb-3 size-[clamp(48px,10vw,120px)] shrink-0 text-accent" />
      </div>
      <p className="mx-auto max-w-6xl px-5 pb-8 text-[12px] text-text-2 sm:px-6">
        Built for BCH BLAZE 2026 · runs on BCH {NETWORK} · no admin key
      </p>
    </footer>
  );
}

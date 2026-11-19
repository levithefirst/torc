import Link from 'next/link';
import { BRAND_NAME } from '@/brand';
import { NETWORK } from '@/lib/chain/config';
import { ThemeToggle } from './ThemeToggle';
import { Mark } from './Mark';

export function Header() {
  return (
    <header className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-5 py-3 sm:px-6 sm:py-5">
      <Link href="/" className="group flex items-center gap-2.5" aria-label={`${BRAND_NAME} home`}>
        <Mark className="size-7 text-accent transition-transform duration-500 ease-[cubic-bezier(.22,1,.36,1)] group-hover:rotate-[72deg]" />
        <span className="text-[19px] font-semibold tracking-[-0.04em]">{BRAND_NAME.toLowerCase()}</span>
        <span className="eyebrow ml-1 hidden items-center gap-1.5 rounded-full border rule px-2 py-0.5 !text-[10px] min-[380px]:inline-flex">
          <span aria-hidden className="size-1.5 rounded-full bg-confirmed" />
          {NETWORK}
        </span>
      </Link>
      <nav className="flex items-center gap-1 text-sm sm:gap-2" aria-label="Main">
        <Link href="/circle/demo" className="hidden rounded-full px-3 py-1.5 text-text-2 hover:text-text md:inline-block">Live circle</Link>
        <Link href="/deck" className="hidden rounded-full px-3 py-1.5 text-text-2 hover:text-text md:inline-block">Deck</Link>
        <Link href="/new" className="btn btn-ghost px-3.5 py-1.5 text-[13px]">Start a circle</Link>
        <ThemeToggle />
      </nav>
    </header>
  );
}

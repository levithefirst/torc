import Link from 'next/link';
import { BRAND_NAME } from '@/brand';
import { NETWORK } from '@/lib/chain/config';
import { ThemeToggle } from './ThemeToggle';

export function Header() {
  return (
    <header className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-4">
      <Link href="/" className="flex items-center gap-2" aria-label={`${BRAND_NAME} home`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/torc-mark-gold.svg" alt="" width={28} height={28} className="rounded-md" />
        <span className="text-lg font-bold tracking-tight">{BRAND_NAME.toLowerCase()}</span>
        <span className="rounded border border-border-subtle px-1.5 py-0.5 text-[11px] uppercase tracking-wide text-text-2">{NETWORK}</span>
      </Link>
      <nav className="flex items-center gap-3 text-sm text-text-2">
        <Link href="/new" className="hover:text-text">Start a circle</Link>
        <ThemeToggle />
      </nav>
    </header>
  );
}

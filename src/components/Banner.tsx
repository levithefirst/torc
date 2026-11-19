'use client';
import { useState } from 'react';
import QRCode from 'qrcode';
import { DECK_URL, REPO_URL, DONATION_ADDRESS } from '@/lib/chain/config';

const short = (a: string) => (a.length > 24 ? `${a.slice(0, a.indexOf(':') + 7)}…${a.slice(-5)}` : a);

/** BLAZE-required banner: deck, repo, and the CashTokens donation / vote address. Every page. */
export function Banner() {
  const [copied, setCopied] = useState(false);
  const [qr, setQr] = useState<string | null>(null);
  const addr = DONATION_ADDRESS;
  async function copy() {
    try {
      await navigator.clipboard.writeText(addr);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  }
  async function toggleQr() {
    if (qr) return setQr(null);
    setQr(await QRCode.toDataURL(addr, { margin: 1, width: 220, color: { dark: '#100E0B', light: '#FBF9F5' } }));
  }
  return (
    <div data-testid="banner" className="border-b rule bg-surface text-[12px]">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-5 gap-y-1 px-5 py-1.5 sm:px-6">
        <a data-testid="banner-deck" href={DECK_URL} className="font-medium text-text hover:text-accent-text">Deck</a>
        <a data-testid="banner-repo" href={REPO_URL} className="font-medium text-text hover:text-accent-text">GitHub</a>
        <span data-testid="banner-donate" className="flex min-w-0 items-center gap-1.5 text-text-2">
          <span className="eyebrow shrink-0 !text-[10px]">Donate / vote</span>
          {addr ? (
            <>
              <code className="num truncate text-text" title={addr}>{short(addr)}</code>
              <button onClick={copy} className="shrink-0 rounded-full border border-border px-2 text-[11px] text-text hover:border-text" aria-label="Copy donation address">
                {copied ? 'Copied' : 'Copy'}
              </button>
              <button onClick={toggleQr} className="shrink-0 rounded-full border border-border px-2 text-[11px] text-text hover:border-text" aria-label="Show donation QR code">QR</button>
            </>
          ) : (
            <span className="text-text-2">address coming soon</span>
          )}
        </span>
      </div>
      {qr && (
        <div className="mx-auto max-w-6xl px-5 pb-3 sm:px-6">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qr} alt="Donation address QR code" width={180} height={180} className="rounded" />
          <p className="num mt-1 break-all text-[12px] text-text-2">{addr}</p>
        </div>
      )}
    </div>
  );
}

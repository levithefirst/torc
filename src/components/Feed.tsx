'use client';
import type { FeedRow } from '@/lib/torc/snapshot';
import { explorerTx } from '@/lib/chain/config';
import { fmtUnits, seatName, shortTx, type AssetInfo } from '@/lib/app/demo';

export function TxStatus({ height }: { height: number }) {
  if (height > 0)
    return (
      <span data-testid="status-confirmed" className="inline-flex items-center gap-1 whitespace-nowrap rounded border border-confirmed px-1.5 py-0.5 text-[11px] font-medium text-confirmed">
        <span aria-hidden className="size-1.5 rounded-full bg-confirmed" /> CONFIRMED · block <span className="num">{height.toLocaleString('en-US')}</span>
      </span>
    );
  return (
    <span data-testid="status-seen" className="inline-flex items-center gap-1 whitespace-nowrap rounded border border-dashed border-mempool px-1.5 py-0.5 text-[11px] font-medium text-mempool">
      <span aria-hidden className="size-1.5 rounded-full border border-dashed border-mempool" /> SEEN · 0-conf
    </span>
  );
}

const verb: Record<string, string> = { genesis: 'started the circle', contribute: 'paid in', claim: 'took the pot' };

export function Feed({ rows, names, asset, highlight }: { rows: FeedRow[]; names: string[]; asset: AssetInfo; highlight?: string }) {
  if (!rows.length) return <p className="text-sm text-text-2">No activity yet.</p>;
  return (
    <ol className="divide-y divide-border-subtle" data-testid="feed">
      {rows.map((r) => (
        <li
          key={r.txid}
          data-testid="feed-row"
          data-txid={r.txid}
          data-kind={r.kind}
          data-height={r.height}
          className={`flex flex-wrap items-center justify-between gap-x-3 gap-y-1 py-2.5 ${highlight === r.txid ? 'animate-pulse' : ''}`}
        >
          <div className="min-w-0">
            <div className="text-sm">
              {r.kind === 'genesis' ? (
                <span className="font-medium">Circle created</span>
              ) : (
                <>
                  <span className="font-medium">{seatName(names, r.seat)}</span> <span className="text-text-2">{verb[r.kind]}</span>{' '}
                  {r.amount && <span className="num">{fmtUnits(r.amount, asset)}</span>}
                </>
              )}
              {r.round !== undefined && r.kind !== 'genesis' && <span className="text-text-2"> · round {r.round + 1}</span>}
            </div>
            <a href={explorerTx(r.txid)} target="_blank" rel="noopener noreferrer" className="num text-[12px] text-accent-text underline-offset-2 hover:underline" data-testid="txid-link">
              {shortTx(r.txid)}
            </a>
          </div>
          <TxStatus height={r.height} />
        </li>
      ))}
    </ol>
  );
}

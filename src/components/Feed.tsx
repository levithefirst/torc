'use client';
import type { FeedRow } from '@/lib/torc/snapshot';
import { explorerAddress } from '@/lib/chain/config';
import { fmtUnits, seatName, type AssetInfo } from '@/lib/app/demo';
import { TxLink } from './TxLink';

export function TxStatus({ height }: { height: number }) {
  if (height > 0)
    return (
      <span data-testid="status-confirmed" className="inline-flex items-center gap-1 num whitespace-nowrap rounded-full border border-confirmed/50 px-2 py-0.5 text-[10.5px] font-medium text-confirmed">
        <span aria-hidden className="size-1.5 rounded-full bg-confirmed" /> CONFIRMED · block <span className="num">{height.toLocaleString('en-US')}</span>
      </span>
    );
  return (
    <span data-testid="status-seen" className="inline-flex items-center gap-1 num whitespace-nowrap rounded-full border border-dashed border-mempool px-2 py-0.5 text-[10.5px] font-medium text-mempool">
      <span aria-hidden className="size-1.5 rounded-full border border-dashed border-mempool" /> SEEN · 0-conf
    </span>
  );
}

const verb: Record<string, string> = { genesis: 'started the circle', contribute: 'paid in', claim: 'took the pot' };

export function Feed({ rows, names, asset, highlight, total, address }: { rows: FeedRow[]; names: string[]; asset: AssetInfo; highlight?: string; total?: number; address?: string }) {
  if (!rows.length) return <p className="text-sm text-text-2">No activity yet.</p>;
  return (
    <>
    <ol className="divide-y divide-line border-y rule" data-testid="feed">
      {rows.map((r) => (
        <li
          key={r.txid}
          data-testid="feed-row"
          data-txid={r.txid}
          data-kind={r.kind}
          data-height={r.height}
          className={`flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5 py-3.5 ${highlight === r.txid ? 'land bg-surface' : ''}`}
        >
          <div className="min-w-0">
            <div className="text-[14px]">
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
            <TxLink txid={r.txid} testId="txid-link" className="num link text-[12px]" />
          </div>
          <TxStatus height={r.height} />
        </li>
      ))}
    </ol>
    {total !== undefined && (
      <p className="mt-3 text-[12px] text-text-2" data-testid="feed-count">
        Showing the latest {rows.length} of {total} circle transactions
        {address && total > rows.length && (
          <>
            {' '}· <a className="link" href={explorerAddress(address)} target="_blank" rel="noopener noreferrer">full history on the explorer</a>
          </>
        )}
      </p>
    )}
    </>
  );
}

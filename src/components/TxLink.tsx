import { explorerTx, explorerTxAlt, explorerAltName } from '@/lib/chain/config';
import { shortTx } from '@/lib/app/demo';

/** A txid link to the network's explorer, plus a small fallback link to a second explorer. */
export function TxLink({ txid, label, className = 'num text-accent-text underline', testId }: { txid: string; label?: string; className?: string; testId?: string }) {
  return (
    <span className="inline-flex items-baseline gap-1">
      <a className={className} href={explorerTx(txid)} target="_blank" rel="noopener noreferrer" data-testid={testId}>{label ?? shortTx(txid)}</a>
      <a className="text-[10px] text-text-2 underline-offset-2 hover:underline" href={explorerTxAlt(txid)} target="_blank" rel="noopener noreferrer" title={`Open on ${explorerAltName()} (if the first explorer is down)`} data-testid="txid-alt">alt</a>
    </span>
  );
}

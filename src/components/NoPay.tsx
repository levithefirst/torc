import { REPO_URL } from '@/lib/chain/config';

/** The first question every ajo member asks, answered honestly: what Torc does today, and v2. */
export function NoPay({ compact = false }: { compact?: boolean }) {
  return (
    <section id="if-someone-doesnt-pay" className={compact ? '' : 'mt-10 rounded-[var(--radius)] border border-border-subtle p-4 sm:p-5'} data-testid="no-pay">
      <h2 className="text-lg font-semibold">If someone doesn’t pay</h2>
      <div className="mt-3 grid gap-4 text-sm md:grid-cols-2">
        <div>
          <h3 className="font-semibold">What happens today</h3>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-text-2">
            <li>The payout needs every seat paid (<a className="text-accent-text underline-offset-2 hover:underline" href={`${REPO_URL}/blob/main/contracts/TorcCircle.cash#L88-L90`}>claim() checks it</a>), so one missing payment pauses the round. Nobody, including the organiser, can take the pot early or run off with it.</li>
            <li>The money already paid in stays locked in the covenant until the missing seat pays. There is no deadline, so a late payment still unlocks the round.</li>
            <li>A seat is an NFT, so a member who wants out can hand or sell their seat to someone who will keep paying.</li>
            <li>There is no refund or timeout yet. If a seat never pays, the paid-in money for that round stays stuck. A member who has already taken the pot and then stops paying is not stopped by v1 either. We say this up front because it is the main risk.</li>
          </ul>
        </div>
        <div>
          <h3 className="font-semibold">The v2 design</h3>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-text-2">
            <li><b className="text-text">Timeout refund.</b> If a round is not full by its deadline plus a grace period, each member who paid can take their own contribution back with their seat NFT, and the round reopens.</li>
            <li><b className="text-text">Bond.</b> Each seat locks a bond when it joins. A seat that misses a round loses its bond to the members who paid.</li>
            <li><b className="text-text">Bigger bond after your payout.</b> When you take the pot, the covenant keeps back the contributions you still owe as a bond, and releases it round by round as you pay. Taking the pot and leaving no longer pays.</li>
            <li>None of this needs an admin key. It is all covenant rules, like v1.</li>
          </ul>
        </div>
      </div>
    </section>
  );
}

import { CircleView } from '@/components/CircleView';
import { DEMO } from '@/lib/app/demo';

export const metadata = { title: 'Circle' };

export default async function CirclePage({ params }: { params: Promise<{ address: string }> }) {
  const { address } = await params;
  const addr = decodeURIComponent(address);
  const demo = DEMO && (addr === DEMO.tokenAddress || addr === 'demo') ? { paramsJson: DEMO.paramsJson, names: DEMO.seatNames, name: DEMO.name } : undefined;
  return <CircleView address={demo ? DEMO!.tokenAddress : addr} demo={demo} />;
}

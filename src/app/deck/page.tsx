import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { renderMarkdown } from '@/lib/app/markdown';
import { BRAND_NAME } from '@/brand';

export const metadata = { title: 'Deck' };
export const dynamic = 'force-static';

// Placeholder deck: renders docs/DECK.md until NEXT_PUBLIC_DECK_URL points at the Widget Factory slides.
export default function Deck() {
  const html = renderMarkdown(readFileSync(join(process.cwd(), 'docs/DECK.md'), 'utf8'));
  return (
    <article className="deck py-6" data-testid="deck">
      <p className="mb-4 rounded border border-border-subtle bg-surface p-3 text-sm text-text-2">
        {BRAND_NAME} deck outline. The designed slides (Widget Factory template) replace this page once they are published.
      </p>
      <div dangerouslySetInnerHTML={{ __html: html }} />
    </article>
  );
}

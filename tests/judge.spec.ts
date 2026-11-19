// Judge spec: what a BLAZE judge sees on a phone and a laptop, with no wallet and no setup.
// BASE_URL=https://… npx playwright test   (timings appended to test-results/judge-timings.jsonl)
import { test, expect, type Page } from '@playwright/test';
import { appendFileSync, mkdirSync } from 'node:fs';

// In sandboxes whose egress blocks Electrum WSS ports, the browser falls back to the server
// relay and logs a WebSocket error. Set WS_BLOCKED=1 there to ignore only that message.
const IGNORE = process.env.WS_BLOCKED ? [/WebSocket connection to 'wss:\/\/.*failed/] : [];

function record(entry: Record<string, unknown>) {
  mkdirSync('test-results', { recursive: true });
  appendFileSync('test-results/judge-timings.jsonl', JSON.stringify({ at: new Date().toISOString(), ...entry }) + '\n');
}

function watchConsole(page: Page) {
  const errors: string[] = [];
  page.on('console', (m) => { if (m.type() === 'error' && !IGNORE.some((r) => r.test(m.text()))) errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(String(e)));
  return errors;
}

test('1. banner: deck, repo and donation address, no horizontal scroll', async ({ page }) => {
  await page.goto('/');
  const banner = page.getByTestId('banner');
  await expect(banner).toBeVisible();
  await expect(page.getByTestId('banner-deck')).toHaveAttribute('href', /.+/);
  await expect(page.getByTestId('banner-repo')).toHaveAttribute('href', /github\.com/);
  await expect(page.getByTestId('banner-donate')).toBeVisible();
  for (const path of ['/new', '/circle/demo', '/deck']) {
    await page.goto(path);
    await expect(page.getByTestId('banner')).toBeVisible();
  }
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});

test('2. live circle from the chain within 10 s, no wallet, no click', async ({ page, request }, info) => {
  const t0 = Date.now();
  await page.goto('/');
  await expect(page.getByTestId('ring')).toBeVisible({ timeout: 10_000 });
  await expect(page.getByTestId('turn-label')).toContainText(/pays \w+/, { timeout: 10_000 });
  await expect(page.getByTestId('pot-amount')).toBeVisible({ timeout: 10_000 });
  const link = page.getByTestId('txid-link').first();
  await expect(link).toBeVisible({ timeout: 10_000 });
  const ms = Date.now() - t0;
  expect(ms).toBeLessThan(10_000);
  await expect(link).toHaveAttribute('href', /\/tx\/[0-9a-f]{64}/);
  const api = await (await request.get('/api/circle')).json();
  await expect(page.getByTestId('ring')).toHaveAttribute('data-seats', String(api.params.seats));
  record({ test: 'time-to-state', project: info.project.name, ms });
});

test('3. "Run the next step live" shows a new SEEN 0-conf tx within 10 s of the click', async ({ page }, info) => {
  await page.goto('/');
  await expect(page.getByTestId('feed-row').first()).toBeVisible({ timeout: 10_000 });
  const before = new Set(await page.getByTestId('feed-row').evaluateAll((els) => els.map((e) => e.getAttribute('data-txid'))));
  const button = page.getByTestId('run-next');
  await expect(button).toBeEnabled();
  const t0 = Date.now(); // clock starts at the actual click
  await button.click();
  const fresh = page.locator('[data-testid=feed-row]', { has: page.getByTestId('status-seen') }).filter({
    hasNot: page.locator(`[data-txid="__none__"]`),
  });
  const outcome = await Promise.race([
    (async () => {
      for (;;) {
        const rows = await fresh.evaluateAll((els) => els.map((e) => e.getAttribute('data-txid')));
        const n = rows.find((t) => t && !before.has(t));
        if (n) return { kind: 'seen' as const, txid: n };
        await page.waitForTimeout(100);
      }
    })(),
    page.getByTestId('run-wait').waitFor({ timeout: 10_000 }).then(async () => ({ kind: 'wait' as const, text: await page.getByTestId('run-wait').innerText() })),
    page.waitForTimeout(10_000).then(() => ({ kind: 'timeout' as const })),
  ]);
  const ms = Date.now() - t0;
  record({ test: 'time-to-0conf', project: info.project.name, ms, ...outcome });
  expect(outcome.kind).not.toBe('timeout');
  if (outcome.kind === 'seen') expect(ms).toBeLessThan(10_000);
  else expect((outcome as { text: string }).text).toMatch(/available in \d+ s|opens|paid/i);
});

test('4. every txid on the page resolves on chain', async ({ page, request }) => {
  await page.goto('/');
  await expect(page.getByTestId('feed-row').first()).toBeVisible({ timeout: 10_000 });
  const txids = await page.getByTestId('feed-row').evaluateAll((els) => els.map((e) => e.getAttribute('data-txid')!));
  expect(txids.length).toBeGreaterThan(0);
  for (const txid of txids) {
    const r = await request.post('/api/chain', { data: { method: 'blockchain.transaction.get', params: [txid] } });
    const j = await r.json();
    expect(typeof j.result, `tx ${txid}`).toBe('string');
    expect(j.result.length).toBeGreaterThan(100);
  }
});

test('5. no console errors, no overflow at 360 px, LCP < 2.5 s on desktop', async ({ page }, info) => {
  const errors = watchConsole(page);
  await page.goto('/');
  await expect(page.getByTestId('feed-row').first()).toBeVisible({ timeout: 10_000 });
  await page.waitForTimeout(1500);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  if (info.project.name === 'desktop') {
    const lcp = await page.evaluate(
      () => new Promise<number>((resolve) => {
        new PerformanceObserver((l) => { const e = l.getEntries(); resolve(e[e.length - 1]!.startTime); }).observe({ type: 'largest-contentful-paint', buffered: true });
        setTimeout(() => resolve(-1), 3000);
      }),
    );
    record({ test: 'lcp', project: info.project.name, ms: Math.round(lcp) });
    expect(lcp).toBeGreaterThan(0);
    expect(lcp).toBeLessThan(2500);
  }
  expect(errors).toEqual([]);
});

test('6. /new builds an unsigned 3-seat genesis without a wallet (dry run)', async ({ page }) => {
  const errors = watchConsole(page);
  await page.goto('/new');
  await expect(page.getByTestId('judge-path')).toBeVisible();
  await page.getByTestId('btn-dry-run').click();
  const r = page.getByTestId('dry-run-result');
  await expect(r).toBeVisible({ timeout: 5000 });
  await expect(r).toContainText('3 member NFTs');
  await expect(r).toContainText(/covenant (bchtest|bitcoincash):r/);
  expect(errors).toEqual([]);
});

test('7. Electrum down: the page still renders the last known state, labelled', async ({ page }) => {
  // Block every chain path the browser has: Electrum WSS and the server snapshot API.
  await page.routeWebSocket(/.*/, (ws) => ws.close());
  await page.route('**/api/circle**', (r) => r.fulfill({ status: 503, body: '{"error":"chain unavailable"}' }));
  await page.goto('/');
  await expect(page.getByTestId('ring')).toBeVisible({ timeout: 10_000 }); // server-rendered state
  await expect(page.getByTestId('feed-row').first()).toBeVisible();
  await expect(page.getByTestId('live-status')).toContainText(/as of .* · (reconnecting|connecting live feed)/, { timeout: 15_000 });
});

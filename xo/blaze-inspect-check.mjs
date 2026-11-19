// Opens blaze.xo.cash with a fresh throwaway chipnet account (generated in the page, never saved) and inspects a txid.
// Its chipnet Electrum sockets are bridged to xo/electrum-relay-shim.mjs, for hosts whose egress blocks Electrum WSS.
//   node xo/electrum-relay-shim.mjs &  node xo/blaze-inspect-check.mjs <txid>   -> /tmp/blaze-inspect.png
import { chromium } from '@playwright/test';
import WebSocket from 'ws';
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1280, height: 1600 } });
// This box's egress blocks Electrum WSS, so the page's chipnet Electrum sockets are bridged to the local relay shim.
await ctx.routeWebSocket(/:5000[34]/, (route) => {
  const up = new WebSocket('ws://127.0.0.1:50993');
  const queue = [];
  up.on('open', () => { for (const m of queue.splice(0)) up.send(m); });
  up.on('message', (m) => route.send(String(m)));
  route.onMessage((m) => (up.readyState === 1 ? up.send(m) : queue.push(m)));
  route.onClose(() => up.close());
});
const p = await ctx.newPage();
p.on('console', (m) => { if (/error/i.test(m.type())) console.log('console', m.text().slice(0, 200)); });
await p.goto('https://blaze.xo.cash/', { waitUntil: 'networkidle' });
await p.getByText('Create new account').click();
await p.waitForTimeout(1500);
await p.locator('input').first().fill('torc-check');
await p.locator('select').first().selectOption('chipnet');
await p.getByText('Save and use account').click();
await p.waitForTimeout(20000);
const nav = p.getByText('Inspect', { exact: true }).first();
if (await nav.count()) await nav.click(); else await p.goto('https://blaze.xo.cash/inspect-transaction');
await p.waitForTimeout(3000);
await p.locator('textarea').first().fill(process.argv[2]);
await p.waitForTimeout(25000);
await p.screenshot({ path: '/tmp/blaze-inspect.png', fullPage: true });
console.log('--- inspect\n' + (await p.locator('body').innerText()).slice(0, 2500));
await b.close();

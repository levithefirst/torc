// Local Electrum WebSocket endpoint backed by Torc's HTTPS relay (/api/chain).
// For hosts whose egress only allows HTTPS (no raw Electrum WSS on :50004): the XO engine connects to
// ws://127.0.0.1:PORT and this shim forwards requests to the relay, emulating subscriptions by polling.
//   TORC_RELAY_URL=https://torc-brown.vercel.app node xo/electrum-relay-shim.mjs [port]
import { WebSocketServer } from 'ws';
import { createHash } from 'node:crypto';

const RELAY = (process.env.TORC_RELAY_URL ?? 'https://torc-brown.vercel.app').replace(/\/$/, '') + '/api/chain';
const PORT = Number(process.argv[2] ?? process.env.SHIM_PORT ?? 50993);
const POLL_MS = Number(process.env.SHIM_POLL_MS ?? 4000);
const VERBOSE = !!process.env.SHIM_VERBOSE;

async function relay(method, params = []) {
  for (let attempt = 0; ; attempt++) {
    const r = await fetch(RELAY, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ method, params }) });
    const j = await r.json().catch(() => ({ error: `relay HTTP ${r.status}` }));
    if (r.ok && !j.error) return j.result;
    if (attempt < 2 && /timed out|reachable|502|socket/i.test(String(j.error))) { await new Promise((s) => setTimeout(s, 800)); continue; }
    throw new Error(j.error ?? `relay HTTP ${r.status}`);
  }
}
const statusOf = (hist) => (hist.length ? createHash('sha256').update(hist.map((h) => `${h.tx_hash}:${h.height}:`).join('')).digest('hex') : null);
async function scripthashStatus(sh) {
  const [conf, mem] = await Promise.all([relay('blockchain.scripthash.get_history', [sh]), relay('blockchain.scripthash.get_mempool', [sh])]);
  const seen = new Set(conf.map((h) => h.tx_hash));
  return statusOf([...conf, ...mem.filter((h) => !seen.has(h.tx_hash))]);
}
async function txHeight(txid) {
  try {
    const t = await relay('blockchain.transaction.get', [txid, true]);
    if (!t.confirmations) return 0;
    const tip = await relay('blockchain.headers.get_tip');
    return tip.height - t.confirmations + 1;
  } catch { return null; }
}

const wss = new WebSocketServer({ host: '127.0.0.1', port: PORT });
wss.on('connection', (ws) => {
  const subs = { headers: null, sh: new Map(), tx: new Map() };
  const notify = (method, params) => ws.readyState === 1 && ws.send(JSON.stringify({ jsonrpc: '2.0', method, params }));
  const timer = setInterval(async () => {
    try {
      if (subs.headers) {
        const tip = await relay('blockchain.headers.get_tip');
        if (tip.height !== subs.headers.height) { subs.headers = tip; notify('blockchain.headers.subscribe', [tip]); }
      }
      for (const [sh, st] of subs.sh) { const n = await scripthashStatus(sh); if (n !== st) { subs.sh.set(sh, n); notify('blockchain.scripthash.subscribe', [sh, n]); } }
      for (const [txid, h] of subs.tx) { const n = await txHeight(txid); if (n !== h) { subs.tx.set(txid, n); notify('blockchain.transaction.subscribe', [txid, n]); } }
    } catch (e) { if (VERBOSE) console.error('poll', e.message); }
  }, POLL_MS);
  ws.on('close', () => clearInterval(timer));
  const handle = async ({ id, method, params = [] }) => {
    switch (method) {
      case 'server.version': return ['Torc relay shim 1.0', String(params[1] ?? '1.5')];
      case 'server.ping': return null;
      case 'server.banner': return 'Torc relay shim';
      case 'blockchain.headers.subscribe': subs.headers = await relay('blockchain.headers.get_tip'); return subs.headers;
      case 'blockchain.headers.unsubscribe': subs.headers = null; return true;
      case 'blockchain.scripthash.subscribe': { const st = await scripthashStatus(params[0]); subs.sh.set(params[0], st); return st; }
      case 'blockchain.scripthash.unsubscribe': return subs.sh.delete(params[0]);
      case 'blockchain.transaction.subscribe': { const h = await txHeight(params[0]); subs.tx.set(params[0], h); return h; }
      case 'blockchain.transaction.unsubscribe': return subs.tx.delete(params[0]);
      case 'blockchain.transaction.dsproof.subscribe': return null;
      case 'blockchain.transaction.dsproof.get': return null;
      case 'blockchain.scripthash.list_unspent': return relay('blockchain.scripthash.listunspent', params);
      default: return relay(method, params);
    }
  };
  ws.on('message', async (raw) => {
    const msg = JSON.parse(String(raw));
    const one = async (m) => {
      try { const result = await handle(m); if (VERBOSE) console.log('ok ', m.method, JSON.stringify(m.params).slice(0, 120)); return { jsonrpc: '2.0', id: m.id, result }; }
      catch (e) { console.log('ERR', m.method, JSON.stringify(m.params).slice(0, 120), e.message); return { jsonrpc: '2.0', id: m.id, error: { code: 1, message: e.message } }; }
    };
    const out = Array.isArray(msg) ? await Promise.all(msg.map(one)) : await one(msg);
    if (ws.readyState === 1) ws.send(JSON.stringify(out));
  });
});
console.log(`electrum relay shim on ws://127.0.0.1:${PORT} -> ${RELAY}`);

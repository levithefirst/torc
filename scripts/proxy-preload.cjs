// Dev-only: when HTTPS_PROXY is set (sandboxed CI / agent containers), route the Electrum
// WebSocket client (ws) through it. No-op otherwise. Never loaded by the web app.
const proxy = process.env.HTTPS_PROXY || process.env.https_proxy;
if (proxy) {
  const { HttpsProxyAgent } = require('https-proxy-agent');
  const agent = new HttpsProxyAgent(proxy);
  const path = require.resolve('ws');
  const WS = require('ws');
  class ProxiedWebSocket extends WS {
    constructor(address, protocols, options) {
      if (protocols && typeof protocols === 'object' && !Array.isArray(protocols)) {
        super(address, { ...protocols, agent });
      } else {
        super(address, protocols, { ...(options || {}), agent });
      }
    }
  }
  require.cache[path].exports = ProxiedWebSocket;
}

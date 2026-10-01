'use strict';
// Starts the app on a random port with a fresh database in a temp folder.
const fs = require('fs');
const os = require('os');
const path = require('path');

process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'kasir-test-'));
process.env.DISABLE_RATE_LIMIT = '1';
process.env.TZ = 'Asia/Jakarta';

const app = require('../src/app');

async function start() {
  const server = await new Promise((resolve) => { const s = app.listen(0, () => resolve(s)); });
  const base = `http://127.0.0.1:${server.address().port}`;
  return { base, close: () => new Promise((r) => server.close(r)) };
}

/** A tiny browser: keeps its own cookie, sends JSON. */
function client(base) {
  let cookie = '';
  async function call(method, url, body, headers = {}) {
    const res = await fetch(base + url, {
      method,
      headers: { ...(body !== undefined ? { 'content-type': 'application/json' } : {}), ...(cookie ? { cookie } : {}), ...headers },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      redirect: 'manual',
    });
    const set = res.headers.get('set-cookie');
    if (set) cookie = set.split(';')[0];
    const text = await res.text();
    let data = text;
    try { data = JSON.parse(text); } catch { /* not JSON */ }
    return { status: res.status, data, headers: res.headers };
  }
  return {
    get: (u, h) => call('GET', u, undefined, h),
    post: (u, b = {}, h) => call('POST', u, b, h),
    put: (u, b = {}, h) => call('PUT', u, b, h),
    del: (u, h) => call('DELETE', u, {}, h),
    raw: call,
    cookie: () => cookie,
    async login(username, password) {
      const r = await call('POST', '/api/login', { username, password });
      if (r.status !== 200) throw new Error('login failed: ' + JSON.stringify(r.data));
      return r.data.user;
    },
  };
}

module.exports = { start, client };

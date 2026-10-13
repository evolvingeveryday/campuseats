'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createOrderServer } = require('../src/server');

const AUTH = { Authorization: 'Bearer assignment-demo-token' };
const validOrder = {
  items: [{ itemId: 'meal-01', qty: 2 }],
  address: 'Hostel Block A, Room 12',
  paymentMethod: 'cash',
};

async function startApi(options = {}) {
  const app = createOrderServer({ rateLimitMax: 100, demoMode: true, ...options });
  await new Promise((resolve, reject) => {
    app.server.once('error', reject);
    app.server.listen(0, '127.0.0.1', resolve);
  });
  const address = app.server.address();
  return {
    ...app,
    base: `http://127.0.0.1:${address.port}`,
    async close() {
      await new Promise((resolve, reject) => app.server.close(error => error ? reject(error) : resolve()));
    },
  };
}

async function withApi(fn, options = {}) {
  const api = await startApi(options);
  try { await fn(api); } finally { await api.close(); }
}

async function request(api, path, options = {}) {
  return fetch(`${api.base}${path}`, {
    ...options,
    headers: { ...AUTH, ...(options.headers || {}) },
  });
}

async function createOrder(api, key = `key-${Math.random()}`) {
  return request(api, '/orders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Idempotency-Key': key },
    body: JSON.stringify(validOrder),
  });
}

test('health endpoint is reachable', async () => withApi(async api => {
  const response = await fetch(`${api.base}/health`);
  assert.equal(response.status, 200);
  assert.equal((await response.json()).status, 'ok');
}));

test('POST creates an order with 201, Location, JSON Content-Type and ETag', async () => withApi(async api => {
  const response = await createOrder(api, 'create-once');
  const body = await response.json();
  assert.equal(response.status, 201);
  assert.equal(response.headers.get('location'), `/orders/${body.id}`);
  assert.match(response.headers.get('content-type'), /^application\/json; charset=utf-8/);
  assert.ok(response.headers.get('etag'));
  assert.equal(body.status, 'pending');
}));

test('same Idempotency-Key returns original result without duplicate order', async () => withApi(async api => {
  const first = await createOrder(api, 'stable-key');
  const firstBody = await first.json();
  const second = await createOrder(api, 'stable-key');
  const secondBody = await second.json();
  assert.equal(first.status, 201);
  assert.equal(second.status, 201);
  assert.equal(secondBody.id, firstBody.id);
  assert.equal((await (await request(api, '/orders')).json()).pagination.total, 1);
}));

test('reusing Idempotency-Key with a different body returns 409', async () => withApi(async api => {
  await createOrder(api, 'different-body-key');
  const response = await request(api, '/orders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Idempotency-Key': 'different-body-key' },
    body: JSON.stringify({ ...validOrder, address: 'Different address' }),
  });
  assert.equal(response.status, 409);
  assert.equal((await response.json()).type.split('/').pop(), 'idempotency-conflict');
}));

test('empty cart returns 422 Problem Details with empty-cart type', async () => withApi(async api => {
  const response = await request(api, '/orders', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ items: [], address: 'Hostel' }),
  });
  const body = await response.json();
  assert.equal(response.status, 422);
  assert.equal(response.headers.get('content-type'), 'application/problem+json; charset=utf-8');
  assert.equal(body.type.split('/').pop(), 'empty-cart');
  assert.ok(Array.isArray(body.errors));
}));

test('validation reports multiple field errors in one 422', async () => withApi(async api => {
  const response = await request(api, '/orders', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ items: [{ itemId: 'meal-01', qty: 0 }] }),
  });
  const body = await response.json();
  assert.equal(response.status, 422);
  assert.equal(body.type.split('/').pop(), 'validation-error');
  assert.ok(body.errors.some(error => error.field === 'items[0].qty'));
  assert.ok(body.errors.some(error => error.field === 'address'));
  assert.ok(body.errors.length >= 2);
}));

test('unavailable item and declined payment are clean 422 domain errors', async () => withApi(async api => {
  const unavailable = await request(api, '/orders', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...validOrder, items: [{ itemId: 'unavailable', qty: 1 }] }),
  });
  assert.equal(unavailable.status, 422);
  assert.equal((await unavailable.json()).type.split('/').pop(), 'item-unavailable');

  const declined = await request(api, '/orders', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...validOrder, paymentMethod: 'declined' }),
  });
  assert.equal(declined.status, 422);
  assert.equal((await declined.json()).type.split('/').pop(), 'payment-declined');
}));

test('malformed JSON is 400, missing Authorization is 401 and XML Accept is 406', async () => withApi(async api => {
  const malformed = await request(api, '/orders', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{invalid json',
  });
  assert.equal(malformed.status, 400);
  assert.equal((await malformed.json()).type.split('/').pop(), 'malformed-json');

  const unauthorized = await fetch(`${api.base}/orders`);
  assert.equal(unauthorized.status, 401);
  assert.equal((await unauthorized.json()).type.split('/').pop(), 'unauthorized');

  const xml = await request(api, '/orders', {
    method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/xml' },
    body: JSON.stringify(validOrder),
  });
  assert.equal(xml.status, 406);
  assert.equal((await xml.json()).type.split('/').pop(), 'not-acceptable');
}));

test('unknown order returns 404 order-not-found', async () => withApi(async api => {
  const response = await request(api, '/orders/ord_9999');
  assert.equal(response.status, 404);
  assert.equal((await response.json()).type.split('/').pop(), 'order-not-found');
}));

test('ETag supports conditional GET 304 and stale If-Match returns 412', async () => withApi(async api => {
  const created = await createOrder(api, 'etag-test');
  const body = await created.json();
  const tag = created.headers.get('etag');
  const conditionalGet = await request(api, `/orders/${body.id}`, { headers: { 'If-None-Match': tag } });
  assert.equal(conditionalGet.status, 304);
  assert.equal(await conditionalGet.text(), '');

  const staleWrite = await request(api, `/orders/${body.id}`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json', 'If-Match': '"old-etag"' },
    body: JSON.stringify({ status: 'confirmed' }),
  });
  assert.equal(staleWrite.status, 412);
  assert.equal((await staleWrite.json()).type.split('/').pop(), 'precondition-failed');
}));

test('illegal status transition returns 409; allowed transition changes ETag', async () => withApi(async api => {
  const created = await createOrder(api, 'transition-test');
  const order = await created.json();
  const tag = created.headers.get('etag');
  const illegal = await request(api, `/orders/${order.id}`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json', 'If-Match': tag },
    body: JSON.stringify({ status: 'delivered' }),
  });
  assert.equal(illegal.status, 409);
  assert.equal((await illegal.json()).type.split('/').pop(), 'illegal-transition');

  const allowed = await request(api, `/orders/${order.id}`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json', 'If-Match': tag },
    body: JSON.stringify({ status: 'confirmed' }),
  });
  assert.equal(allowed.status, 200);
  const updated = await allowed.json();
  assert.equal(updated.status, 'confirmed');
  assert.notEqual(allowed.headers.get('etag'), tag);
}));

test('DELETE returns 204 and repeat/missing delete returns 404', async () => withApi(async api => {
  const created = await createOrder(api, 'delete-test');
  const order = await created.json();
  const deleted = await request(api, `/orders/${order.id}`, { method: 'DELETE' });
  assert.equal(deleted.status, 204);
  assert.equal(await deleted.text(), '');
  const repeated = await request(api, `/orders/${order.id}`, { method: 'DELETE' });
  assert.equal(repeated.status, 404);
}));

test('rate limiting is per client and 429 includes Retry-After and rate headers', async () => withApi(async api => {
  await request(api, '/orders');
  await request(api, '/orders');
  const response = await request(api, '/orders');
  const body = await response.json();
  assert.equal(response.status, 429);
  assert.equal(body.type.split('/').pop(), 'rate-limit-exceeded');
  assert.ok(Number(response.headers.get('retry-after')) >= 1);
  assert.equal(response.headers.get('x-ratelimit-limit'), '2');
  assert.equal(response.headers.get('x-ratelimit-remaining'), '0');
}, { rateLimitMax: 2 }));

test('unexpected internal errors map to a clean 500 Problem Details response', async () => withApi(async api => {
  const response = await request(api, '/orders', {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Demo-Force-Internal-Error': '1' },
    body: JSON.stringify(validOrder),
  });
  const textBody = await response.text();
  const body = JSON.parse(textBody);
  assert.equal(response.status, 500);
  assert.equal(body.type.split('/').pop(), 'internal-error');
  assert.equal(response.headers.get('content-type'), 'application/problem+json; charset=utf-8');
  assert.ok(!textBody.includes('simulated database adapter failure'));
  assert.ok(!textBody.includes('stack'));
}));

test('503 includes Retry-After and does not create an order', async () => withApi(async api => {
  const response = await request(api, '/orders', {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Demo-Force-503': '1' },
    body: JSON.stringify(validOrder),
  });
  assert.equal(response.status, 503);
  assert.equal(response.headers.get('retry-after'), '2');
  assert.equal((await response.json()).type.split('/').pop(), 'temporary-unavailable');
  assert.equal((await (await request(api, '/orders')).json()).pagination.total, 0);
}));

test('OPTIONS returns Allow and CORS; X-HTTP-Method-Override supports PATCH', async () => withApi(async api => {
  const options = await fetch(`${api.base}/orders`, { method: 'OPTIONS' });
  assert.equal(options.status, 204);
  assert.match(options.headers.get('allow'), /GET, POST, OPTIONS/);
  assert.equal(options.headers.get('access-control-allow-origin'), '*');

  const created = await createOrder(api, 'override-test');
  const order = await created.json();
  const patched = await request(api, `/orders/${order.id}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'X-HTTP-Method-Override': 'PATCH' },
    body: JSON.stringify({ status: 'confirmed' }),
  });
  assert.equal(patched.status, 200);
  assert.equal((await patched.json()).status, 'confirmed');
}));

test('list endpoint filters, sorts and paginates as a read', async () => withApi(async api => {
  await createOrder(api, 'list-one');
  await request(api, '/orders', {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': 'list-two' },
    body: JSON.stringify({ ...validOrder, address: 'Second address' }),
  });
  const response = await request(api, '/orders?status=pending&sort=id&order=asc&page=1&limit=1');
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.pagination.total, 2);
  assert.equal(body.data.length, 1);
}));

test('demo response delay commits once; retry with same key gets original order', async () => withApi(async api => {
  const first = await request(api, '/orders', {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': 'timeout-key', 'X-Demo-Response-Delay-Ms': '1' },
    body: JSON.stringify(validOrder),
  });
  const original = await first.json();
  const retry = await createOrder(api, 'timeout-key');
  const repeated = await retry.json();
  assert.equal(original.id, repeated.id);
  assert.equal((await (await request(api, '/orders')).json()).pagination.total, 1);
}));

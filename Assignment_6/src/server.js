'use strict';

const http = require('node:http');
const crypto = require('node:crypto');
const zlib = require('node:zlib');

const DEMO_TOKEN_NOTE = 'This assignment checks Authorization header handling only; it is not a production token system.';

function etagFor(order) {
  const digest = crypto.createHash('sha256').update(JSON.stringify(order)).digest('hex').slice(0, 24);
  return `"${digest}"`;
}

function problemBody(status, type, title, detail, extra = {}) {
  return {
    type: `https://campuseats.example/problems/${type}`,
    title,
    status,
    detail,
    ...extra,
  };
}

function createOrderServer(options = {}) {
  const rateLimitMax = Number.isInteger(options.rateLimitMax) ? options.rateLimitMax : Number(process.env.RATE_LIMIT_MAX || 100);
  const rateLimitWindowMs = Number.isInteger(options.rateLimitWindowMs) ? options.rateLimitWindowMs : Number(process.env.RATE_LIMIT_WINDOW_MS || 60_000);
  const demoMode = options.demoMode !== undefined ? options.demoMode : process.env.NODE_ENV !== 'production';

  const orders = new Map();
  const idempotency = new Map();
  const rateBuckets = new Map();
  let nextId = 1;

  function commonHeaders(res, rateInfo = null) {
    res.setHeader('Date', new Date().toUTCString());
    res.setHeader('Server', 'CampusEats-Order-Service');
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type, Accept, Idempotency-Key, If-Match, If-None-Match, X-HTTP-Method-Override, X-Demo-Response-Delay-Ms, X-Demo-Force-503, X-Demo-Force-Internal-Error');
    res.setHeader('Access-Control-Expose-Headers', 'Location, ETag, Retry-After, X-RateLimit-Limit, X-RateLimit-Remaining');
    res.setHeader('Vary', 'Origin, Accept, Accept-Encoding');
    if (rateInfo) {
      res.setHeader('X-RateLimit-Limit', String(rateLimitMax));
      res.setHeader('X-RateLimit-Remaining', String(rateInfo.remaining));
    }
  }

  function send(res, status, body, opts = {}) {
    if (res.writableEnded) return;
    const headers = opts.headers || {};
    for (const [key, value] of Object.entries(headers)) res.setHeader(key, value);
    if (status === 204 || status === 304 || body === null || body === undefined) {
      res.statusCode = status;
      res.end();
      return;
    }
    const contentType = opts.contentType || 'application/json; charset=utf-8';
    let payload = Buffer.from(JSON.stringify(body, null, 2) + '\n', 'utf8');
    res.statusCode = status;
    res.setHeader('Content-Type', contentType);
    if (payload.length > 1024 && /\bgzip\b/i.test(String(res.req.headers['accept-encoding'] || ''))) {
      payload = zlib.gzipSync(payload);
      res.setHeader('Content-Encoding', 'gzip');
    }
    res.setHeader('Content-Length', String(payload.length));
    res.end(payload);
  }

  function problem(res, status, type, title, detail, extra = {}, headers = {}, rateInfo = null) {
    if (rateInfo) commonHeaders(res, rateInfo);
    send(res, status, problemBody(status, type, title, detail, extra), {
      contentType: 'application/problem+json; charset=utf-8',
      headers,
    });
  }

  function isJsonAcceptable(acceptHeader) {
    const accept = String(acceptHeader || '*/*').toLowerCase();
    if (accept.trim() === '' || accept.includes('*/*') || accept.includes('application/*') || accept.includes('application/json')) return true;
    return false;
  }

  function getClientKey(req) {
    // Behind a reverse proxy, configure trusted proxy handling instead of blindly trusting X-Forwarded-For.
    return req.socket.remoteAddress || 'unknown-client';
  }

  function consumeRateLimit(req) {
    const now = Date.now();
    const key = getClientKey(req);
    let bucket = rateBuckets.get(key);
    if (!bucket || now - bucket.startedAt >= rateLimitWindowMs) {
      bucket = { startedAt: now, count: 0 };
      rateBuckets.set(key, bucket);
    }
    const resetIn = Math.max(1, Math.ceil((bucket.startedAt + rateLimitWindowMs - now) / 1000));
    if (bucket.count >= rateLimitMax) {
      return { allowed: false, remaining: 0, retryAfter: resetIn };
    }
    bucket.count += 1;
    return { allowed: true, remaining: Math.max(0, rateLimitMax - bucket.count), retryAfter: resetIn };
  }

  async function readJson(req, res, rateInfo) {
    const contentType = String(req.headers['content-type'] || '').toLowerCase();
    if (contentType && !contentType.includes('application/json')) {
      problem(res, 415, 'unsupported-media-type', 'Unsupported Media Type', 'Send request bodies using Content-Type: application/json.', {}, {}, rateInfo);
      return { ok: false };
    }
    let raw = '';
    try {
      for await (const chunk of req) {
        raw += chunk.toString('utf8');
        if (raw.length > 1_000_000) {
          problem(res, 413, 'request-too-large', 'Request Too Large', 'The JSON request body exceeds the 1 MB limit.', {}, {}, rateInfo);
          return { ok: false };
        }
      }
    } catch (error) {
      console.error('[order-service] Failed reading request body:', error.message);
      problem(res, 400, 'malformed-json', 'Malformed JSON', 'The request body could not be read as valid JSON.', {}, {}, rateInfo);
      return { ok: false };
    }
    try {
      return { ok: true, value: JSON.parse(raw) };
    } catch {
      problem(res, 400, 'malformed-json', 'Malformed JSON', 'The request body must be valid JSON.', {}, {}, rateInfo);
      return { ok: false };
    }
  }

  function validateCreate(body) {
    const errors = [];
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      errors.push({ field: 'body', message: 'must be a JSON object' });
      return { errors, emptyCart: false };
    }

    let emptyCart = false;
    if (!Array.isArray(body.items)) {
      errors.push({ field: 'items', message: 'is required and must be an array' });
    } else if (body.items.length === 0) {
      errors.push({ field: 'items', message: 'must contain at least one item' });
      emptyCart = true;
    } else {
      body.items.forEach((item, index) => {
        if (!item || typeof item !== 'object' || Array.isArray(item)) {
          errors.push({ field: `items[${index}]`, message: 'must be an object' });
          return;
        }
        if (typeof item.itemId !== 'string' || item.itemId.trim() === '') {
          errors.push({ field: `items[${index}].itemId`, message: 'is required and must be a non-empty string' });
        }
        if (!Number.isInteger(item.qty) || item.qty < 1) {
          errors.push({ field: `items[${index}].qty`, message: 'must be an integer greater than or equal to 1' });
        }
      });
    }
    if (typeof body.address !== 'string' || body.address.trim() === '') {
      errors.push({ field: 'address', message: 'is required and must be a non-empty string' });
    }
    if (body.paymentMethod !== undefined && !['cash', 'card', 'declined'].includes(body.paymentMethod)) {
      errors.push({ field: 'paymentMethod', message: 'must be one of: cash, card, declined' });
    }
    return { errors, emptyCart };
  }

  function computeEtag(order) {
    return etagFor(order);
  }

  function getOrderId(pathname) {
    const match = pathname.match(/^\/orders\/([^/]+)$/);
    if (!match) return null;
    try { return decodeURIComponent(match[1]); } catch { return match[1]; }
  }

  function orderList(url) {
    let rows = [...orders.values()];
    const status = url.searchParams.get('status');
    if (status) rows = rows.filter(order => order.status === status);
    const sort = url.searchParams.get('sort') || 'createdAt';
    if (!['id', 'createdAt', 'status'].includes(sort)) return { error: 'sort must be one of: id, createdAt, status' };
    const direction = (url.searchParams.get('order') || 'asc').toLowerCase();
    if (!['asc', 'desc'].includes(direction)) return { error: 'order must be asc or desc' };
    rows.sort((a, b) => String(a[sort]).localeCompare(String(b[sort])) * (direction === 'desc' ? -1 : 1));
    const page = Number(url.searchParams.get('page') || 1);
    const limit = Number(url.searchParams.get('limit') || 20);
    if (!Number.isInteger(page) || page < 1) return { error: 'page must be an integer greater than or equal to 1' };
    if (!Number.isInteger(limit) || limit < 1 || limit > 100) return { error: 'limit must be an integer between 1 and 100' };
    return { data: rows.slice((page - 1) * limit, page * limit), total: rows.length, page, limit };
  }

  const allowedTransitions = {
    pending: ['confirmed', 'cancelled'],
    confirmed: ['preparing', 'cancelled'],
    preparing: ['ready'],
    ready: ['delivered'],
    delivered: [],
    cancelled: [],
  };

  async function handle(req, res) {
    commonHeaders(res);
    const url = new URL(req.url, 'http://localhost');
    const pathname = url.pathname;

    if (req.method === 'GET' && pathname === '/health') {
      send(res, 200, { status: 'ok', service: 'CampusEats Orders API' });
      return;
    }

    if (!pathname.startsWith('/orders')) {
      problem(res, 404, 'endpoint-not-found', 'Endpoint Not Found', 'The requested endpoint does not exist.');
      return;
    }

    if (req.method === 'OPTIONS') {
      const allow = pathname === '/orders'
        ? 'GET, POST, OPTIONS'
        : getOrderId(pathname) !== null
          ? 'GET, PATCH, DELETE, POST, OPTIONS'
          : 'GET, POST, OPTIONS';
      res.setHeader('Allow', allow);
      send(res, 204, null);
      return;
    }

    const token = String(req.headers.authorization || '');
    if (!/^Bearer\s+\S+/i.test(token)) {
      problem(res, 401, 'unauthorized', 'Unauthorized', 'A non-empty Authorization: Bearer <token> header is required.');
      return;
    }

    const rateInfo = consumeRateLimit(req);
    commonHeaders(res, rateInfo);
    if (!rateInfo.allowed) {
      problem(res, 429, 'rate-limit-exceeded', 'Too Many Requests', 'The per-client request budget has been exceeded. Retry after the indicated delay.', {}, { 'Retry-After': String(rateInfo.retryAfter) }, rateInfo);
      return;
    }

    if (!isJsonAcceptable(req.headers.accept)) {
      problem(res, 406, 'not-acceptable', 'Not Acceptable', 'This version of the service can produce application/json only; request Accept: application/json or */*. Do not retry unchanged.');
      return;
    }

    const id = getOrderId(pathname);
    const isCollection = pathname === '/orders';
    let method = req.method.toUpperCase();
    const override = String(req.headers['x-http-method-override'] || '').toUpperCase();
    if (method === 'POST' && id !== null && ['PATCH', 'DELETE'].includes(override)) method = override;
    else if (method === 'POST' && id !== null && override && !['PATCH', 'DELETE'].includes(override)) {
      problem(res, 400, 'invalid-method-override', 'Invalid Method Override', 'X-HTTP-Method-Override may be PATCH or DELETE for an individual order.');
      return;
    }

    try {
      if (isCollection && method === 'GET') {
        const result = orderList(url);
        if (result.error) {
          problem(res, 400, 'invalid-query', 'Invalid Query Parameters', result.error, {}, {}, rateInfo);
          return;
        }
        send(res, 200, { data: result.data, pagination: { total: result.total, page: result.page, limit: result.limit } });
        return;
      }

      if (isCollection && method === 'POST') {
        if (demoMode && req.headers['x-demo-force-internal-error'] === '1') throw new Error('Demonstration-only internal failure: simulated database adapter failure');
        if (demoMode && req.headers['x-demo-force-503'] === '1') {
          problem(res, 503, 'temporary-unavailable', 'Service Unavailable', 'The service is temporarily unavailable. Retry after the indicated delay.', {}, { 'Retry-After': '2' }, rateInfo);
          return;
        }
        const parsed = await readJson(req, res, rateInfo);
        if (!parsed.ok) return;
        const validation = validateCreate(parsed.value);
        if (validation.errors.length) {
          if (validation.emptyCart) {
            problem(res, 422, 'empty-cart', 'Empty Cart', 'An order must contain at least one item.', { errors: validation.errors }, {}, rateInfo);
          } else {
            problem(res, 422, 'validation-error', 'Validation Failed', 'One or more request fields are invalid. Correct every field listed in errors and resubmit.', { errors: validation.errors }, {}, rateInfo);
          }
          return;
        }
        const body = parsed.value;
        if (body.items.some(item => item.itemId === 'unavailable')) {
          problem(res, 422, 'item-unavailable', 'Item Unavailable', 'At least one requested item is currently unavailable.', { errors: [{ field: 'items', message: 'contains an unavailable item' }] }, {}, rateInfo);
          return;
        }
        if (body.paymentMethod === 'declined') {
          problem(res, 422, 'payment-declined', 'Payment Declined', 'The demo payment provider declined the payment. Use cash or card for a successful demo order.', { errors: [{ field: 'paymentMethod', message: 'payment was declined' }] }, {}, rateInfo);
          return;
        }

        const key = String(req.headers['idempotency-key'] || '').trim();
        const fingerprint = JSON.stringify(body);
        const cacheKey = key ? `${getClientKey(req)}:${key}` : null;
        if (cacheKey && idempotency.has(cacheKey)) {
          const previous = idempotency.get(cacheKey);
          if (previous.fingerprint !== fingerprint) {
            problem(res, 409, 'idempotency-conflict', 'Idempotency Key Conflict', 'This Idempotency-Key was already used with a different request body. Use a new key for a different order.');
            return;
          }
          send(res, previous.status, previous.body, { headers: previous.headers });
          return;
        }

        const now = new Date().toISOString();
        const order = {
          id: `ord_${String(nextId++).padStart(4, '0')}`,
          items: body.items.map(item => ({ itemId: item.itemId.trim(), qty: item.qty })),
          address: body.address.trim(),
          paymentMethod: body.paymentMethod || 'cash',
          status: 'pending',
          createdAt: now,
          updatedAt: now,
        };
        orders.set(order.id, order);
        const headers = { Location: `/orders/${order.id}`, ETag: computeEtag(order), 'Cache-Control': 'no-store' };
        const cachedResult = { fingerprint, status: 201, body: order, headers };
        if (cacheKey) idempotency.set(cacheKey, cachedResult);

        // Demo-only: commit the order and idempotency record, then delay the response so curl --max-time can simulate a client timeout.
        const delay = demoMode ? Math.min(5000, Math.max(0, Number(req.headers['x-demo-response-delay-ms'] || 0))) : 0;
        if (delay > 0) await new Promise(resolve => setTimeout(resolve, delay));
        send(res, 201, order, { headers });
        return;
      }

      if (id !== null && method === 'GET') {
        const order = orders.get(id);
        if (!order) {
          problem(res, 404, 'order-not-found', 'Order Not Found', `No order exists with id '${id}'.`);
          return;
        }
        const tag = computeEtag(order);
        res.setHeader('ETag', tag);
        res.setHeader('Cache-Control', 'private, max-age=0, must-revalidate');
        const incoming = String(req.headers['if-none-match'] || '').trim();
        if (incoming === '*' || incoming.split(',').map(s => s.trim()).includes(tag)) {
          send(res, 304, null, { headers: { ETag: tag, 'Cache-Control': 'private, max-age=0, must-revalidate' } });
          return;
        }
        send(res, 200, order, { headers: { ETag: tag, 'Cache-Control': 'private, max-age=0, must-revalidate' } });
        return;
      }

      if (id !== null && method === 'PATCH') {
        const order = orders.get(id);
        if (!order) {
          problem(res, 404, 'order-not-found', 'Order Not Found', `No order exists with id '${id}'.`);
          return;
        }
        const currentTag = computeEtag(order);
        const match = String(req.headers['if-match'] || '').trim();
        if (match && match !== '*' && !match.split(',').map(s => s.trim()).includes(currentTag)) {
          problem(res, 412, 'precondition-failed', 'Precondition Failed', 'The supplied If-Match ETag is stale. Fetch the current order and retry with its latest ETag.', {}, { ETag: currentTag });
          return;
        }
        const parsed = await readJson(req, res, rateInfo);
        if (!parsed.ok) return;
        const errors = [];
        if (!parsed.value || typeof parsed.value !== 'object' || Array.isArray(parsed.value)) {
          errors.push({ field: 'body', message: 'must be a JSON object' });
        } else if (typeof parsed.value.status !== 'string' || !['pending', 'confirmed', 'preparing', 'ready', 'delivered', 'cancelled'].includes(parsed.value.status)) {
          errors.push({ field: 'status', message: 'must be one of: pending, confirmed, preparing, ready, delivered, cancelled' });
        }
        if (errors.length) {
          problem(res, 422, 'validation-error', 'Validation Failed', 'The patch body contains invalid fields.', { errors });
          return;
        }
        const nextStatus = parsed.value.status;
        if (nextStatus === order.status) {
          send(res, 200, order, { headers: { ETag: currentTag, 'Cache-Control': 'no-store' } });
          return;
        }
        if (!(allowedTransitions[order.status] || []).includes(nextStatus)) {
          problem(res, 409, 'illegal-transition', 'Illegal Order Transition', `An order in '${order.status}' cannot transition to '${nextStatus}'.`, { errors: [{ field: 'status', message: `transition ${order.status} -> ${nextStatus} is not allowed` }] });
          return;
        }
        order.status = nextStatus;
        order.updatedAt = new Date().toISOString();
        send(res, 200, order, { headers: { ETag: computeEtag(order), 'Cache-Control': 'no-store' } });
        return;
      }

      if (id !== null && method === 'DELETE') {
        const order = orders.get(id);
        if (!order) {
          problem(res, 404, 'order-not-found', 'Order Not Found', `No order exists with id '${id}'.`);
          return;
        }
        if (order.status !== 'pending') {
          problem(res, 409, 'illegal-transition', 'Illegal Order Transition', `Only pending orders may be deleted; this order is '${order.status}'.`);
          return;
        }
        orders.delete(id);
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        send(res, 204, null);
        return;
      }

      if (isCollection || id !== null) {
        const allow = isCollection ? 'GET, POST, OPTIONS' : 'GET, PATCH, DELETE, POST, OPTIONS';
        problem(res, 405, 'method-not-allowed', 'Method Not Allowed', `The method ${method} is not allowed for this resource.`, {}, { Allow: allow });
        return;
      }
      problem(res, 404, 'endpoint-not-found', 'Endpoint Not Found', 'The requested endpoint does not exist.');
    } catch (error) {
      // Detailed errors stay in server logs; clients receive only a clean, stable error shape.
      console.error('[order-service] Internal error:', error && error.stack ? error.stack : String(error));
      if (!res.writableEnded) {
        problem(res, 500, 'internal-error', 'Internal Server Error', 'The service encountered an unexpected problem. Please retry later or contact the service owner with the request time.');
      }
    }
  }

  const server = http.createServer((req, res) => {
    void handle(req, res);
  });

  function reset() {
    orders.clear();
    idempotency.clear();
    rateBuckets.clear();
    nextId = 1;
  }

  return { server, reset };
}

if (require.main === module) {
  const port = Number(process.env.PORT || 3000);
  const host = process.env.HOST || '127.0.0.1';
  const { server } = createOrderServer();
  server.listen(port, host, () => {
    console.log(`CampusEats Orders API listening at http://${host}:${port}`);
    console.log(DEMO_TOKEN_NOTE);
    if (process.env.NODE_ENV === 'production') console.log('Demo-only headers are disabled in production mode.');
  });
  server.on('error', error => {
    console.error('[order-service] Server failed to start:', error.message);
    process.exitCode = 1;
  });
}

module.exports = { createOrderServer, problemBody, etagFor };
